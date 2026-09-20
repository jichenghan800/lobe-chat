import { Flexbox } from '@lobehub/ui';
import { Button, createModal } from '@lobehub/ui/base-ui';
import { t } from 'i18next';

import type { SandboxAccessChoice, SandboxAccessIssue } from './prepare';

export const chooseSandboxAccess = (
  issue: SandboxAccessIssue,
  fallback: boolean,
): Promise<SandboxAccessChoice> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (choice: SandboxAccessChoice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
      modal.close();
    };
    const auth = issue === 'auth_required' || issue === 'auth_failed';
    const newTopic = issue === 'new_topic';
    const fallbackPrimary = fallback && issue !== 'auth_required';
    const modal = createModal({
      title: t(`sandboxAccess.${issue}.title`, { ns: 'chat' }),
      content: t(`sandboxAccess.${issue}.body`, { ns: 'chat' }),
      width: 440,
      onOpenChangeComplete: (open) => {
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
          <Button onClick={() => finish('cancel')}>{t('cancel', { ns: 'common' })}</Button>
          {fallback && !newTopic && (
            <Button
              type={fallbackPrimary ? 'primary' : 'default'}
              onClick={() => finish('selfHosted')}
            >
              {t('sandboxAccess.selfHosted', { ns: 'chat' })}
            </Button>
          )}
          <Button
            autoFocus
            type={fallbackPrimary && !newTopic ? 'default' : 'primary'}
            onClick={() => finish(newTopic ? 'new' : auth ? 'login' : 'retry')}
          >
            {t(
              newTopic
                ? 'sandboxAccess.newTopic'
                : auth
                  ? 'sandboxAccess.login'
                  : 'sandboxAccess.retry',
              { ns: 'chat' },
            )}
          </Button>
        </Flexbox>
      ),
    });
  });
