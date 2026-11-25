import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import fs from "node:fs";
import { Video } from "./models.js";

const ML = process.env.ML_URL || "http://localhost:8000";
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
export const queue = new Queue("index", { connection });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Optional: keep a copy of the original upload in MinIO (S3-compatible, self-hosted).
async function archive(file, objectName) {
  if (!process.env.MINIO_ENDPOINT) return;
  const { Client } = await import("minio");
  const c = new Client({
    endPoint: process.env.MINIO_ENDPOINT, port: Number(process.env.MINIO_PORT || 9000), useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY,
  });
  const bucket = process.env.MINIO_BUCKET || "videos";
  if (!(await c.bucketExists(bucket))) await c.makeBucket(bucket);
  await c.fPutObject(bucket, objectName, file);
}

// Takes jobs from the queue, hands the video to the Python service and relays progress over Socket.IO.
export function startWorker(io) {
  return new Worker("index", async (job) => {
    const { id, path, name } = job.data;
    const v = await Video.findById(id);
    if (!v) return;
    const push = async (s) => {
      Object.assign(v, s);
      await v.save();
      io.to(`user:${v.owner}`).emit("progress", { videoId: String(v._id), state: v.state, progress: v.progress, error: v.error || null });
    };
    try {
      const fd = new FormData();
      fd.append("file", await fs.openAsBlob(path), name);
      const up = await fetch(`${ML}/api/upload`, { method: "POST", body: fd });
      if (!up.ok) throw new Error((await up.json().catch(() => ({}))).detail || "The ML service rejected the upload.");
      v.mlId = (await up.json()).video_id;
      await v.save();
      for (;;) {
        const s = await (await fetch(`${ML}/api/status/${v.mlId}`)).json();
        await push({ state: s.state, progress: s.progress, error: s.error });
        if (s.state === "ready") break;
        if (s.state === "error") return;
        await sleep(1000);
      }
      await archive(path, `${v._id}-${name}`).catch((e) => console.warn("MinIO archive skipped:", e.message));
    } catch (e) {
      const msg = e.cause?.code === "ECONNREFUSED" ? "The ML service is not running on " + ML : e.message;
      await push({ state: "error", error: msg });
    } finally {
      fs.rm(path, { force: true }, () => {});
    }
  }, { connection, concurrency: 1 }); // one video at a time: indexing is CPU/GPU heavy
}
