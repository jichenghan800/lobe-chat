import type { HomeNewModelItem } from '@/business/client/hooks/useHomeNewModels';

// Chat
export const COTTI_FAST_MODEL = 'gemini-3.5-flash-lite';
export const COTTI_FAST_MODEL_NAME = 'COTTI-快速';
export const NEW_CHAT_MODEL = 'gpt-5.6-terra';
export const NEW_CHAT_MODEL_NAME = 'GPT-5.6 Terra';

export const BUSINESS_CHAT_PROVIDER = 'lobehub';
export const OSS_CHAT_PROVIDER = 'vertexai';
export const NEW_CHAT_PROVIDER = 'azure';

// Image
export const NEW_IMAGE_MODEL = 'gpt-image-2.5-flare';
export const NEW_IMAGE_MODEL_NAME = 'GPT Image 2.5 Flare';

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
    model: NEW_CHAT_MODEL,
    provider: NEW_CHAT_PROVIDER,
    title: NEW_CHAT_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_IMAGE_MODEL,
    title: NEW_IMAGE_MODEL_NAME,
    type: 'image',
  },
  {
    model: NEW_VIDEO_MODEL,
    title: NEW_VIDEO_MODEL_NAME,
    type: 'video',
  },
] as const satisfies HomeNewModelItem[];

export const OSS_HOME_NEW_MODELS = [
  {
    model: COTTI_FAST_MODEL,
    provider: OSS_CHAT_PROVIDER,
    title: COTTI_FAST_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_CHAT_MODEL,
    provider: NEW_CHAT_PROVIDER,
    title: NEW_CHAT_MODEL_NAME,
    type: 'chat',
  },
  {
    model: NEW_IMAGE_MODEL,
    title: NEW_IMAGE_MODEL_NAME,
    type: 'image',
  },
  {
    model: NEW_VIDEO_MODEL,
    title: NEW_VIDEO_MODEL_NAME,
    type: 'video',
  },
] as const satisfies HomeNewModelItem[];
