import { create } from "zustand";
import type { Project, Track } from "@sampla/shared";
import {
  deleteProject,
  deleteTrack,
  loadAllProjects,
  loadAllTracks,
  putProject,
  putTrack,
} from "./persistence.js";

const randomId = (prefix: string): string =>
  crypto.randomUUID?.() ??
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

interface ProjectsState {
  hydrated: boolean;
  projects: Project[];
  tracksByProject: Record<string, Track[]>;
  activeProjectId: string | null;

  hydrate: () => Promise<void>;
  createProject: (name?: string) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;

  addTrack: (projectId: string, instrumentId: string) => Promise<Track>;
  removeTrack: (projectId: string, trackId: string) => Promise<void>;
  reorderTracks: (projectId: string, orderedIds: string[]) => Promise<void>;
  renameTrack: (projectId: string, trackId: string, name: string) => Promise<void>;
}

const sortTracks = (arr: Track[]): Track[] =>
  [...arr].sort((a, b) => a.order - b.order);

const nextProjectName = (existing: Project[]): string => {
  let max = 0;
  for (const p of existing) {
    const m = /^Untitled (\d+)$/.exec(p.name);
    if (m?.[1]) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Untitled ${Math.max(max + 1, existing.length + 1)}`;
};

export const useProjects = create<ProjectsState>((set, get) => ({
  hydrated: false,
  projects: [],
  tracksByProject: {},
  activeProjectId: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const [projects, tracks] = await Promise.all([loadAllProjects(), loadAllTracks()]);
    projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const tracksByProject: Record<string, Track[]> = {};
    for (const t of tracks) {
      let arr = tracksByProject[t.projectId];
      if (!arr) {
        arr = [];
        tracksByProject[t.projectId] = arr;
      }
      arr.push(t);
    }
    for (const [k, arr] of Object.entries(tracksByProject)) {
      tracksByProject[k] = sortTracks(arr);
    }
    const activeProjectId = projects[projects.length - 1]?.id ?? null;
    set({ hydrated: true, projects, tracksByProject, activeProjectId });
  },

  createProject: async (name) => {
    const project: Project = {
      id: randomId("p"),
      name: name?.trim() || nextProjectName(get().projects),
      createdAt: new Date().toISOString(),
    };
    await putProject(project);
    set((s) => ({
      projects: [...s.projects, project],
      activeProjectId: project.id,
      tracksByProject: { ...s.tracksByProject, [project.id]: [] },
    }));
    return project;
  },

  renameProject: async (id, name) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p || !name.trim()) return;
    const updated: Project = { ...p, name: name.trim() };
    await putProject(updated);
    set((s) => ({
      projects: s.projects.map((x) => (x.id === id ? updated : x)),
    }));
  },

  removeProject: async (id) => {
    await deleteProject(id);
    // Cascade tracks (slices/recordings orphans are ignored elsewhere).
    for (const t of get().tracksByProject[id] ?? []) {
      await deleteTrack(t.id);
    }
    set((s) => {
      const nextTracks = { ...s.tracksByProject };
      delete nextTracks[id];
      const projects = s.projects.filter((x) => x.id !== id);
      const active =
        s.activeProjectId === id ? projects[projects.length - 1]?.id ?? null : s.activeProjectId;
      return { projects, tracksByProject: nextTracks, activeProjectId: active };
    });
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  addTrack: async (projectId, instrumentId) => {
    const existing = get().tracksByProject[projectId] ?? [];
    const track: Track = {
      id: randomId("t"),
      projectId,
      instrumentId,
      order: existing.length,
      createdAt: new Date().toISOString(),
    };
    await putTrack(track);
    set((s) => ({
      tracksByProject: {
        ...s.tracksByProject,
        [projectId]: sortTracks([...(s.tracksByProject[projectId] ?? []), track]),
      },
    }));
    return track;
  },

  removeTrack: async (projectId, trackId) => {
    await deleteTrack(trackId);
    const remaining = (get().tracksByProject[projectId] ?? []).filter(
      (t) => t.id !== trackId,
    );
    // Compact order values.
    const compacted = remaining.map((t, i) => ({ ...t, order: i }));
    await Promise.all(compacted.map((t) => putTrack(t)));
    set((s) => ({
      tracksByProject: { ...s.tracksByProject, [projectId]: compacted },
    }));
  },

  reorderTracks: async (projectId, orderedIds) => {
    const current = get().tracksByProject[projectId] ?? [];
    const byId = new Map(current.map((t) => [t.id, t]));
    const next: Track[] = [];
    orderedIds.forEach((id, i) => {
      const t = byId.get(id);
      if (t) next.push({ ...t, order: i });
    });
    await Promise.all(next.map((t) => putTrack(t)));
    set((s) => ({
      tracksByProject: { ...s.tracksByProject, [projectId]: next },
    }));
  },

  renameTrack: async (projectId, trackId, name) => {
    const t = (get().tracksByProject[projectId] ?? []).find((x) => x.id === trackId);
    if (!t) return;
    const updated: Track = { ...t, name };
    await putTrack(updated);
    set((s) => ({
      tracksByProject: {
        ...s.tracksByProject,
        [projectId]: (s.tracksByProject[projectId] ?? []).map((x) =>
          x.id === trackId ? updated : x,
        ),
      },
    }));
  },
}));
