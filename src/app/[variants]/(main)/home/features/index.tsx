'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  shouldShowHomeCommunityAgents,
  shouldShowHomeRecentPages,
  shouldShowHomeRecentResources,
} from '@/_custom/registry/homeSections';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import CommunityAgents from './CommunityAgents';
import InputArea from './InputArea';
import RecentPage from './RecentPage';
import RecentResource from './RecentResource';
import RecentTopic from './RecentTopic';
import WelcomeText from './WelcomeText';

const Home = memo(() => {
  const { i18n } = useTranslation();
  const isLogin = useUserStore(authSelectors.isLogin);
  const { showMarket } = useServerConfigStore(featureFlagsSelectors);

  const showCommunityAgents = shouldShowHomeCommunityAgents(showMarket);
  const showRecentPages = shouldShowHomeRecentPages();
  const showRecentResources = shouldShowHomeRecentResources();

  const Welcome = useCallback(() => <WelcomeText />, [i18n.language]);

  return (
    <Flexbox gap={40}>
      <Welcome />
      <InputArea />
      {isLogin && <RecentTopic />}
      {isLogin && showRecentPages && <RecentPage />}
      {showCommunityAgents && <CommunityAgents />}
      {/*<FeaturedPlugins />*/}
      {isLogin && showRecentResources && <RecentResource />}
    </Flexbox>
  );
});

export default Home;
