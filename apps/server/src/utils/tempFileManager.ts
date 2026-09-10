import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import debug from 'debug';

const log = debug('lobe-server:temp-file-manager');

/**
 * Utility class for safely storing temporary files
 */
export class TempFileManager {
  private static managers = new Set<TempFileManager>();
  private static cleanupAll = () => {
    for (const manager of TempFileManager.managers) {
      try {
        manager.cleanup();
      } catch (error) {
        console.error('Failed to clean temporary files:', error);
      }
    }
  };
  private static onException = (error: Error) => {
    console.error('Uncaught exception, cleaning temp files:', error);
    TempFileManager.cleanupAll();
    process.exit(1);
  };
  private static onSignal = () => {
    TempFileManager.cleanupAll();
    process.exit(0);
  };

  private readonly tempDir: string;
  private filePaths: Set<string> = new Set();

  constructor(dirname: string) {
    // Create unique temporary directory (cross-platform safe)
    this.tempDir = mkdtempSync(path.join(tmpdir(), dirname));
    TempFileManager.managers.add(this);
    // Register cleanup hook for process exit
    this.registerCleanupHook();
    log('created activeManagers=%d', TempFileManager.managers.size);
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
    if (existsSync(this.tempDir)) {
      // Recursively delete directory and its contents
      rmSync(this.tempDir, { force: true, recursive: true });
    }
    this.filePaths.clear();
    TempFileManager.managers.delete(this);
    if (TempFileManager.managers.size === 0) {
      process.removeListener('exit', TempFileManager.cleanupAll);
      process.removeListener('uncaughtException', TempFileManager.onException);
      process.removeListener('SIGINT', TempFileManager.onSignal);
      process.removeListener('SIGTERM', TempFileManager.onSignal);
    }
    log('cleaned activeManagers=%d', TempFileManager.managers.size);
  }

  /**
   * Register automatic cleanup on process exit/exception
   */
  private registerCleanupHook(): void {
    if (TempFileManager.managers.size !== 1) return;
    // Normal exit
    process.on('exit', TempFileManager.cleanupAll);
    // Exception exit
    process.on('uncaughtException', TempFileManager.onException);
    // Signal termination
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, TempFileManager.onSignal);
    });
  }
}
