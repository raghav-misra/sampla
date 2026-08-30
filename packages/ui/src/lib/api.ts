import {
  IngestRequest,
  IngestResponse,
  Job,
  Peaks,
  Track,
} from "@sampla/shared";

const BASE = "/api";
// media/audio endpoints go direct to the API host; Vite's proxy has trouble with
// large streaming responses and browser range requests.
const MEDIA_BASE = "http://127.0.0.1:3001";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return (await res.json()) as T;
};

export const api = {
  ingest: (body: IngestRequest): Promise<IngestResponse> =>
    request<IngestResponse>("/ingest", { method: "POST", body: JSON.stringify(body) }),
  getJob: (id: string): Promise<Job> => request<Job>(`/jobs/${id}`),
  getTrack: (id: string): Promise<Track> => request<Track>(`/tracks/${id}`),
  getPeaks: (id: string): Promise<Peaks> => request<Peaks>(`/tracks/${id}/peaks`),
  audioUrl: (id: string): string => `${MEDIA_BASE}/tracks/${id}/audio`,
};
