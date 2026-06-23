const DEFAULT_HIDDEN_STARTER_MODELS = ['deepseek-v4-pro', 'image'] as const;
const DEFAULT_HIDDEN_BLOCKS = [] as const;

type HomeBlock = 'botIntegrationBanner' | 'messengerBanner' | 'recommendations' | 'starterList';

const parseHiddenStarterModels = () => {
  const raw = process.env.NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS;

  const entries = (raw ? raw.split(/[,;]/) : DEFAULT_HIDDEN_STARTER_MODELS)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return new Set(entries);
};

const HIDDEN_STARTER_MODELS = parseHiddenStarterModels();

export const isHomeStarterModelHidden = (model: string) => HIDDEN_STARTER_MODELS.has(model);

const parseHiddenBlocks = () => {
  const raw = process.env.NEXT_PUBLIC_COTTI_HOME_HIDDEN_BLOCKS;

  const entries = (raw ? raw.split(/[,;]/) : DEFAULT_HIDDEN_BLOCKS)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return new Set(entries);
};

const HIDDEN_BLOCKS = parseHiddenBlocks();

export const isHomeBlockHidden = (block: HomeBlock) => HIDDEN_BLOCKS.has(block);
