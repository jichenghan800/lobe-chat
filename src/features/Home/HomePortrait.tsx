import { DEFAULT_INBOX_AVATAR } from '@lobechat/const';
import { Tooltip } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveChiefAgentArtwork } from '@/features/ChiefAgent/artwork';
import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';

import { resolveFeishuAdminContactUrl } from './feishuSupport';

const styles = createStaticStyles(({ css, cssVar }) => ({
  decorative: css`
    pointer-events: none;
    position: absolute;
    inset-block-end: -64px;
    inset-inline-end: 12px;
  `,
  // Anchored below the greeting row rather than above the rail, so the agent
  // stands the same distance into the first card however the greeting wraps.
  image: css`
    pointer-events: none;

    display: block;

    width: 152px;
    height: 152px;

    object-fit: contain;
  `,
  link: css`
    cursor: pointer;

    position: absolute;
    inset-block-end: -64px;
    inset-inline-end: 12px;

    width: 152px;
    height: 152px;
    border-radius: 24px;

    outline: none;

    transition: transform 160ms ease-out;

    &:hover {
      transform: translateY(-2px);
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  root: css`
    position: relative;
    height: 100%;
  `,
}));

const HomePortrait = memo(() => {
  const { t } = useTranslation('home');
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const inboxMeta = useAgentStore(agentSelectors.getAgentMetaById(inboxAgentId ?? ''));
  const artwork = resolveChiefAgentArtwork(inboxMeta.avatar || DEFAULT_INBOX_AVATAR);
  const supportUrl = resolveFeishuAdminContactUrl(process.env.NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL);

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
            <img alt="" className={styles.image} src={artwork.hero} />
          </a>
        </Tooltip>
      ) : (
        <img
          aria-hidden
          alt=""
          className={`${styles.image} ${styles.decorative}`}
          src={artwork.hero}
        />
      )}
    </div>
  );
});

export default HomePortrait;
