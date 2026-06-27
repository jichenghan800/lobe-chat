import type { HomeNewModelItem } from '@/business/client/hooks/useHomeNewModels';

// Chat
export const COTTI_FAST_MODEL = 'gemini-3.1-flash-lite';
export const COTTI_FAST_MODEL_NAME = 'COTTI-快速';
export const COTTI_PRO_MODEL = 'gemini-3.5-flash';
export const COTTI_PRO_MODEL_NAME = 'COTTI-专业';

export const BUSINESS_CHAT_PROVIDER = 'lobehub';
export const OSS_CHAT_PROVIDER = 'vertexai';

// Image
export const NEW_IMAGE_MODEL = 'gpt-image-2';
export const NEW_IMAGE_MODEL_NAME = 'GPT Image 2';
export const NEW_IMAGE_PROVIDER = 'azure';

// Video
export const NEW_VIDEO_MODEL = 'dreamina-seedance-2-0-260128';
export const NEW_VIDEO_MODEL_NAME = 'Seedance 2.0';

export const BUSINESS_HOME_NEW_MODELS = [
  {
    model: COTTI_FAST_MODEL,
    provider: BUSINESS_CHAT_PROVIDER,
    title: COTTI_FAST_MODEL_NAME,
    type: 'chat',
  },
  {
    model: COTTI_PRO_MODEL,
    provider: BUSINESS_CHAT_PROVIDER,
    title: COTTI_PRO_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_IMAGE_MODEL,
    provider: NEW_IMAGE_PROVIDER,
    title: NEW_IMAGE_MODEL_NAME,
    type: 'image',
  },
  {
    model: NEW_VIDEO_MODEL,
    title: NEW_VIDEO_MODEL_NAME,
    type: 'video',
  },
] satisfies HomeNewModelItem[];

export const OSS_HOME_NEW_MODELS = [
  {
    model: COTTI_FAST_MODEL,
    provider: OSS_CHAT_PROVIDER,
    title: COTTI_FAST_MODEL_NAME,
    type: 'chat',
  },
  {
    model: COTTI_PRO_MODEL,
    provider: OSS_CHAT_PROVIDER,
    title: COTTI_PRO_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_IMAGE_MODEL,
    provider: NEW_IMAGE_PROVIDER,
    title: NEW_IMAGE_MODEL_NAME,
    type: 'image',
  },
  {
    model: NEW_VIDEO_MODEL,
    title: NEW_VIDEO_MODEL_NAME,
    type: 'video',
  },
] satisfies HomeNewModelItem[];
