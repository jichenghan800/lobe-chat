/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import ConfigAction from './ConfigAction';
import GenerationMediaModeSegment from './GenerationMediaModeSegment';

interface SegmentedCapture {
  classNames?: { item?: string; itemLabel?: string };
  onChange?: (value: string) => void;
  options?: Array<{ icon?: ReactNode; label?: ReactNode; value: string }>;
  value?: string;
}

const componentMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  segmented: undefined as SegmentedCapture | undefined,
}));

vi.mock('@lobehub/ui/base-ui', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  ActionIcon: ({ title }: { title?: ReactNode }) => (
    <button aria-label={typeof title === 'string' ? title : 'action'} type="button" />
  ),
  Segmented: (props: SegmentedCapture) => {
    componentMocks.segmented = props;
    return (
      <div data-testid="mode-toggle-group">
        {props.options?.map((option) => (
          <span key={option.value}>{option.icon}</span>
        ))}
      </div>
    );
  },
  Select: () => <div data-testid="mode-select" />,
}));

vi.mock('antd-style', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createStaticStyles: () => ({
    heroSelect: 'hero-select',
    heroText: 'hero-text',
    toolbarItem: 'toolbar-item',
    toolbarLabel: 'toolbar-label',
  }),
}));

vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => componentMocks.navigate,
}));

vi.mock('@/features/ChatInput/ActionBar/components/ActionDropdown', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/ChatInput/ActionBar/components/ActionPopover', () => ({
  default: ({ children, content }: { children: ReactNode; content?: ReactNode }) => (
    <div>
      {children}
      {content}
    </div>
  ),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: <T,>(selector: (state: { isMobile: boolean }) => T) =>
    selector({ isMobile: false }),
}));

describe('GenerationMediaModeSegment', () => {
  it('hides the toolbar media switch', () => {
    render(<GenerationMediaModeSegment mode="image" />);
    expect(screen.queryByTestId('mode-toggle-group')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mode-select')).not.toBeInTheDocument();
    expect(screen.queryByText('tab.video')).not.toBeInTheDocument();
  });

  it('retains a static image heading without a video selector', () => {
    render(<GenerationMediaModeSegment layout="hero" mode="image" />);
    expect(screen.getByText('tab.image')).toBeInTheDocument();
    expect(screen.queryByTestId('mode-select')).not.toBeInTheDocument();
  });
});

describe('generation toolbar actions', () => {
  it('renders without a ChatInputProvider', () => {
    render(<ConfigAction content={<span>config-content</span>} title="config-title" />);

    expect(screen.getByRole('button', { name: 'config-title' })).toBeInTheDocument();
    expect(screen.getByText('config-content')).toBeInTheDocument();
  });
});
