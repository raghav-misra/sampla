import type { Slice } from "@sampla/shared";
import { getDb, STORES } from "../../lib/db.js";

export const loadAllSlices = async (): Promise<Slice[]> => {
  const db = await getDb();
  return db.getAll(STORES.SLICES);
};

export const putSlice = async (s: Slice): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.SLICES, s);
};

export const deleteSlice = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORES.SLICES, id);
};

export const deleteSlicesForTrack = async (trackId: string): Promise<void> => {
  const db = await getDb();
  const tx = db.transaction(STORES.SLICES, "readwrite");
  const store = tx.objectStore(STORES.SLICES);
  const keys = await store.index("byTrack").getAllKeys(trackId);
  await Promise.all(keys.map((k) => store.delete(k)));
  await tx.done;
};
