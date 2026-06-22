import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import debug from 'debug';

const log = debug('lobe-server:temp-file-manager');
const LISTENER_WARNING_THRESHOLD = 10;

/**
 * Utility class for safely storing temporary files
 */
export class TempFileManager {
  private static cleanupHooksRegistered = false;
  private static createdManagers = 0;
  private static managers = new Set<TempFileManager>();

  private cleaned = false;
  private readonly tempDir: string;
  private readonly managerId: number;
  private filePaths: Set<string> = new Set();

  constructor(dirname: string) {
    this.managerId = TempFileManager.createdManagers += 1;

    // Create unique temporary directory (cross-platform safe)
    this.tempDir = mkdtempSync(path.join(tmpdir(), dirname));
    TempFileManager.managers.add(this);
    // Register cleanup hook for process exit
    this.registerCleanupHook();
    this.logListenerState('created', dirname);
  }

  /**
   * Write Uint8Array data to a temporary file

   */
  async writeTempFile(data: Uint8Array, name: string): Promise<string> {
    // Sanitize filename to prevent path traversal (GHSA-2g9j-v25c-4j97)
    const safeName = path.basename(name);
    const filePath = path.resolve(this.tempDir, safeName);

    try {
      writeFileSync(filePath, data);
      this.filePaths.add(filePath);
      return filePath;
    } catch (error) {
      this.cleanup(); // Immediately cleanup on write failure
      throw new Error(`Failed to write temp file: ${(error as Error).message}`, { cause: error });
    }
  }

  /**
   * Safely cleanup temporary resources
   */
  cleanup(): void {
    if (this.cleaned) return;

    if (existsSync(this.tempDir)) {
      // Recursively delete directory and its contents
      rmSync(this.tempDir, { force: true, recursive: true });
    }

    this.filePaths.clear();
    this.cleaned = true;
    TempFileManager.managers.delete(this);
    log(
      'cleaned managerId=%d activeManagers=%d tempDir=%s',
      this.managerId,
      TempFileManager.managers.size,
      this.tempDir,
    );
  }

  /**
   * Register automatic cleanup on process exit/exception
   */
  private registerCleanupHook(): void {
    if (TempFileManager.cleanupHooksRegistered) return;
    TempFileManager.cleanupHooksRegistered = true;

    // Normal exit
    process.on('exit', () => TempFileManager.cleanupAll());
    // Exception exit
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception, cleaning temp files:', err);
      TempFileManager.cleanupAll();
      process.exit(1);
    });
    // Signal termination
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => {
        TempFileManager.cleanupAll();
        process.exit(0);
      });
    });
  }

  private static cleanupAll(): void {
    const managers = Array.from(TempFileManager.managers);

    for (const manager of managers) {
      manager.cleanup();
    }
  }

  static resetForTest(): void {
    TempFileManager.cleanupHooksRegistered = false;
    TempFileManager.createdManagers = 0;
    TempFileManager.managers.clear();
  }

  private logListenerState(event: string, dirname: string): void {
    const listenerCounts = {
      exit: process.listenerCount('exit'),
      sigint: process.listenerCount('SIGINT'),
      sigterm: process.listenerCount('SIGTERM'),
      uncaughtException: process.listenerCount('uncaughtException'),
    };

    log(
      '%s managerId=%d dirname=%s activeManagers=%d createdManagers=%d listeners=%O',
      event,
      this.managerId,
      dirname,
      TempFileManager.managers.size,
      TempFileManager.createdManagers,
      listenerCounts,
    );

    if (listenerCounts.uncaughtException > LISTENER_WARNING_THRESHOLD) {
      log(
        'listener threshold exceeded managerId=%d activeManagers=%d listeners=%O',
        this.managerId,
        TempFileManager.managers.size,
        listenerCounts,
      );
    }
  }
}
