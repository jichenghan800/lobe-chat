import { buildConnectorManifest } from '@lobechat/mecha';
import type { ToolManifest } from '@lobechat/types';

import {
  getConnectorRuntimeName,
  isFeishuDocumentsConnector,
  isFeishuDocumentsToolAuthorized,
} from '@/const/connectorPresets';
import type { DecryptedConnector } from '@/database/models/connector';
import type { UserConnectorToolItem } from '@/database/schemas';

import { buildConnectorHttpTransport } from './connectorTransport';

/**
 * Convert connector DB rows into ToolManifest entries suitable for
 * injection into the server AgentToolsEngine as additionalManifests.
 *
 * Permission mapping:
 * - 'auto'           → humanIntervention: undefined (AI calls freely)
 * - 'needs_approval' → humanIntervention: 'required' (human must confirm)
 * - 'disabled'       → tool included with blocking description; AI knows it exists but is told it cannot be called
 */
export function buildConnectorManifests(
  connectors: DecryptedConnector[],
  tools: UserConnectorToolItem[],
): ToolManifest[] {
  const toolsByConnector = new Map<string, UserConnectorToolItem[]>();
  for (const tool of tools) {
    const list = toolsByConnector.get(tool.userConnectorId) ?? [];
    list.push(tool);
    toolsByConnector.set(tool.userConnectorId, list);
  }

  const manifests: ToolManifest[] = [];

  for (const connector of connectors) {
    // The listing and the permission mapping are the shared rule; the server
    // adds the endpoint and credentials the runtime needs to call it.
    const manifest = buildConnectorManifest({
      identifier: connector.identifier,
      isEnabled: connector.isEnabled,
      name: getConnectorRuntimeName(connector),
      tools: (toolsByConnector.get(connector.id) ?? []).filter(
        (tool) =>
          !isFeishuDocumentsConnector(connector) ||
          isFeishuDocumentsToolAuthorized(connector, tool.toolName),
      ),
    });
    if (!manifest) continue;

    manifests.push({
      ...(manifest as ToolManifest),
      // @ts-ignore — mcpParams is a runtime-only field not in the public type
      mcpParams: buildMcpParams(connector),
    });
  }

  return manifests;
}

function buildMcpParams(connector: DecryptedConnector) {
  if (connector.mcpConnectionType === 'stdio') {
    return {
      args: connector.mcpStdioConfig?.args ?? [],
      command: connector.mcpStdioConfig?.command ?? '',
      env: connector.mcpStdioConfig?.env,
      name: connector.identifier,
      type: 'stdio' as const,
    };
  }

  const { auth, headers } = buildConnectorHttpTransport(connector);

  return {
    auth,
    headers,
    name: connector.identifier,
    type: 'http' as const,
    url: connector.mcpServerUrl ?? '',
  };
}
