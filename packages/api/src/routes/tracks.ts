import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { loadTrack } from "../store/tracks.js";
import { trackAudioPath, trackPeaksPath } from "../store/paths.js";

const parseRange = (
  header: string | undefined,
  size: number,
): { start: number; end: number } | null => {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const startStr = m[1] ?? "";
  const endStr = m[2] ?? "";
  let start: number;
  let end: number;
  if (startStr === "" && endStr === "") return null;
  if (startStr === "") {
    // suffix range: last N bytes
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? size - 1 : Number(endStr);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start < 0 || end >= size) return null;
  return { start, end };
};

const sendAudio = async (
  req: FastifyRequest,
  reply: FastifyReply,
  path: string,
): Promise<void> => {
  const info = await stat(path);
  const range = parseRange(req.headers["range"], info.size);
  reply.header("Accept-Ranges", "bytes");
  reply.header("Content-Type", "audio/webm");
  if (!range) {
    reply.header("Content-Length", info.size);
    reply.code(200);
    return reply.send(createReadStream(path));
  }
  reply.code(206);
  reply.header("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
  reply.header("Content-Length", range.end - range.start + 1);
  return reply.send(createReadStream(path, { start: range.start, end: range.end }));
};

export const registerTrackRoutes = (app: FastifyInstance): void => {
  app.get<{ Params: { id: string } }>("/tracks/:id", async (req, reply) => {
    const track = await loadTrack(req.params.id);
    if (!track) {
      reply.code(404);
      return { error: "not_found" };
    }
    return track;
  });

  app.get<{ Params: { id: string } }>("/tracks/:id/audio", async (req, reply) => {
    const track = await loadTrack(req.params.id);
    if (!track) {
      reply.code(404);
      return { error: "not_found" };
    }
    try {
      await sendAudio(req, reply, trackAudioPath(req.params.id));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reply.code(404);
        return { error: "audio_missing" };
      }
      throw err;
    }
    return reply;
  });

  app.get<{ Params: { id: string } }>("/tracks/:id/peaks", async (req, reply) => {
    try {
      const buf = await readFile(trackPeaksPath(req.params.id), "utf8");
      reply.header("Content-Type", "application/json");
      return buf;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reply.code(404);
        return { error: "peaks_missing" };
      }
      throw err;
    }
  });
};
