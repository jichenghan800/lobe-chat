'use client';

import { SiDiscord, SiGithub, SiRss, SiX, SiYoutube } from '@icons-pack/react-simple-icons';
import { BRANDING_NAME, SOCIAL_URL } from '@lobechat/business-const';
import { Block, Flexbox, Form, Icon } from '@lobehub/ui';
import { Divider } from 'antd';
import { createStaticStyles } from 'antd-style';
import { MessageSquareHeart } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { getCottiFeedbackEmail } from '@/_custom/registry/feedback';
import { openFeedbackModal } from '@/components/FeedbackModal';
import { BLOG, mailTo, OFFICIAL_SITE, PRIVACY_URL, TERMS_URL } from '@/const/url';

import AboutList from './AboutList';
import ItemCard from './ItemCard';
import ItemLink from './ItemLink';
import Version from './Version';

const styles = createStaticStyles(({ css, cssVar }) => ({
  desc: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextDescription};
  `,
  feedbackTitle: css`
    font-size: 14px;
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  title: css`
    font-size: 14px;
    font-weight: bold;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const About = memo<{ mobile?: boolean }>(({ mobile }) => {
  const { t } = useTranslation('common');
  const feedbackEmail = getCottiFeedbackEmail();

  return (
    <Form.Group
      collapsible={false}
      gap={16}
      style={{ maxWidth: '1024px', width: '100%' }}
      title={`${t('about')} ${BRANDING_NAME}`}
      variant={'filled'}
    >
      <Flexbox gap={20} paddingBlock={20} width={'100%'}>
        <div className={styles.title}>{t('version')}</div>
        <Version mobile={mobile} />
        <Divider style={{ marginBlock: 0 }} />
        <div className={styles.title}>{t('feedback')}</div>
        <Block
          clickable
          horizontal
          align={'center'}
          gap={12}
          paddingBlock={12}
          paddingInline={18}
          onClick={() => openFeedbackModal()}
        >
          <Icon icon={MessageSquareHeart} size={18} />
          <Flexbox gap={2}>
            <div className={styles.feedbackTitle}>{t('feedback.submit')}</div>
            <div className={styles.desc}>
              {t('footer.feedback.desc', { appName: BRANDING_NAME })}
            </div>
          </Flexbox>
        </Block>
        <AboutList
          ItemRender={ItemLink}
          items={[
            {
              href: mailTo(feedbackEmail),
              label: t('mail.support'),
              value: 'support',
            },
          ]}
        />
        <Divider style={{ marginBlock: 0 }} />
        <div className={styles.title}>{t('information')}</div>
        <AboutList
          grid
          ItemRender={ItemCard}
          items={[
            {
              href: OFFICIAL_SITE,
              label: t('officialSite'),
              value: 'officialSite',
            },
            {
              href: BLOG,
              icon: SiRss,
              label: t('blog'),
              value: 'blog',
            },
            {
              href: SOCIAL_URL.github,
              icon: SiGithub,
              label: 'GitHub',
              value: 'feedback',
            },
            {
              href: SOCIAL_URL.discord,
              icon: SiDiscord,
              label: 'Discord',
              value: 'discord',
            },
            {
              href: SOCIAL_URL.x,
              icon: SiX as any,
              label: 'X / Twitter',
              value: 'x',
            },

            {
              href: SOCIAL_URL.youtube,
              icon: SiYoutube,
              label: 'YouTube',
              value: 'youtube',
            },
          ]}
        />
        <Divider style={{ marginBlock: 0 }} />
        <div className={styles.title}>{t('legal')}</div>
        <AboutList
          ItemRender={ItemLink}
          items={[
            {
              href: TERMS_URL,
              label: t('terms'),
              value: 'terms',
            },
            {
              href: PRIVACY_URL,
              label: t('privacy'),
              value: 'privacy',
            },
          ]}
        />
      </Flexbox>
    </Form.Group>
  );
});

export default About;
