import { nanoid } from "nanoid";
import { Job, Track } from "@sampla/shared";
import { putJob, updateJob } from "./store/jobs.js";
import { loadTrack, saveTrack } from "./store/tracks.js";
import { ensureTrackDir, trackAudioPath, trackPeaksPath } from "./store/paths.js";
import { downloadAudio, fetchMeta } from "./services/ytdlp.js";
import { transcodeToOpusWebm } from "./services/ffmpeg.js";
import { generatePeaks } from "./services/peaks.js";

interface Task {
  jobId: string;
  youtubeUrl: string;
}

const queue: Task[] = [];
let running = false;

const process = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      await runIngest(task);
    }
  } finally {
    running = false;
  }
};

const runIngest = async ({ jobId, youtubeUrl }: Task): Promise<void> => {
  const setProgress = (p: number): void => {
    updateJob(jobId, { progress: Math.max(0, Math.min(1, p)) });
  };
  try {
    updateJob(jobId, { status: "running", progress: 0.02 });

    const meta = await fetchMeta(youtubeUrl);
    setProgress(0.1);

    const trackId = meta.id;
    const cached = await loadTrack(trackId);
    if (cached) {
      updateJob(jobId, { status: "done", progress: 1, trackId });
      return;
    }
    await ensureTrackDir(trackId);

    const sourcePath = await downloadAudio(youtubeUrl, trackId, (fraction) => {
      setProgress(0.1 + fraction * 0.4);
    });
    setProgress(0.55);

    const audioPath = trackAudioPath(trackId);
    await transcodeToOpusWebm(sourcePath, audioPath);
    setProgress(0.75);

    await generatePeaks(sourcePath, meta.durationSec, trackPeaksPath(trackId));
    setProgress(0.95);

    const track: Track = {
      id: trackId,
      sourceUrl: meta.webpageUrl,
      title: meta.title,
      durationSec: meta.durationSec,
      sampleRate: 48000,
      channels: 2,
      audioUrl: `/tracks/${trackId}/audio`,
      peaksUrl: `/tracks/${trackId}/peaks`,
      createdAt: new Date().toISOString(),
    };
    await saveTrack(track);

    updateJob(jobId, { status: "done", progress: 1, trackId });
  } catch (err) {
    updateJob(jobId, {
      status: "error",
      progress: 1,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const enqueueIngest = (youtubeUrl: string): Job => {
  const job = Job.parse({
    id: nanoid(12),
    kind: "ingest",
    status: "queued",
    progress: 0,
  } satisfies Job);
  putJob(job);
  queue.push({ jobId: job.id, youtubeUrl });
  void process();
  return job;
};
