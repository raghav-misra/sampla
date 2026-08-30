import { nanoid } from "nanoid";
import { Job, type Sample } from "@sampla/shared";
import { putJob, updateJob } from "./store/jobs.js";
import { loadSample, saveSample } from "./store/samples.js";
import { ensureSampleDir, sampleAudioPath, samplePeaksPath } from "./store/paths.js";
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

    const sampleId = meta.id;
    const cached = await loadSample(sampleId);
    if (cached) {
      updateJob(jobId, { status: "done", progress: 1, sampleId });
      return;
    }
    await ensureSampleDir(sampleId);

    const sourcePath = await downloadAudio(youtubeUrl, sampleId, (fraction) => {
      setProgress(0.1 + fraction * 0.4);
    });
    setProgress(0.55);

    const audioPath = sampleAudioPath(sampleId);
    await transcodeToOpusWebm(sourcePath, audioPath);
    setProgress(0.75);

    await generatePeaks(sourcePath, meta.durationSec, samplePeaksPath(sampleId));
    setProgress(0.95);

    const sample: Sample = {
      id: sampleId,
      sourceUrl: meta.webpageUrl,
      title: meta.title,
      durationSec: meta.durationSec,
      sampleRate: 48000,
      channels: 2,
      audioUrl: `/samples/${sampleId}/audio`,
      peaksUrl: `/samples/${sampleId}/peaks`,
      createdAt: new Date().toISOString(),
    };
    await saveSample(sample);

    updateJob(jobId, { status: "done", progress: 1, sampleId });
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
