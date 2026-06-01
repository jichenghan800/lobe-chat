import { createFeishuProvider } from './feishu';

const provider = createFeishuProvider({
  appIdEnvKey: 'AUTH_FEISHU_BLUE_APP_ID',
  appSecretEnvKey: 'AUTH_FEISHU_BLUE_APP_SECRET',
  emailDomain: 'feishu-blue.sso',
  id: 'feishu-blue',
});

export default provider;
