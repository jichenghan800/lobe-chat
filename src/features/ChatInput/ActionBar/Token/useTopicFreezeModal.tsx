import { Flexbox } from '@lobehub/ui';
import { Button, createModal } from '@lobehub/ui/base-ui';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useSingleton } from '@/hooks/useSingleton';

interface Options {
  content: string;
  enabled: boolean;
  onContinue: () => void;
  topicId?: string | null;
}

/** Show once per visit; dismissal keeps history readable and navigation closes stale dialogs. */
export const useTopicFreezeModal = ({ content, enabled, onContinue, topicId }: Options) => {
  const { t } = useTranslation('chat');
  const dismissed = useSingleton(() => new Set<string>());
  const continuation = useRef(onContinue);
  const active = useRef<ReturnType<typeof createModal> | null>(null);
  useEffect(() => {
    continuation.current = onContinue;
  }, [onContinue]);

  const show = useCallback(() => {
    if (!enabled || !topicId || active.current) return;
    const modal = createModal({
      title: t('topicChoice.frozenTitle'),
      content,
      width: 400,
      onOpenChange: (open) => {
        if (!open && active.current === modal) {
          dismissed.add(topicId);
          active.current = null;
        }
      },
      footer: (
        <Flexbox horizontal gap={8} justify="flex-end" style={{ padding: '0 16px 16px' }}>
          <Button
            onClick={() => {
              if (active.current !== modal) return;
              dismissed.add(topicId);
              active.current = null;
              modal.close();
            }}
          >
            {t('topicChoice.viewHistory')}
          </Button>
          <Button
            autoFocus
            type="primary"
            onClick={() => {
              if (active.current !== modal) return;
              dismissed.add(topicId);
              active.current = null;
              modal.close();
              continuation.current();
            }}
          >
            {t('topicChoice.frozenAction')}
          </Button>
        </Flexbox>
      ),
    });
    active.current = modal;
  }, [content, dismissed, enabled, t, topicId]);

  useEffect(() => {
    if (enabled && topicId && !dismissed.has(topicId)) show();
    return () => {
      const modal = active.current;
      active.current = null;
      modal?.close();
    };
  }, [dismissed, enabled, show, topicId]);
  return show;
};
