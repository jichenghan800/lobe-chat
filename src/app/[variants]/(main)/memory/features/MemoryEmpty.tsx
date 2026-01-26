import { Center, Empty, type EmptyProps, Flexbox } from '@lobehub/ui';
import { BrainCircuitIcon } from 'lucide-react';
import { ReactNode, memo } from 'react';
import { useTranslation } from 'react-i18next';

const MemoryEmpty = memo<EmptyProps & { children?: ReactNode | ReactNode[]; search?: boolean }>(
  ({ search, title, children, ...rest }) => {
    const { t } = useTranslation('memory');
    return (
      <Center height="100%" style={{ minHeight: '50vh' }} width="100%">
        <Flexbox align="center" gap={12}>
          <Empty
            description={search ? t('empty.search') : t('empty.description')}
            descriptionProps={{
              fontSize: 14,
            }}
            icon={BrainCircuitIcon}
            style={{
              maxWidth: 550,
            }}
            title={search ? undefined : title || t('empty.title')}
            type={search ? 'default' : 'page'}
            {...rest}
          >
            <Flexbox>{children}</Flexbox>
          </Empty>
        </Flexbox>
      </Center>
    );
  },
);

export default MemoryEmpty;
