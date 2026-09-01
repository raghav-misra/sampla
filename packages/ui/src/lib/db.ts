import { openDB, type IDBPDatabase } from "idb";
import type { Clip, Instrument, Project, Recording, Slice, Track } from "@sampla/shared";

const DB_NAME = "sampla";
const DB_VERSION = 5;
const PROJECTS = "projects";
const INSTRUMENTS = "instruments";
const TRACKS = "tracks";
const SLICES = "slices";
const RECORDINGS = "recordings";
const CLIPS = "clips";

interface SamplaSchema {
  projects: {
    key: string;
    value: Project;
  };
  instruments: {
    key: string;
    value: Instrument;
    indexes: { bySample: string };
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
  clips: {
    key: string;
    value: Clip;
    indexes: { byTrack: string; byRecording: string };
  };
}

let dbPromise: Promise<IDBPDatabase<SamplaSchema>> | null = null;

export const getDb = (): Promise<IDBPDatabase<SamplaSchema>> => {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<SamplaSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 3) {
        // Drop legacy stores that predate the Project/Track/Slice rename.
        for (const name of ["samples", "recordings"] as const) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        }
        db.createObjectStore(PROJECTS, { keyPath: "id" });
        const tracks = db.createObjectStore(TRACKS, { keyPath: "id" });
        tracks.createIndex("byProject", "projectId", { unique: false });
        const slices = db.createObjectStore(SLICES, { keyPath: "id" });
        slices.createIndex("byTrack", "trackId", { unique: false });
        const recordings = db.createObjectStore(RECORDINGS, { keyPath: "id" });
        recordings.createIndex("byTrack", "trackId", { unique: false });
      }
      if (oldVersion < 4) {
        const instruments = db.createObjectStore(INSTRUMENTS, { keyPath: "id" });
        instruments.createIndex("bySample", "sampleId", { unique: true });

        if (oldVersion >= 3) {
          const tracks = transaction.objectStore(TRACKS);
          void tracks.openCursor().then(function migrate(cursor): Promise<void> | void {
            if (!cursor) return;
            const legacy = cursor.value as Track & { sampleId?: string };
            if (legacy.sampleId && !legacy.instrumentId) {
              const instrumentId = `youtube:${legacy.sampleId}`;
              instruments.put({
                id: instrumentId,
                type: "youtube-sampler",
                sampleId: legacy.sampleId,
                createdAt: legacy.createdAt,
              });
              const { sampleId: _sampleId, ...track } = legacy;
              cursor.update({ ...track, instrumentId });
            }
            return cursor.continue().then(migrate);
          });
        }
      }
      if (oldVersion < 5) {
        const clips = db.createObjectStore(CLIPS, { keyPath: "id" });
        clips.createIndex("byTrack", "trackId", { unique: false });
        clips.createIndex("byRecording", "recordingId", { unique: false });

        if (oldVersion >= 3) {
          const recordings = transaction.objectStore(RECORDINGS);
          void recordings.openCursor().then(function migrate(cursor): Promise<void> | void {
            if (!cursor) return;
            const recording = cursor.value;
            clips.put({
              id: `clip:${recording.id}`,
              trackId: recording.trackId,
              recordingId: recording.id,
              startMs: 0,
              createdAt: recording.createdAt,
            });
            return cursor.continue().then(migrate);
          });
        }
      }
    },
  });
  return dbPromise;
};

export const STORES = {
  PROJECTS,
  INSTRUMENTS,
  TRACKS,
  SLICES,
  RECORDINGS,
  CLIPS,
} as const;
