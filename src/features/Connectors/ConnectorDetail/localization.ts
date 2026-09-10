import { type TFunction } from 'i18next';

import { isFeishuDocumentsConnector } from '@/const/connectorPresets';

interface LocalizableConnector {
  identifier: string;
  metadata?: Record<string, unknown> | null;
  name: string;
  sourceType: string;
}

interface LocalizableProvider {
  description?: string;
  label: string;
}

interface GetLocalizedConnectorDetailOptions {
  composioApp?: LocalizableProvider;
  connector: LocalizableConnector;
  lobehubProvider?: LocalizableProvider;
  t: TFunction<'setting'>;
}

export const getLocalizedConnectorDetail = ({
  composioApp,
  connector,
  lobehubProvider,
  t,
}: GetLocalizedConnectorDetailOptions) => {
  const rawDescription =
    typeof connector.metadata?.description === 'string'
      ? connector.metadata.description
      : undefined;

  if (isFeishuDocumentsConnector(connector)) {
    return {
      description: t('connectorPreset.feishuDocuments.description', {
        defaultValue: rawDescription || '',
      }),
      name: t('connectorPreset.feishuDocuments.title', { defaultValue: connector.name }),
    };
  }

  if (connector.sourceType === 'builtin') {
    return {
      description: t(`tools.builtins.${connector.identifier}.description`, {
        defaultValue: rawDescription || '',
      }),
      name: t(`tools.builtins.${connector.identifier}.title`, {
        defaultValue: connector.name,
      }),
    };
  }

  if (lobehubProvider) {
    return {
      description: t(`tools.lobehubSkill.providers.${connector.identifier}.description`, {
        defaultValue: lobehubProvider.description || rawDescription || '',
      }),
      name: lobehubProvider.label,
    };
  }

  if (composioApp) {
    return {
      description: t(`tools.composio.servers.${connector.identifier}.description`, {
        defaultValue: composioApp.description || rawDescription || '',
      }),
      name: composioApp.label,
    };
  }

  return {
    description: rawDescription,
    name: connector.name,
  };
};
