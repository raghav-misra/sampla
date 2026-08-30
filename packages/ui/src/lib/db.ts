import { openDB, type IDBPDatabase } from "idb";
import type { Recording, Sample } from "@sampla/shared";

const DB_NAME = "sampla";
const DB_VERSION = 2;
const SAMPLES = "samples";
const RECORDINGS = "recordings";

interface SamplaSchema {
  samples: {
    key: string;
    value: Sample;
    indexes: { byTrack: string };
  };
  recordings: {
    key: string;
    value: Recording;
    indexes: { byTrack: string };
  };
}

let dbPromise: Promise<IDBPDatabase<SamplaSchema>> | null = null;

export const getDb = (): Promise<IDBPDatabase<SamplaSchema>> => {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<SamplaSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(SAMPLES, { keyPath: "id" });
        store.createIndex("byTrack", "trackId", { unique: false });
      }
      if (oldVersion < 2) {
        const store = db.createObjectStore(RECORDINGS, { keyPath: "id" });
        store.createIndex("byTrack", "trackId", { unique: false });
      }
    },
  });
  return dbPromise;
};

export const STORES = { SAMPLES, RECORDINGS } as const;
