import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { getOverviewMessageModels } from './messageModels';

const message = (props: Partial<UIChatMessage>) =>
  ({
    id: 'test',
    role: 'assistant',
    content: '',
    createdAt: 0,
    updatedAt: 0,
    ...props,
  }) as UIChatMessage;

describe('getOverviewMessageModels', () => {
  it('uses each reply identity after switching models', () => {
    expect(getOverviewMessageModels(message({ model: 'model-a', provider: 'azure' }))).toEqual([
      'azure/model-a',
    ]);
    expect(getOverviewMessageModels(message({ model: 'model-b', provider: 'vertexai' }))).toEqual([
      'vertexai/model-b',
    ]);
  });
  it('retains distinct models in grouped agent steps and marks missing identities', () => {
    expect(
      getOverviewMessageModels(
        message({
          role: 'assistantGroup',
          members: [
            message({ model: 'a', provider: 'p' }),
            message({ model: 'a', provider: 'p' }),
            message({ model: 'b', provider: 'q' }),
            message({}),
          ],
        }),
      ),
    ).toEqual(['p/a', 'q/b', '']);
  });
  it('resolves virtual workflow blocks against the original replies', () => {
    expect(
      getOverviewMessageModels(
        message({
          role: 'assistantGroup',
          children: [
            { id: 'a', content: '' },
            { id: 'b', content: '' },
          ],
        }),
        [
          message({ id: 'a', model: 'first', provider: 'p' }),
          message({ id: 'b', model: 'second', provider: 'q' }),
        ],
      ),
    ).toEqual(['p/first', 'q/second']);
  });
  it('does not attribute a model to user questions or tools', () => {
    expect(getOverviewMessageModels(message({ role: 'user', model: 'default' }))).toEqual([]);
    expect(getOverviewMessageModels(message({ role: 'tool' }))).toEqual([]);
  });
});
