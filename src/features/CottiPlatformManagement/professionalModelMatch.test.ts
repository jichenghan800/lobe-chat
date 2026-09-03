import { describe, expect, it } from 'vitest';

import { getProfessionalModelMatchOptions } from './professionalModelMatch';

describe('professional model match field', () => {
  it('offers both deployed Gemini professional models but excludes normal pool models', () => {
    expect(
      getProfessionalModelMatchOptions([
        {
          label: 'Gemini 3.6 Flash',
          model: 'gemini-3.6-flash',
          provider: 'vertexai',
        },
        {
          label: 'Gemini 3.7 Flash',
          model: 'gemini-3.7-flash',
          provider: 'vertexai',
        },
        {
          label: 'Gemini 3.8 Flash',
          model: 'gemini-3.8-flash',
          provider: 'vertexai',
        },
        { label: 'GLM 5.3', model: 'ZHIPU/GLM-5.3', provider: 'qwen' },
      ]),
    ).toEqual([
      { label: 'Gemini 3.6 Flash', value: 'gemini-3.6-flash' },
      { label: 'Gemini 3.7 Flash', value: 'gemini-3.7-flash' },
      { label: 'Gemini 3.8 Flash', value: 'gemini-3.8-flash' },
    ]);
  });
});
