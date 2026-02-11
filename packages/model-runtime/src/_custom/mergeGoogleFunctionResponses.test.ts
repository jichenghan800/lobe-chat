// @vitest-environment node
import { Content } from '@google/genai';
import { describe, expect, it } from 'vitest';

import { mergeGoogleFunctionResponses } from './mergeGoogleFunctionResponses';

describe('mergeGoogleFunctionResponses', () => {
  it('should merge consecutive functionResponse user turns', () => {
    const input: Content[] = [
      {
        parts: [
          {
            functionCall: {
              args: { location: 'Hangzhou' },
              name: 'getWeather',
            },
          },
          {
            functionCall: {
              args: { product: 'coffee beans' },
              name: 'getInventory',
            },
          },
        ],
        role: 'model',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'getWeather',
              response: { result: '{"temp":24}' },
            },
          },
        ],
        role: 'user',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'getInventory',
              response: { result: '{"stock":1024}' },
            },
          },
        ],
        role: 'user',
      },
    ];

    expect(mergeGoogleFunctionResponses(input)).toEqual([
      input[0],
      {
        parts: [
          {
            functionResponse: {
              name: 'getWeather',
              response: { result: '{"temp":24}' },
            },
          },
          {
            functionResponse: {
              name: 'getInventory',
              response: { result: '{"stock":1024}' },
            },
          },
        ],
        role: 'user',
      },
    ]);
  });

  it('should not merge across normal user text turns', () => {
    const input: Content[] = [
      {
        parts: [
          {
            functionResponse: {
              name: 'toolA',
              response: { result: 'A' },
            },
          },
        ],
        role: 'user',
      },
      {
        parts: [{ text: 'continue' }],
        role: 'user',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'toolB',
              response: { result: 'B' },
            },
          },
        ],
        role: 'user',
      },
    ];

    expect(mergeGoogleFunctionResponses(input)).toEqual(input);
  });

  it('[HOTFIX-P0] should merge three consecutive functionResponse user turns with stable order', () => {
    const input: Content[] = [
      {
        parts: [
          {
            functionResponse: {
              name: 'toolA',
              response: { result: 'A' },
            },
          },
        ],
        role: 'user',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'toolB',
              response: { result: 'B' },
            },
          },
        ],
        role: 'user',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'toolC',
              response: { result: 'C' },
            },
          },
        ],
        role: 'user',
      },
    ];

    expect(mergeGoogleFunctionResponses(input)).toEqual([
      {
        parts: [
          {
            functionResponse: {
              name: 'toolA',
              response: { result: 'A' },
            },
          },
          {
            functionResponse: {
              name: 'toolB',
              response: { result: 'B' },
            },
          },
          {
            functionResponse: {
              name: 'toolC',
              response: { result: 'C' },
            },
          },
        ],
        role: 'user',
      },
    ]);
  });

  it('[HOTFIX-P0] should not merge when functionResponse turn includes non-functionResponse parts', () => {
    const input: Content[] = [
      {
        parts: [
          {
            functionResponse: {
              name: 'toolA',
              response: { result: 'A' },
            },
          },
        ],
        role: 'user',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'toolMixed',
              response: { result: 'mixed' },
            },
          },
          { text: 'non-tool-part' },
        ],
        role: 'user',
      },
      {
        parts: [
          {
            functionResponse: {
              name: 'toolB',
              response: { result: 'B' },
            },
          },
        ],
        role: 'user',
      },
    ];

    expect(mergeGoogleFunctionResponses(input)).toEqual(input);
  });
});
