'use client';

import { Modal, Text } from '@lobehub/ui';
import { Input } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ManualCallbackModalProps {
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  open: boolean;
}

const ManualCallbackModal = memo<ManualCallbackModalProps>(
  ({ open, onCancel, onSubmit, loading }) => {
    const { t } = useTranslation('marketAuth');
    const [value, setValue] = useState('');

    useEffect(() => {
      if (open) setValue('');
    }, [open]);

    return (
      <Modal
        centered
        cancelText={t('manual.actions.cancel')}
        confirmLoading={loading}
        okText={t('manual.actions.submit')}
        open={open}
        title={t('manual.title')}
        width={520}
        onCancel={onCancel}
        onOk={() => onSubmit(value)}
      >
        <Text type={'secondary'}>{t('manual.description')}</Text>
        <Input.TextArea
          allowClear
          placeholder={t('manual.input.placeholder')}
          rows={4}
          style={{ marginTop: 12 }}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Modal>
    );
  },
);

ManualCallbackModal.displayName = 'ManualCallbackModal';

export default ManualCallbackModal;
