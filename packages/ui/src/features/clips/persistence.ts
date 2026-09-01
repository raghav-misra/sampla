import type { Clip } from "@sampla/shared";
import { getDb, STORES } from "../../lib/db.js";

export const loadAllClips = async (): Promise<Clip[]> => {
  const db = await getDb();
  return db.getAll(STORES.CLIPS);
};

export const putClip = async (clip: Clip): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.CLIPS, clip);
};

export const deleteClip = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORES.CLIPS, id);
};