import type { Sample } from "@sampla/shared";
import { getDb, STORES } from "../../lib/db.js";

export const loadAllSamples = async (): Promise<Sample[]> => {
  const db = await getDb();
  return db.getAll(STORES.SAMPLES);
};

export const putSample = async (s: Sample): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.SAMPLES, s);
};

export const deleteSample = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORES.SAMPLES, id);
};
