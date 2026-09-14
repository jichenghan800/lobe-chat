import type { CottiSandboxModel } from '@/database/models/cottiSandbox';

export interface SandboxCapacityRequest {
  leaseTtlMs: number;
  sessionKey: string;
  timeoutMs: number;
}

export class SandboxCapacityError extends Error {
  constructor() {
    super(
      'Self-hosted sandbox capacity is full. Retry later. Do not switch to cloud without user consent.',
    );
    this.name = 'SandboxCapacityFull';
  }
}

export class SandboxCapacityService {
  constructor(private getModel: () => Promise<CottiSandboxModel>) {}

  async run(
    request: SandboxCapacityRequest,
    execute: (signal: AbortSignal) => Promise<Response>,
  ): Promise<Response> {
    if (
      !Number.isFinite(request.timeoutMs) ||
      !Number.isFinite(request.leaseTtlMs) ||
      request.timeoutMs <= 0 ||
      request.leaseTtlMs <= 0
    ) {
      throw new Error('Invalid sandbox timeout or lease');
    }
    const timeoutMs = Math.max(1000, request.timeoutMs) + 30_000;
    const model = await this.getModel();
    // Keep the slot beyond the possible command dispatch/execution window plus
    // the worker lease. Never shorten it from an out-of-order response. Network
    // failures retain the reservation because a remote container may exist.
    const retentionMs = Math.max(60_000, request.leaseTtlMs) + timeoutMs + 30_000;
    const reservation = await model.reserve(request.sessionKey, retentionMs);
    if (!reservation.allowed) throw new SandboxCapacityError();
    const response = await execute(AbortSignal.timeout(timeoutMs));
    if (reservation.newlyReserved && [400, 401, 403, 404, 429].includes(response.status)) {
      await model.releaseRejected(request.sessionKey, reservation.revision);
    }
    return response;
  }
}
