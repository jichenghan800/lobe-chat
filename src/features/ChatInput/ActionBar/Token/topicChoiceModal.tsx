import { Flexbox } from '@lobehub/ui';
import { Button, createModal } from '@lobehub/ui/base-ui';
import { t } from 'i18next';

export type TopicChoice = 'new' | 'current' | 'cancel';

/** Dismissal is distinct from explicitly choosing the current topic. */
export const chooseTopic = (frozen = false): Promise<TopicChoice> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (choice: TopicChoice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
      modal.close();
    };
    const modal = createModal({
      title: t(frozen ? 'topicChoice.frozenTitle' : 'topicChoice.title', { ns: 'chat' }),
      content: t(frozen ? 'topicChoice.frozenBody' : 'topicChoice.body', { ns: 'chat' }),
      width: 400,
      onOpenChange: (open) => {
        if (!open) finish('cancel');
      },
      footer: (
        <Flexbox
          horizontal
          gap={8}
          justify="flex-end"
          style={{ padding: '0 16px 16px' }}
          wrap="wrap"
        >
          <Button onClick={() => finish('current')}>
            {t(frozen ? 'topicChoice.carry' : 'topicChoice.current', { ns: 'chat' })}
          </Button>
          <Button autoFocus type="primary" onClick={() => finish('new')}>
            {t(frozen ? 'topicChoice.new' : 'topicChoice.newSend', { ns: 'chat' })}
          </Button>
        </Flexbox>
      ),
    });
  });
