'use client';

import { App } from 'antd';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConnectorPresetId } from '@/const/connectorPresets';
import { useToolStore } from '@/store/tool';

import { openConnectorOAuthPopup, waitForConnectorOAuthPopup } from './oauthPopup';

export const useConnectFeishuDocuments = () => {
  const { message } = App.useApp();
  const { t } = useTranslation('setting');
  const [connecting, setConnecting] = useState(false);

  const createConnectorPreset = useToolStore((s) => s.createConnectorPreset);
  const fetchConnectors = useToolStore((s) => s.fetchConnectors);
  const startConnectorOAuth = useToolStore((s) => s.startConnectorOAuth);

  const connect = useCallback(async () => {
    const popup = openConnectorOAuthPopup();
    if (!popup) {
      message.error(t('connectorPreset.oauth.popupBlocked'));
      return;
    }

    setConnecting(true);
    try {
      const { id } = await createConnectorPreset(ConnectorPresetId.feishuDocuments);
      const authorizationUrl = await startConnectorOAuth(id);
      const resultPromise = waitForConnectorOAuthPopup(popup, id);
      popup.location.href = authorizationUrl;

      const result = await resultPromise;
      await fetchConnectors();

      if (result.status === 'success') {
        if (result.synced === false) {
          message.warning(t('connectorPreset.oauth.syncFailed'));
        } else {
          message.success(t('connectorPreset.oauth.success'));
        }
        return;
      }

      if (result.status === 'error') {
        message.error(
          t('connectorPreset.oauth.authError', {
            reason: result.error || t('connectorPreset.oauth.unknownError'),
          }),
        );
        return;
      }

      message.warning(t('connectorPreset.oauth.cancelled'));
    } catch (error) {
      popup.close();
      message.error(
        t('connectorPreset.oauth.authError', {
          reason: error instanceof Error ? error.message : t('connectorPreset.oauth.unknownError'),
        }),
      );
    } finally {
      setConnecting(false);
    }
  }, [createConnectorPreset, fetchConnectors, message, startConnectorOAuth, t]);

  return { connect, connecting };
};
