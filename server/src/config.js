import "dotenv/config";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("Set JWT_SECRET (16+ characters) in server/.env. Copy .env.example to .env first.");
  process.exit(1);
}
const e = process.env;
export const cfg = {
  port: Number(e.PORT) || 4000,
  mongo: e.MONGO_URL || "mongodb://127.0.0.1:27017/surveyllix",
  redis: e.REDIS_URL || "redis://127.0.0.1:6379",
  ml: e.ML_URL || "http://127.0.0.1:8000",
  jwt: e.JWT_SECRET,
  googleId: e.GOOGLE_CLIENT_ID || "",
  origin: e.CLIENT_ORIGIN || "http://localhost:5173",
  minio: e.MINIO_ENDPOINT
    ? {
        bucket: e.MINIO_BUCKET || "surveyllix",
        conn: { endPoint: e.MINIO_ENDPOINT, port: Number(e.MINIO_PORT) || 9000, useSSL: false,
                accessKey: e.MINIO_ACCESS_KEY || "minioadmin", secretKey: e.MINIO_SECRET_KEY || "minioadmin" },
      }
    : null,
};
