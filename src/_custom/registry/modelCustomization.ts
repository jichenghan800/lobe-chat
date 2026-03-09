import { getModelPropertyWithFallback } from '@lobechat/model-runtime';
import { type EnabledAiModel } from 'model-bank';

type ThinkingLevel3 = 'low' | 'medium' | 'high';

const TRUTHY_ENV_VALUES = new Set(['1', 'on', 'true', 'yes']);
const DESCRIPTION_ALIAS_SWITCH = 'NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE';

const isModelAliasDescriptionRewriteEnabled = () => {
  const rawValue = process.env[DESCRIPTION_ALIAS_SWITCH];
  if (rawValue === undefined) return true;

  return TRUTHY_ENV_VALUES.has(rawValue.trim().toLowerCase());
};

const normalizeAliasCandidate = (value?: string) => value?.replaceAll(/\s+/g, ' ').trim() || '';

const stripModelSuffix = (value: string) =>
  normalizeAliasCandidate(value.replaceAll(/\b(preview|experimental|exp)\b/gi, ''));

const stripMinorVersion = (value: string) =>
  normalizeAliasCandidate(value.replaceAll(/\b(\d+)\.(\d+)\b/g, '$1'));

const buildAliasCandidates = (fallbackDisplayName?: string) => {
  const normalizedDisplayName = normalizeAliasCandidate(fallbackDisplayName);
  if (!normalizedDisplayName) return [];

  const aliases = new Set<string>([
    normalizedDisplayName,
    stripModelSuffix(normalizedDisplayName),
    stripMinorVersion(normalizedDisplayName),
    stripMinorVersion(stripModelSuffix(normalizedDisplayName)),
  ]);

  return [...aliases].filter(Boolean).sort((a, b) => b.length - a.length);
};

export const getThinkingLevel3Default = (): ThinkingLevel3 => 'low';

export const resolveThinkingLevel3Param = (value?: ThinkingLevel3): ThinkingLevel3 =>
  value || getThinkingLevel3Default();

export const resolveModelDescriptionWithAlias = (params: {
  customDescription?: string;
  fallbackDescription?: string;
  fallbackDisplayName?: string;
  modelDisplayName?: string;
}) => {
  const { customDescription, fallbackDescription, fallbackDisplayName, modelDisplayName } = params;
  const description = customDescription ?? fallbackDescription;

  if (!description) return description;

  if (modelDisplayName && fallbackDisplayName && modelDisplayName !== fallbackDisplayName) {
    let rewrittenDescription = description;
    const aliases = isModelAliasDescriptionRewriteEnabled()
      ? buildAliasCandidates(fallbackDisplayName)
      : [normalizeAliasCandidate(fallbackDisplayName)];

    for (const alias of aliases) {
      if (!alias || alias === modelDisplayName || !rewrittenDescription.includes(alias)) continue;
      rewrittenDescription = rewrittenDescription.replaceAll(alias, modelDisplayName);
    }

    return rewrittenDescription;
  }

  return description;
};

export const resolveCustomizedModelDescription = async (params: {
  fallbackDescription?: string;
  model: EnabledAiModel;
}) => {
  const { fallbackDescription, model } = params;
  const customDescription = (model as EnabledAiModel & { description?: string }).description;

  const fallbackDisplayName = await getModelPropertyWithFallback<string | undefined>(
    model.id,
    'displayName',
    model.providerId,
  );

  return resolveModelDescriptionWithAlias({
    customDescription,
    fallbackDescription,
    fallbackDisplayName,
    modelDisplayName: model.displayName,
  });
};

export const resolveModelDetailDescription = (params: {
  modelId: string;
  fallbackDescription: string;
  modelDescription?: string;
}) => {
  const { fallbackDescription, modelDescription, modelId } = params;

  // i18n key fallback (e.g. "gemini-3-pro-preview.description") means locale text is missing.
  // In that case, prefer runtime model description.
  if (!fallbackDescription || fallbackDescription === `${modelId}.description`) {
    return modelDescription || fallbackDescription;
  }

  // Locale description exists: keep localized copy to avoid language regression.
  return fallbackDescription;
};
