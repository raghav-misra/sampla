import { openDB, type IDBPDatabase } from "idb";
import type { Sample } from "@sampla/shared";

const DB_NAME = "sampla";
const DB_VERSION = 1;
const STORE = "samples";

interface SamplaSchema {
  samples: {
    key: string;
    value: Sample;
    indexes: { byTrack: string };
  };
}

let dbPromise: Promise<IDBPDatabase<SamplaSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<SamplaSchema>> => {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<SamplaSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("byTrack", "trackId", { unique: false });
      }
    },
  });
  return dbPromise;
};

export const loadAllSamples = async (): Promise<Sample[]> => {
  const db = await getDb();
  return db.getAll(STORE);
};

export const putSample = async (s: Sample): Promise<void> => {
  const db = await getDb();
  await db.put(STORE, s);
};

export const deleteSample = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORE, id);
};
