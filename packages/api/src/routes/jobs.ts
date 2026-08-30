import type { FastifyInstance } from "fastify";
import { getJob } from "../store/jobs.js";

export const registerJobRoutes = (app: FastifyInstance): void => {
  app.get<{ Params: { id: string } }>("/jobs/:id", async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) {
      reply.code(404);
      return { error: "not_found" };
    }
    return job;
  });
};
