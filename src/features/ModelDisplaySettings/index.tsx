'use client';

import {
  ActionIcon,
  Button,
  Flexbox,
  FormGroup,
  Icon,
  Input,
  Select,
  Skeleton,
  Text,
} from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { ArrowDown, ArrowUp, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import { modelDisplayKeys } from '@/libs/swr/keys';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { modelDisplayService } from '@/services/modelDisplay';
import { useAiInfraStore } from '@/store/aiInfra';
import type {
  ModelDisplayConfig,
  ModelDisplayItem,
  ModelDisplayOption,
} from '@/types/modelDisplay';

const styles = createStaticStyles(({ css, cssVar }) => ({
  empty: css`
    padding: 18px;
    border: 1px dashed ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    color: ${cssVar.colorTextDescription};
    text-align: center;
  `,
  muted: css`
    color: ${cssVar.colorTextDescription};
  `,
  panel: css`
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  row: css`
    min-height: 56px;
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
  `,
  select: css`
    width: 100%;
  `,
}));

const normalizeKey = (provider: string, model: string) =>
  `${provider.trim().toLowerCase()}/${model.trim().toLowerCase()}`;

const optionValue = (option: Pick<ModelDisplayOption, 'model' | 'provider'>) =>
  `${option.provider}/${option.model}`;

const toSelectOptions = (options: ModelDisplayOption[]) =>
  options.map((item) => ({
    label: item.label,
    value: optionValue(item),
  }));

interface ModelListEditorProps {
  items: ModelDisplayItem[];
  onChange: (items: ModelDisplayItem[]) => void;
  options: ModelDisplayOption[];
  title: string;
}

const ModelListEditor = memo<ModelListEditorProps>(({ title, items, options, onChange }) => {
  const { message } = App.useApp();
  const [selected, setSelected] = useState<string>();

  const selectOptions = useMemo(() => toSelectOptions(options), [options]);

  const updateItem = (index: number, next: Partial<ModelDisplayItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };

  const moveItem = (index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    const [item] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, item);
    onChange(nextItems);
  };

  const addSelected = () => {
    if (!selected) return;

    const option = options.find((item) => optionValue(item) === selected);
    if (!option) return;

    const exists = items.some(
      (item) =>
        normalizeKey(item.provider, item.model) === normalizeKey(option.provider, option.model),
    );

    if (exists) {
      void message.warning('该模型已经在列表中');
      return;
    }

    onChange([
      ...items,
      {
        displayName: option.displayName || option.model,
        enabled: true,
        model: option.model,
        provider: option.provider,
      },
    ]);
    setSelected(undefined);
  };

  return (
    <FormGroup desc="列表顺序就是前台模型下拉顺序，关闭的模型会从前台隐藏。" title={title}>
      <Flexbox className={styles.panel} gap={12}>
        <Flexbox horizontal align="center" gap={8}>
          <Select
            className={styles.select}
            options={selectOptions}
            placeholder="选择服务端已启用模型"
            value={selected}
            onChange={(value) => setSelected(value)}
          />
          <Button icon={<Icon icon={Plus} size={15} />} onClick={addSelected}>
            添加
          </Button>
        </Flexbox>

        {items.length === 0 ? (
          <div className={styles.empty}>暂无模型，添加后保存即可生效</div>
        ) : (
          <Flexbox gap={8}>
            {items.map((item, index) => (
              <Flexbox
                horizontal
                align="center"
                className={styles.row}
                gap={12}
                key={`${item.provider}/${item.model}/${index}`}
              >
                <Switch
                  checked={item.enabled}
                  onChange={(enabled) => updateItem(index, { enabled })}
                />
                <Flexbox flex={1} gap={4}>
                  <Text weight={600}>{`${item.provider}/${item.model}`}</Text>
                  <Input
                    placeholder="前台显示名称"
                    value={item.displayName || ''}
                    onChange={(event) => updateItem(index, { displayName: event.target.value })}
                  />
                </Flexbox>
                <Flexbox horizontal gap={4}>
                  <ActionIcon
                    disabled={index === 0}
                    icon={ArrowUp}
                    size="small"
                    title="上移"
                    onClick={() => moveItem(index, -1)}
                  />
                  <ActionIcon
                    disabled={index === items.length - 1}
                    icon={ArrowDown}
                    size="small"
                    title="下移"
                    onClick={() => moveItem(index, 1)}
                  />
                  <ActionIcon
                    icon={Trash2}
                    size="small"
                    title="删除"
                    onClick={() => onChange(items.filter((_, i) => i !== index))}
                  />
                </Flexbox>
              </Flexbox>
            ))}
          </Flexbox>
        )}
      </Flexbox>
    </FormGroup>
  );
});

const ModelDisplaySettings = memo(() => {
  const { message } = App.useApp();
  const [config, setConfig] = useState<ModelDisplayConfig>({ agent: [], chat: [] });
  const [saving, setSaving] = useState(false);

  const {
    data,
    error,
    isLoading,
    mutate: mutateSettings,
  } = useClientDataSWR(modelDisplayKeys.detail(), () => modelDisplayService.getDetail());
  const { data: options = [], mutate: mutateOptions } = useClientDataSWR(
    modelDisplayKeys.options(),
    () => modelDisplayService.getOptions(),
  );

  useEffect(() => {
    if (!data) return;

    setConfig(data);
  }, [data]);

  useEffect(() => {
    if (!error) return;

    void message.error('模型展示配置加载失败，请确认当前账号有管理员权限');
  }, [error, message]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await modelDisplayService.update(config);
      await mutateSettings();
      await mutateOptions();
      await useAiInfraStore.getState().refreshAiProviderRuntimeState();
      void message.success('模型展示配置已更新');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '模型展示配置更新失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingHeader title="模型展示配置" />
      <Flexbox gap={24}>
        <Flexbox horizontal align="flex-start" className={styles.panel} gap={12}>
          <Icon icon={Eye} size={18} />
          <Flexbox gap={4}>
            <Text weight={600}>仅配置前台可见模型、显示名称和顺序</Text>
            <Text className={styles.muted} fontSize={13}>
              API Key、Base URL 和渠道密钥仍然只从服务端环境变量读取，不会在这个页面展示或保存。
            </Text>
          </Flexbox>
        </Flexbox>

        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} title={false} />
        ) : (
          <>
            <ModelListEditor
              items={config.chat}
              options={options}
              title="Chat 模型"
              onChange={(chat) => setConfig((prev) => ({ ...prev, chat }))}
            />
            <ModelListEditor
              items={config.agent}
              options={options}
              title="Agent 模型"
              onChange={(agent) => setConfig((prev) => ({ ...prev, agent }))}
            />
          </>
        )}

        <Flexbox horizontal justify="flex-end">
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

export default ModelDisplaySettings;
