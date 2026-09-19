import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelDisplaySettings from './ModelDisplaySettings';

const mocks = vi.hoisted(() => ({ modal: vi.fn(), save: vi.fn(), scroll: vi.fn() }));
const config = {
  agent: [{ enabled: true, model: 'test-model', provider: 'openai' }],
  chat: [{ enabled: true, model: 'test-model', provider: 'openai' }],
};
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@lobehub/ui', () => ({
  Block: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Flexbox: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Empty: () => null,
  Icon: () => null,
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  createModal: mocks.modal,
  Button: ({ children, onClick, disabled }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Select: () => null,
  Skeleton: () => null,
  Switch: ({
    checked,
    disabled,
    onChange,
  }: {
    checked: boolean;
    disabled?: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      aria-checked={checked}
      disabled={disabled}
      role="switch"
      onClick={() => onChange(!checked)}
    />
  ),
  Tabs: ({
    items,
    onChange,
  }: {
    items: Array<{ key: string; label: string }>;
    onChange: (key: string) => void;
  }) => (
    <div>
      {items.map((i) => (
        <button key={i.key} onClick={() => onChange(i.key)}>
          {i.label}
        </button>
      ))}
    </div>
  ),
  Text: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Tag: ({ children }: PropsWithChildren) => <span>{children}</span>,
  toast: { warning: vi.fn(), error: vi.fn() },
}));
vi.mock('antd', () => ({ Input: () => null }));
vi.mock('@/components/AsyncError', () => ({ default: () => null }));
vi.mock('./ProfessionalModelMatchField', () => ({ ProfessionalModelMatchField: () => null }));
vi.mock('./TaskModelMigration', () => ({ default: () => <div id="global-model-retirement" /> }));
vi.mock('@/services/cottiModelDisplay', () => ({ cottiModelDisplayService: {} }));
vi.mock('@/services/cottiUsers', () => ({ cottiUsersService: {} }));
vi.mock('@/store/aiInfra', () => ({ useAiInfraStore: { getState: vi.fn() } }));
vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (key: string[]) => ({
    data:
      key[1] === 'model-management-groups'
        ? [{ id: 'pressure', name: 'Pressure group', provider: 'openai' }]
        : key[1] === 'model-display-options'
          ? [{ model: 'test-model', provider: 'openai', label: 'Test model' }]
          : config,
    mutate: vi.fn(),
  }),
}));
vi.mock('./useConfigAutosave', () => ({
  useConfigAutosave: () => ({ draft: config, saving: false, status: 'saved', save: mocks.save }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = mocks.scroll;
});

describe('model availability switch', () => {
  it.each([false, true])(
    'opens retirement at the clicked model instead of scrolling (group=%s)',
    async (group) => {
      render(<ModelDisplaySettings />);
      if (group) fireEvent.click(screen.getByText('Pressure group'));
      fireEvent.click(screen.getByRole('switch', { checked: true }));
      await waitFor(() => expect(mocks.modal).toHaveBeenCalledOnce());
      const modal = mocks.modal.mock.calls[0][0];
      expect(modal.content.props).toMatchObject({
        groupId: group ? 'pressure' : undefined,
        requestedSource: JSON.stringify(['openai', 'test-model']),
      });
      expect(mocks.scroll).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
      expect(screen.getByRole('switch', { checked: true })).toBeTruthy();
    },
  );
});
