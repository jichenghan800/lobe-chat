import { Content, Part } from '@google/genai';

const isFunctionResponsePart = (part: Part): boolean => !!part.functionResponse;

const isPureFunctionResponseTurn = (content: Content): boolean => {
  if (content.role !== 'user') return false;
  if (!content.parts?.length) return false;

  return content.parts.every(isFunctionResponsePart);
};

/**
 * Vertex/Gemini expects a single user turn with N functionResponse parts
 * right after a model turn with N functionCall parts.
 *
 * This merges consecutive tool-response user turns into one.
 */
export const mergeGoogleFunctionResponses = (contents: Content[]): Content[] => {
  const merged: Content[] = [];

  for (const content of contents) {
    const previous = merged.at(-1);

    if (previous && isPureFunctionResponseTurn(previous) && isPureFunctionResponseTurn(content)) {
      previous.parts = [...(previous.parts || []), ...(content.parts || [])];
      continue;
    }

    merged.push(content);
  }

  return merged;
};
