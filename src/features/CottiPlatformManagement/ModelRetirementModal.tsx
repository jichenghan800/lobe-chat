'use client';

import { createModal, useModalContext } from '@lobehub/ui/base-ui';
import { t } from 'i18next';
import type { ComponentProps } from 'react';

import TaskModelMigration from './TaskModelMigration';

type Props = ComponentProps<typeof TaskModelMigration>;

const ModelRetirementContent = (props: Props) => {
  const { close } = useModalContext();
  return (
    <TaskModelMigration
      {...props}
      embedded
      onSaved={async (config) => {
        await props.onSaved(config);
        close();
      }}
    />
  );
};

/** Keep the retirement decision next to the clicked switch; opening it never disables a model. */
export const openModelRetirementModal = (props: Props) =>
  createModal({
    content: <ModelRetirementContent {...props} />,
    footer: null,
    maskClosable: false,
    title: t(
      props.groupId
        ? 'platformManagement.models.groups.retireTitle'
        : 'platformManagement.models.migration.title',
      { ns: 'setting' },
    ),
    width: 'min(92vw, 760px)',
  });
