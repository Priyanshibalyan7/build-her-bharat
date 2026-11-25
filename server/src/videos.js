import { Router } from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import { z } from "zod";
import { cfg } from "./config.js";
import { requireAuth } from "./auth.js";
import { Search, Video, pubVideo } from "./models.js";
import { call, mlSearch } from "./ml.js";
import { indexQueue } from "./queue.js";

const ALLOWED = new Set([".mp4", ".mkv", ".avi", ".mov", ".webm"]);
const UP = path.resolve("uploads");
fs.mkdirSync(UP, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UP,
    filename: (q, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 2048) * 1048576 },
  fileFilter: (q, f, cb) => ALLOWED.has(path.extname(f.originalname).toLowerCase())
    ? cb(null, true)
    : cb(Object.assign(new Error(`Unsupported file type. Use one of: ${[...ALLOWED].join(", ")}`), { status: 400 })),
});

// <video> and download links cannot send an Authorization header, so they use a short-lived,
// single-video "media token" instead of the login token.
function mediaAuth(req, res, next) {
  try {
    const p = jwt.verify(String(req.query.mt || ""), cfg.jwt);
    if (p.typ !== "media" || p.vid !== req.params.id) throw new Error("bad token");
    req.userId = p.sub;
    next();
  } catch {
    res.status(401).json({ detail: "This media link has expired. Reload the page." });
  }
}

async function owned(req) {
  const v = await Video.findOne({ _id: req.params.id, owner: req.userId });
  if (!v) throw Object.assign(new Error("Video not found."), { status: 404 });
  return v;
}

async function proxy(req, res, p) {
  const ac = new AbortController();
  res.on("close", () => ac.abort());
  const up = await call(p, { headers: req.headers.range ? { range: req.headers.range } : {}, signal: ac.signal });
  res.status(up.status);
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"]) {
    const x = up.headers.get(h);
    if (x) res.setHeader(h, x);
  }
  if (!up.body) return res.end();
  await pipeline(Readable.fromWeb(up.body), res).catch(() => {});
}

export const videosRouter = Router();
const r = videosRouter;

r.get("/:id/stream", mediaAuth, async (req, res) => {
  const v = await owned(req);
  await proxy(req, res, `/api/video/${v.mlId}`);
});
r.get("/:id/clip", mediaAuth, async (req, res) => {
  const v = await owned(req);
  const q = z.object({ start: z.coerce.number().min(0), end: z.coerce.number() }).parse(req.query);
  await proxy(req, res, `/api/clip/${v.mlId}?start=${q.start}&end=${q.end}`);
});

r.use(requireAuth);

r.get("/", async (req, res) => {
  const list = await Video.find({ owner: req.userId }).sort({ createdAt: -1 }).limit(50);
  res.json(list.map(pubVideo));
});

r.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "Choose a video file first." });
  const v = await Video.create({ owner: req.userId, name: req.file.originalname, size: req.file.size });
  await indexQueue.add("index", { videoId: v.id, path: req.file.path }, { removeOnComplete: true, removeOnFail: 100 });
  res.status(201).json(pubVideo(v));
});

r.get("/:id", async (req, res) => res.json(pubVideo(await owned(req))));

r.post("/:id/media-token", async (req, res) => {
  const v = await owned(req);
  res.json({ token: jwt.sign({ sub: req.userId, typ: "media", vid: v.id }, cfg.jwt, { expiresIn: "2h" }) });
});

r.post("/:id/search", async (req, res) => {
  const { query } = z.object({ query: z.string().trim().min(1, "Type something to search for.").max(300) }).parse(req.body);
  const v = await owned(req);
  if (v.status !== "ready") return res.status(409).json({ detail: "Video is not indexed yet" });
  const t0 = Date.now();
  const out = await mlSearch(v.mlId, query);
  await Search.create({ owner: req.userId, video: v.id, query, count: out.segments.length, ms: Date.now() - t0 });
  res.json(out);
});

export const statsRouter = Router();
statsRouter.use(requireAuth);
statsRouter.get("/", async (req, res) => {
  const owner = new mongoose.Types.ObjectId(req.userId);
  const [videos, agg, rs, rv] = await Promise.all([
    Video.countDocuments({ owner }),
    Search.aggregate([{ $match: { owner } }, { $group: { _id: null, n: { $sum: 1 }, matches: { $sum: "$count" }, ms: { $avg: "$ms" } } }]),
    Search.find({ owner }).sort({ createdAt: -1 }).limit(6),
    Video.find({ owner }).sort({ createdAt: -1 }).limit(6),
  ]);
  const a = agg[0] || { n: 0, matches: 0, ms: 0 };
  res.json({
    videos, searches: a.n, matches: a.matches, avgMs: Math.round(a.ms || 0),
    recentSearches: rs.map((s) => ({ q: s.query, count: s.count, ms: s.ms, ts: s.createdAt.getTime() })),
    recentVideos: rv.map(pubVideo),
  });
});
statsRouter.delete("/", async (req, res) => {
  await Search.deleteMany({ owner: req.userId });
  res.status(204).end();
});
