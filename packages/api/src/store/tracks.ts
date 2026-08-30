import { readFile, writeFile } from "node:fs/promises";
import { Track } from "@sampla/shared";
import { trackMetaPath } from "./paths.js";

export const saveTrack = async (t: Track): Promise<void> => {
  await writeFile(trackMetaPath(t.id), JSON.stringify(t, null, 2), "utf8");
};

export const loadTrack = async (id: string): Promise<Track | null> => {
  try {
    const buf = await readFile(trackMetaPath(id), "utf8");
    return Track.parse(JSON.parse(buf));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
};
