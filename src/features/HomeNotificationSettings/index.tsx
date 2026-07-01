'use client';

import { Button, Flexbox, FormGroup, Icon, Skeleton, Text, TextArea } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { BellRing, RotateCcw, Save } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { homeKeys } from '@/libs/swr/keys';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { homeNotificationService } from '@/services/homeNotification';

const DEFAULT_CONTENT = '已进入待命状态\n带着新问题来了吧';

const styles = createStaticStyles(({ css, cssVar }) => ({
  muted: css`
    color: ${cssVar.colorTextDescription};
  `,
  panel: css`
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  panelIcon: css`
    display: grid;
    flex: none;
    place-items: center;

    width: 32px;
    height: 32px;
    border-radius: 8px;

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorFillQuaternary};
  `,
  preview: css`
    min-height: 3.2em;
    padding: 12px;
    border-radius: 8px;

    font-size: 16px;
    line-height: 1.6;
    white-space: pre-wrap;

    background: ${cssVar.colorFillQuaternary};
  `,
}));

const HomeNotificationSettings = memo(() => {
  const { message } = App.useApp();
  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [saving, setSaving] = useState(false);

  const {
    data,
    error,
    isLoading,
    mutate: mutateSettings,
  } = useClientDataSWR(homeKeys.notification(), () => homeNotificationService.getDetail());

  useEffect(() => {
    if (!data) return;

    setEnabled(data.enabled);
    setContent(data.content || DEFAULT_CONTENT);
  }, [data]);

  useEffect(() => {
    if (!error) return;

    void message.error('首页通知配置加载失败，请确认当前账号有管理员权限');
  }, [error, message]);

  const handleSave = async () => {
    const nextContent = content.trim();
    if (enabled && !nextContent) {
      void message.warning('开启通知前请填写通知内容');
      return;
    }

    setSaving(true);
    try {
      await homeNotificationService.update({
        content: nextContent || DEFAULT_CONTENT,
        enabled,
      });
      await mutateSettings();
      void message.success('首页通知配置已更新');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '首页通知配置更新失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingHeader title="首页通知" />
      <Flexbox gap={24}>
        <Text className={styles.muted} fontSize={13}>
          开启后，首页欢迎文案区域会显示通知内容；关闭后恢复每日简报和默认欢迎语逻辑。
        </Text>

        <FormGroup desc="保存后前端会自动刷新，无需重启服务。" title="通知能力">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : (
            <Flexbox horizontal align="center" className={styles.panel} gap={12}>
              <span className={styles.panelIcon}>
                <Icon icon={BellRing} size={17} />
              </span>
              <Flexbox flex={1} gap={4}>
                <Text weight={600}>{enabled ? '已开启' : '已关闭'}</Text>
                <Text className={styles.muted} fontSize={13}>
                  {enabled ? '首页当前显示平台通知内容。' : '首页当前使用原有欢迎文案逻辑。'}
                </Text>
              </Flexbox>
              <Switch checked={enabled} disabled={saving} onChange={setEnabled} />
            </Flexbox>
          )}
        </FormGroup>

        <FormGroup desc="支持换行，建议控制在 2 到 3 行内。" title="通知内容">
          <Flexbox gap={12}>
            <TextArea
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <Flexbox gap={8}>
              <Text className={styles.muted} fontSize={13}>
                首页预览
              </Text>
              <div className={styles.preview}>{content.trim() || DEFAULT_CONTENT}</div>
            </Flexbox>
          </Flexbox>
        </FormGroup>

        <Flexbox horizontal gap={8} justify="flex-end">
          <Button
            icon={<Icon icon={RotateCcw} size={15} />}
            onClick={() => setContent(DEFAULT_CONTENT)}
          >
            恢复默认内容
          </Button>
          <Button
            icon={<Icon icon={Save} size={15} />}
            loading={saving}
            type="primary"
            onClick={handleSave}
          >
            保存
          </Button>
        </Flexbox>
      </Flexbox>
    </>
  );
});

export default HomeNotificationSettings;
