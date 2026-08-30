import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { trackDir } from "../store/paths.js";

export interface YtMeta {
  id: string;
  title: string;
  durationSec: number;
  webpageUrl: string;
}

const run = (
  cmd: string,
  args: string[],
  onStderr?: (chunk: string) => void,
): Promise<{ stdout: string; code: number }> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      const s = b.toString("utf8");
      stderr += s;
      onStderr?.(s);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, code });
      else reject(new Error(`${cmd} exited ${code}: ${stderr}`));
    });
  });

export const fetchMeta = async (url: string): Promise<YtMeta> => {
  const { stdout } = await run("yt-dlp", ["-j", "--no-warnings", url]);
  const json = JSON.parse(stdout) as {
    id: string;
    title: string;
    duration: number;
    webpage_url: string;
  };
  return {
    id: json.id,
    title: json.title,
    durationSec: json.duration,
    webpageUrl: json.webpage_url,
  };
};

// Downloads best audio into `<trackDir>/source.<ext>`. Returns the resulting file path.
export const downloadAudio = async (
  url: string,
  trackId: string,
  onProgress?: (fraction: number) => void,
): Promise<string> => {
  const dir = trackDir(trackId);
  const outTemplate = join(dir, "source.%(ext)s");
  await run(
    "yt-dlp",
    [
      "-f",
      "bestaudio",
      "--no-part",
      "--no-warnings",
      "--newline",
      "-o",
      outTemplate,
      url,
    ],
    (chunk) => {
      // yt-dlp progress lines look like: "[download]  42.3% of ..."
      const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(chunk);
      if (m && onProgress) onProgress(Math.min(1, Number(m[1]) / 100));
    },
  );
  const files = await readdir(dir);
  const found = files.find((f) => f.startsWith("source."));
  if (!found) throw new Error("yt-dlp did not produce a source file");
  return join(dir, found);
};
