interface Dependencies {
  isSourceCurrent: () => boolean;
  isTargetCurrent: () => boolean;
  navigate: () => void;
  refresh: () => Promise<unknown>;
  switchTopic: () => Promise<unknown>;
}

/** Follow an accepted turn without stealing focus after the user navigates. */
export const openAcceptedSandboxTopic = async (deps: Dependencies) => {
  if (!deps.isSourceCurrent()) return;
  await deps.refresh();
  if (!deps.isSourceCurrent()) return;
  await deps.switchTopic();
  if (deps.isTargetCurrent()) deps.navigate();
};
