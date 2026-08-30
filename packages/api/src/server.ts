import Fastify from "fastify";
import cors from "@fastify/cors";
import { ensureStorage } from "./store/paths.js";
import { registerIngestRoutes } from "./routes/ingest.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerTrackRoutes } from "./routes/tracks.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await ensureStorage();

app.get("/health", async () => ({ ok: true, ts: new Date().toISOString() }));

registerIngestRoutes(app);
registerJobRoutes(app);
registerTrackRoutes(app);

app
  .listen({ port: PORT, host: "127.0.0.1" })
  .then(() => app.log.info(`sampla api listening on http://127.0.0.1:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
