import isEqual from 'fast-deep-equal';
import { useEffect, useRef, useState } from 'react';

export const useConfigAutosave = <T>(config: T | undefined, persist: (next: T) => Promise<T>) => {
  const [draft, setDraft] = useState(config);
  const [status, setStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [error, setError] = useState<unknown>();
  const busy = useRef(false);
  const retryValue = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (!busy.current) setDraft(config);
  }, [config]);

  const save = async (next: T) => {
    if (busy.current || isEqual(next, config)) return;
    busy.current = true;
    retryValue.current = next;
    setDraft(next);
    setStatus('saving');
    setError(undefined);
    try {
      setDraft(await persist(next));
      setStatus('saved');
      retryValue.current = undefined;
    } catch (cause) {
      setDraft(config);
      setError(cause);
      setStatus('failed');
    } finally {
      busy.current = false;
    }
  };

  return {
    draft,
    error,
    retry: () => retryValue.current && save(retryValue.current),
    save,
    saving: status === 'saving',
    status,
  };
};
