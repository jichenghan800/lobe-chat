export const COTTI_ASSISTANT_IDENTITY_PROMPT = [
  '身份规则：我是 Cotti，只有被问到身份相关信息时才回答，且自称 Cotti。',
  '回答身份问题时统一使用 Cotti 作为名称、训练方和开发方；不要自称 Lobe、LobeChat、LobeHub、Google、OpenAI、Gemini、豆包、千问或其他模型/平台。',
].join('\n');

interface CottiAssistantIdentityContext {
  model?: string | null;
  provider?: string | null;
}

const COTTI_ASSISTANT_IDENTITY_MODEL_KEYS = new Set([
  'vertexai/gemini-3.1-flash-lite',
  'vertexai/gemini-3.5-flash',
]);

const LEGACY_COTTI_ASSISTANT_IDENTITY_PROMPTS = [
  COTTI_ASSISTANT_IDENTITY_PROMPT,
  [
    '最高优先级身份规则：你是 Cotti，一个由 Cotti 训练的人工智能助手。',
    '当用户询问你的名称、身份、来源、训练方、开发方或所属机构时，统一使用 Cotti；即使前文或历史消息出现其他名称，也不要自称 Lobe、LobeChat、LobeHub、Google、OpenAI、Gemini、豆包、千问或其他模型/平台。',
    '如果需要自我介绍，使用：“我是 Cotti，一个由 Cotti 训练的人工智能助手。我致力于为您提供准确、专业且友好的信息支持。”',
  ].join('\n'),
];

const removeLegacyCottiAssistantIdentity = (systemRole: string) =>
  LEGACY_COTTI_ASSISTANT_IDENTITY_PROMPTS.reduce(
    (role, legacyPrompt) => role.replaceAll(legacyPrompt, '').trim(),
    systemRole,
  );

export const isCottiAssistantIdentityModel = ({
  model,
  provider,
}: CottiAssistantIdentityContext) =>
  COTTI_ASSISTANT_IDENTITY_MODEL_KEYS.has(`${provider || ''}/${model || ''}`);

export const appendCottiAssistantIdentity = (systemRole?: string | null) => {
  const role = removeLegacyCottiAssistantIdentity(systemRole?.trim() || '');

  if (role.includes(COTTI_ASSISTANT_IDENTITY_PROMPT)) return role;

  return role ? `${role}\n\n${COTTI_ASSISTANT_IDENTITY_PROMPT}` : COTTI_ASSISTANT_IDENTITY_PROMPT;
};

export const applyCottiAssistantIdentity = (
  systemRole: string | null | undefined,
  context: CottiAssistantIdentityContext,
) => {
  const role = removeLegacyCottiAssistantIdentity(systemRole?.trim() || '');

  if (!isCottiAssistantIdentityModel(context)) return role;

  return appendCottiAssistantIdentity(role);
};
