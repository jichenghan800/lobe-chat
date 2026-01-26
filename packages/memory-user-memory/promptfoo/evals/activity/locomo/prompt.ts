import { PromptVars, buildLocomoActivityMessages } from './buildMessages';

export default async function generatePrompt({ vars }: { vars: PromptVars }) {
  return buildLocomoActivityMessages(vars);
}
