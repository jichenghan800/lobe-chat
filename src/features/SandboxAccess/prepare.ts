export type SandboxAccessIssue =
  'auth_required' | 'auth_failed' | 'unavailable' | 'full' | 'new_topic';
export type SandboxAccessChoice = 'login' | 'selfHosted' | 'retry' | 'new' | 'cancel';
export interface SandboxPreflight {
  cloud: 'ready' | 'auth_required' | 'unavailable';
  selfHostedAvailable: boolean;
  selfHostedFull: boolean;
}
export interface SandboxAccessDependencies {
  choose: (issue: SandboxAccessIssue, fallback: boolean) => Promise<SandboxAccessChoice>;
  isCurrent: () => boolean;
  preflight: () => Promise<SandboxPreflight>;
  signIn: () => Promise<boolean>;
  switchProvider: () => Promise<'switched' | 'running' | 'new_topic_required'>;
}

/** No draft clearing, model calls, or automatic provider changes here. */
export const prepareSandboxSend = async (
  deps: SandboxAccessDependencies,
): Promise<'ready' | 'selfHosted' | 'new' | 'cancel'> => {
  let failedLogin = false;
  while (deps.isCurrent()) {
    let status: SandboxPreflight;
    try {
      status = await deps.preflight();
    } catch {
      // API unavailable: do not guess that local fallback is configured.
      status = { cloud: 'unavailable', selfHostedAvailable: false, selfHostedFull: false };
    }
    if (!deps.isCurrent()) return 'cancel';
    if (status.cloud === 'ready') return 'ready';
    const choice = await deps.choose(
      failedLogin && status.cloud === 'auth_required' ? 'auth_failed' : status.cloud,
      status.selfHostedAvailable,
    );
    if (!deps.isCurrent() || choice === 'cancel') return 'cancel';
    if (choice === 'login') {
      try {
        failedLogin = !(await deps.signIn());
      } catch {
        failedLogin = true;
      }
      continue;
    }
    if (choice !== 'selfHosted') continue;
    if (!status.selfHostedAvailable) return 'cancel';
    // Recheck capacity immediately before the requested change. Runtime still
    // performs atomic admission; this advisory check never reserves a slot.
    const latest = await deps.preflight();
    if (!deps.isCurrent()) return 'cancel';
    if (!latest.selfHostedAvailable) return 'cancel';
    if (latest.selfHostedFull) {
      const next = await deps.choose('full', false);
      if (next === 'cancel') return 'cancel';
      continue;
    }
    const result = await deps.switchProvider();
    if (!deps.isCurrent() || result === 'running') return 'cancel';
    if (result === 'new_topic_required') {
      const next = await deps.choose('new_topic', true);
      return deps.isCurrent() && next === 'new' ? 'new' : 'cancel';
    }
    return 'selfHosted';
  }
  return 'cancel';
};
