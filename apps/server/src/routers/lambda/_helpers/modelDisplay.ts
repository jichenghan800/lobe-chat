import {
  CottiModelDisplayModel,
  getEnabledModelDisplayItems,
} from '@/database/models/cottiModelDisplay';
import type { LobeChatDatabase } from '@/database/type';
import type { ModelDisplayItem } from '@/types/modelDisplay';

export const getCottiModelDisplayVisibleRefs = async (
  db: LobeChatDatabase,
): Promise<ModelDisplayItem[]> => {
  const config = await new CottiModelDisplayModel(db).getConfig();

  return getEnabledModelDisplayItems(config);
};
