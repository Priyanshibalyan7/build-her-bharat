// Optional: keep a copy of every original upload in MinIO (S3-compatible, free, self-hosted).
import { Client } from "minio";
import { cfg } from "./config.js";

let client = null;
export async function archive(file, key) {
  if (!cfg.minio) return;
  client ??= new Client(cfg.minio.conn);
  const bucket = cfg.minio.bucket;
  if (!(await client.bucketExists(bucket))) await client.makeBucket(bucket);
  await client.fPutObject(bucket, key.replace(/[^\w./-]/g, "_"), file);
}
