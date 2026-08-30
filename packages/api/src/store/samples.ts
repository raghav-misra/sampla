import { readFile, writeFile } from "node:fs/promises";
import { Sample } from "@sampla/shared";
import { listSampleIds, sampleMetaPath } from "./paths.js";

export const saveSample = async (s: Sample): Promise<void> => {
  await writeFile(sampleMetaPath(s.id), JSON.stringify(s, null, 2), "utf8");
};

export const loadSample = async (id: string): Promise<Sample | null> => {
  try {
    const buf = await readFile(sampleMetaPath(id), "utf8");
    return Sample.parse(JSON.parse(buf));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
};

export const listSamples = async (): Promise<Sample[]> => {
  const ids = await listSampleIds();
  const results = await Promise.all(ids.map((id) => loadSample(id)));
  return results.filter((s): s is Sample => s !== null);
};
