import { Flexbox } from '@lobehub/ui';
import { Button, createModal, toast } from '@lobehub/ui/base-ui';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveFeishuAdminContactUrl } from '@/features/Home/feishuSupport';
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
        <Flexbox
          horizontal
          gap={8}
          justify="flex-end"
          style={{ padding: '0 16px 16px' }}
          wrap="wrap"
        >
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
            {t('topicChoice.new')}
          </Button>
          <Button
            onClick={() => {
              if (active.current !== modal) return;
              const url = resolveFeishuAdminContactUrl(
                process.env.NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL,
              );
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
              else toast.info(t('topicChoice.contactAdminHint'));
            }}
          >
            {t('topicChoice.adminUnfreeze')}
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
