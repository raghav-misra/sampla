import type { Instrument } from "@sampla/shared";
import { getDb, STORES } from "../../lib/db.js";

export const loadAllInstruments = async (): Promise<Instrument[]> => {
  const db = await getDb();
  return db.getAll(STORES.INSTRUMENTS);
};

export const putInstrument = async (instrument: Instrument): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.INSTRUMENTS, instrument);
};