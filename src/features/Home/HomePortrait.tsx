import { DEFAULT_INBOX_AVATAR } from '@lobechat/const';
import { Tooltip } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveChiefAgentArtwork } from '@/features/ChiefAgent/artwork';
import { useAgentStore } from '@/store/agent';
import { agentSelectors } from '@/store/agent/selectors';

import { useResolvedHomeAgentId } from './AgentSelect/useResolvedHomeAgentId';
import { resolveFeishuAdminContactUrl } from './feishuSupport';

const styles = createStaticStyles(({ css, cssVar }) => ({
  // Match the compact production frame. Keep the studio preview crop in sync
  // with the 152px frame, 64px overlap and 24px grid gap (portraitFraming).
  image: css`
    pointer-events: none;

    position: absolute;
    inset-block-end: -64px;
    inset-inline-end: 12px;

    width: 152px;
    height: 152px;

    object-fit: contain;
    object-position: bottom;
  `,
  link: css`
    pointer-events: auto;
    cursor: pointer;

    position: absolute;
    inset-block-end: -64px;
    inset-inline-end: 12px;

    width: 152px;
    height: 152px;
    border-radius: 24px;

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }

    & > img {
      inset-block-end: 0;
      inset-inline-end: 0;
    }
  `,
  root: css`
    position: relative;
    height: 100%;
  `,
}));

const HomePortrait = memo(() => {
  const { t } = useTranslation('home');
  const supportUrl = resolveFeishuAdminContactUrl(process.env.NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL);
  // The portrait depicts whoever home is addressing, so it follows the same
  // selection the composer sends to — not the Inbox Agent it defaults to.
  const { agentId } = useResolvedHomeAgentId();
  const useFetchAgentConfig = useAgentStore((s) => s.useFetchAgentConfig);
  // A freshly picked agent may not be in the store yet; without this the
  // portrait would silently stay on the previous one's artwork.
  useFetchAgentConfig(true, agentId ?? '');

  const meta = useAgentStore(agentSelectors.getAgentMetaById(agentId ?? ''));
  // An agent that has been through the artwork studio shows its own character;
  // the built-in catalog covers everyone else.
  const fullBodyArtwork = useAgentStore(agentSelectors.getAgentFullBodyArtworkById(agentId ?? ''));
  const artwork = resolveChiefAgentArtwork(meta.avatar || DEFAULT_INBOX_AVATAR);
  const hero = fullBodyArtwork || artwork.hero;

  return (
    <div className={styles.root}>
      {supportUrl ? (
        <Tooltip title={t('dashboard.support.feishu.tooltip')}>
          <a
            aria-label={t('dashboard.support.feishu.action')}
            className={styles.link}
            href={supportUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <img alt="" className={styles.image} key={hero} src={hero} />
          </a>
        </Tooltip>
      ) : (
        <img aria-hidden alt="" className={styles.image} key={hero} src={hero} />
      )}
    </div>
  );
});

export default HomePortrait;
