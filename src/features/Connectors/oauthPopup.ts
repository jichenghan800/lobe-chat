export interface ConnectorOAuthPopupResult {
  error?: string;
  status: 'success' | 'error' | 'dismissed';
  synced?: boolean;
}

export const openConnectorOAuthPopup = (): Window | null =>
  window.open('about:blank', 'lobe-connector-oauth', 'width=600,height=720');

export const waitForConnectorOAuthPopup = (
  popup: Window,
  connectorId: string,
): Promise<ConnectorOAuthPopupResult> =>
  new Promise((resolve) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'lobe-connector-oauth') return;
      if (data.connectorId && data.connectorId !== connectorId) return;

      cleanup();
      resolve(
        data.success
          ? { status: 'success', synced: data.synced }
          : { error: data.error, status: 'error' },
      );
    };

    window.addEventListener('message', onMessage);

    const timer = setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      resolve({ status: 'dismissed' });
    }, 800);
  });
