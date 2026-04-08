import { ModelIcon } from '@lobehub/icons';
import { Tag } from '@lobehub/ui';
import type { ComponentProps } from 'react';
import { memo } from 'react';

import { useModelDisplayName } from '@/_custom/hooks/useModelDisplayName';

type TagProps = Omit<ComponentProps<typeof Tag>, 'children' | 'icon'>;

interface ModelDisplayNameTagProps extends TagProps {
  model: string;
  provider?: string;
  type?: 'mono' | 'color' | 'avatar';
}

const ModelDisplayNameTag = memo<ModelDisplayNameTagProps>(
  ({ model, provider, type = 'mono', ...rest }) => {
    const displayName = useModelDisplayName(model, provider) || model;
    const title = displayName === model ? displayName : `${displayName} (${model})`;

    return (
      <Tag icon={<ModelIcon model={model} type={type} />} title={title} {...rest}>
        {displayName}
      </Tag>
    );
  },
);

ModelDisplayNameTag.displayName = 'ModelDisplayNameTag';

export default ModelDisplayNameTag;
