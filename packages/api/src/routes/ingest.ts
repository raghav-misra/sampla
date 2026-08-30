import type { FastifyInstance } from "fastify";
import { IngestRequest, IngestResponse } from "@sampla/shared";
import { enqueueIngest } from "../queue.js";

export const registerIngestRoutes = (app: FastifyInstance): void => {
  app.post("/ingest", async (req, reply) => {
    const parsed = IngestRequest.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_request", issues: parsed.error.issues };
    }
    const job = enqueueIngest(parsed.data.youtubeUrl);
    const res: IngestResponse = { jobId: job.id };
    return res;
  });
};
