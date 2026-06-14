'use client';

import { memo } from 'react';
import { Navigate } from 'react-router-dom';

import { isVideoGenerationHidden } from '@/_custom/registry/generationVisibility';
import CreateGenerationPage from '@/routes/(main)/(create)/features/CreateGenerationPage';

import PromptInput from './features/PromptInput';
import VideoWorkspace from './features/VideoWorkspace';

const DesktopVideoPage = memo(() => {
  if (isVideoGenerationHidden()) return <Navigate replace to="/image" />;

  return (
    <CreateGenerationPage PromptInput={PromptInput} Workspace={VideoWorkspace} path="/video" />
  );
});

DesktopVideoPage.displayName = 'DesktopVideoPage';

export default DesktopVideoPage;
