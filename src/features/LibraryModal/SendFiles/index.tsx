import { createModal, type ModalInstance } from '@lobehub/ui/base-ui';
import { t } from 'i18next';

import List from './List';

export const openSendFilesModal = (): ModalInstance =>
  createModal({
    content: <List />,
    footer: false,
    styles: { content: { overflow: 'hidden' } },
    title: t('attachment.pickerTitle', { ns: 'chat' }),
    width: 600,
  });
