import { openDB, type IDBPDatabase } from "idb";
import type { Project, Recording, Slice, Track } from "@sampla/shared";

const DB_NAME = "sampla";
const DB_VERSION = 3;
const PROJECTS = "projects";
const TRACKS = "tracks";
const SLICES = "slices";
const RECORDINGS = "recordings";

interface SamplaSchema {
  projects: {
    key: string;
    value: Project;
  };
  tracks: {
    key: string;
    value: Track;
    indexes: { byProject: string };
  };
  slices: {
    key: string;
    value: Slice;
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
      // Drop legacy stores that predate the Project/Track/Slice rename.
      for (const name of ["samples", "recordings"] as const) {
        if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
      }
      if (oldVersion < 3) {
        db.createObjectStore(PROJECTS, { keyPath: "id" });
        const tracks = db.createObjectStore(TRACKS, { keyPath: "id" });
        tracks.createIndex("byProject", "projectId", { unique: false });
        const slices = db.createObjectStore(SLICES, { keyPath: "id" });
        slices.createIndex("byTrack", "trackId", { unique: false });
        const recordings = db.createObjectStore(RECORDINGS, { keyPath: "id" });
        recordings.createIndex("byTrack", "trackId", { unique: false });
      }
    },
  });
  return dbPromise;
};

export const STORES = { PROJECTS, TRACKS, SLICES, RECORDINGS } as const;
