import { spawn } from "node:child_process";

const runSilent = (cmd: string, args: string[]): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd} exited ${code}: ${stderr}`));
    });
  });

export const transcodeToOpusWebm = async (
  inputPath: string,
  outputPath: string,
): Promise<void> => {
  await runSilent("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "libopus",
    "-b:a",
    "128k",
    outputPath,
  ]);
};

// Streams float32 little-endian mono PCM at `targetRate` Hz to the callback.
// Total sample count is not known up-front; caller aggregates.
export const streamMonoPcmF32 = (
  inputPath: string,
  targetRate: number,
  onChunk: (chunk: Buffer) => void,
): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        String(targetRate),
        "-f",
        "f32le",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => onChunk(b));
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
    });
  });
