import type { Project, Track } from "@sampla/shared";
import { getDb, STORES } from "../../lib/db.js";

export const loadAllProjects = async (): Promise<Project[]> => {
  const db = await getDb();
  return db.getAll(STORES.PROJECTS);
};

export const putProject = async (p: Project): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.PROJECTS, p);
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORES.PROJECTS, id);
};

export const loadTracksForProject = async (projectId: string): Promise<Track[]> => {
  const db = await getDb();
  return db.getAllFromIndex(STORES.TRACKS, "byProject", projectId);
};

export const loadAllTracks = async (): Promise<Track[]> => {
  const db = await getDb();
  return db.getAll(STORES.TRACKS);
};

export const putTrack = async (t: Track): Promise<void> => {
  const db = await getDb();
  await db.put(STORES.TRACKS, t);
};

export const deleteTrack = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete(STORES.TRACKS, id);
};
