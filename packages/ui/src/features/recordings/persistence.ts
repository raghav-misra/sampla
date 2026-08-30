import type { Recording } from "@sampla/shared";
import { getDb, STORES } from "../../lib/db.js";

export const loadAllRecordings = async (): Promise<Recording[]> => {
  const db = await getDb();
  return db.getAll(STORES.RECORDINGS);
};

export const putRecording = async (r: Recording): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.RECORDINGS, r);
};

export const deleteRecording = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORES.RECORDINGS, id);
};
