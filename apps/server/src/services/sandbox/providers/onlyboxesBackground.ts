// Keep process cancellation inside the provider. OnlyBoxes' task cancel API
// cancels the Console task but does not reliably stop an already dispatched exec.
export const backgroundCommand = (command: string, runId: string): string => {
  const encoded = Buffer.from(command).toString('base64');
  return `python3 - <<'OBX_BACKGROUND'
import base64, fcntl, os, pathlib, subprocess, sys
root = pathlib.Path('/tmp/lobe-background')
root.mkdir(exist_ok=True)
run = '${runId}'
with (root / (run + '.lock')).open('w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    if (root / (run + '.cancel')).exists():
        sys.exit(143)
    process = subprocess.Popen(base64.b64decode('${encoded}').decode(), shell=True,
        start_new_session=True, env={**os.environ, 'LOBE_BACKGROUND_RUN': run})
    (root / (run + '.pid')).write_text(str(process.pid))
    fcntl.flock(lock, fcntl.LOCK_UN)
try:
    sys.exit(process.wait())
finally:
    (root / (run + '.pid')).unlink(missing_ok=True)
OBX_BACKGROUND`;
};

export const cancelBackgroundCommand = (runId: string): string => `python3 - <<'OBX_CANCEL'
import fcntl, os, pathlib, signal, time
root = pathlib.Path('/tmp/lobe-background')
root.mkdir(exist_ok=True)
run = '${runId}'
with (root / (run + '.lock')).open('w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    (root / (run + '.cancel')).touch()
    marker = root / (run + '.pid')
    if marker.exists():
        pid = int(marker.read_text())
        try:
            identity = pathlib.Path('/proc') / str(pid) / 'environ'
            expected = ('LOBE_BACKGROUND_RUN=' + run).encode()
            if expected not in identity.read_bytes().split(b'\\0'):
                raise RuntimeError('Background process identity no longer matches')
            os.killpg(pid, signal.SIGTERM)
            time.sleep(0.2)
            try:
                os.killpg(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        except (FileNotFoundError, ProcessLookupError):
            pass
        marker.unlink(missing_ok=True)
print('stopped')
OBX_CANCEL`;

export const parseBackgroundCommandId = (commandId: string) => {
  const match = /^([\w-]+)~([a-f\d-]{36})$/.exec(commandId);
  return match ? { runId: match[2], taskId: match[1] } : undefined;
};
