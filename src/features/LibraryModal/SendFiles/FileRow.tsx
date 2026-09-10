import { Flexbox } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FileIcon from '@/components/FileIcon';
import { useFileStore } from '@/store/file';
import type { FileListItem } from '@/types/files';

const styles = createStaticStyles(({ css }) => ({
  row: css`
    min-height: 56px;
    padding-block: 8px;
    padding-inline: 12px;
    border-radius: ${cssVar.borderRadius};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

interface FileRowProps {
  item: FileListItem;
}

const FileRow = memo<FileRowProps>(({ item }) => {
  const { t } = useTranslation('chat');
  const [loading, setLoading] = useState(false);
  const fileId = item.fileId ?? item.id;
  const attached = useFileStore((s) => s.chatUploadFileList.some((file) => file.id === fileId));
  const attachResourceFilesToChat = useFileStore((s) => s.attachResourceFilesToChat);

  const handleAttach = async () => {
    setLoading(true);
    try {
      await attachResourceFilesToChat([item.id]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flexbox horizontal align={'center'} className={styles.row} gap={10}>
      <FileIcon fileName={item.name} fileType={item.fileType} size={32} />
      <Flexbox flex={1} style={{ minWidth: 0 }}>
        <Text ellipsis>{item.name}</Text>
      </Flexbox>
      <Button
        disabled={attached}
        loading={loading}
        size={'small'}
        type={attached ? 'default' : 'primary'}
        onClick={handleAttach}
      >
        {t(attached ? 'attachment.selected' : 'attachment.sendWithMessage')}
      </Button>
    </Flexbox>
  );
});

FileRow.displayName = 'FileRow';

export default FileRow;
