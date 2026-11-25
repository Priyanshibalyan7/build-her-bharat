import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { OAuth2Client } from "google-auth-library";
import { Search, User, Video } from "./models.js";
import { queue, startWorker } from "./queue.js";

const { PORT = 4000, MONGO_URI, JWT_SECRET, ML_URL = "http://localhost:8000",
  CLIENT_ORIGIN = "http://localhost:5173", GOOGLE_CLIENT_ID } = process.env;
if (!MONGO_URI || !JWT_SECRET || !process.env.REDIS_URL) {
  console.error("Set MONGO_URI, REDIS_URL and JWT_SECRET in server/.env (copy .env.example).");
  process.exit(1);
}

const ALLOWED = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const err = (status, msg) => Object.assign(new Error(msg), { status });
const h = (fn) => (req, res, next) => fn(req, res).catch(next); // lets async errors reach the error handler
const sign = (u) => jwt.sign({ sub: String(u._id) }, JWT_SECRET, { expiresIn: "7d" });
const pub = (u) => ({ id: String(u._id), name: u.name, email: u.email, org: u.org, role: u.role, avatar: u.avatar, joined: u.createdAt.getTime() });

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "400kb" }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

// <video> and download links cannot send headers, so GET media routes also accept ?token=
function auth(req, _res, next) {
  const raw = req.headers.authorization?.replace(/^Bearer /, "") || req.query.token;
  try { req.uid = jwt.verify(raw, JWT_SECRET).sub; next(); } catch { next(err(401, "Please sign in.")); }
}

/* ---------- auth ---------- */
app.post("/api/auth/signup", h(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim()) throw err(400, "Enter your name.");
  if (!/^\S+@\S+\.\S+$/.test(email || "")) throw err(400, "Enter a valid email address.");
  if ((password || "").length < 6) throw err(400, "Password must be at least 6 characters.");
  if (await User.exists({ email: email.toLowerCase() })) throw err(409, "An account with this email already exists. Sign in instead.");
  const u = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.json({ token: sign(u), user: pub(u) });
}));

app.post("/api/auth/login", h(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await User.findOne({ email: String(email || "").toLowerCase() });
  if (!u?.passwordHash || !(await bcrypt.compare(password || "", u.passwordHash))) throw err(401, "Email or password is incorrect.");
  res.json({ token: sign(u), user: pub(u) });
}));

app.post("/api/auth/google", h(async (req, res) => {
  if (!googleClient) throw err(501, "Google sign-in is not configured on the server.");
  let p;
  try { p = (await googleClient.verifyIdToken({ idToken: req.body?.credential, audience: GOOGLE_CLIENT_ID })).getPayload(); }
  catch { throw err(401, "Google sign-in could not be verified."); }
  if (!p.email_verified) throw err(401, "Your Google email is not verified.");
  let u = await User.findOne({ email: p.email.toLowerCase() });
  if (!u) u = await User.create({ name: p.name || p.email, email: p.email, googleId: p.sub });
  res.json({ token: sign(u), user: pub(u) });
}));

app.get("/api/me", auth, h(async (req, res) => {
  const u = await User.findById(req.uid);
  if (!u) throw err(401, "Please sign in.");
  res.json(pub(u));
}));

app.patch("/api/me", auth, h(async (req, res) => {
  const { name, org, role, avatar } = req.body || {};
  const u = await User.findById(req.uid);
  if (name !== undefined) { if (!String(name).trim()) throw err(400, "Name cannot be empty."); u.name = String(name).trim().slice(0, 80); }
  if (org !== undefined) u.org = String(org).slice(0, 120);
  if (role !== undefined) u.role = String(role).slice(0, 60);
  if (avatar !== undefined) {
    if (avatar !== null && !(typeof avatar === "string" && avatar.startsWith("data:image/") && avatar.length < 300000)) throw err(400, "That photo is not valid or is too large.");
    u.avatar = avatar;
  }
  await u.save();
  res.json(pub(u));
}));

/* ---------- dashboard data ---------- */
app.get("/api/stats", auth, h(async (req, res) => {
  const [videos, searches] = await Promise.all([
    Video.find({ owner: req.uid }).sort({ createdAt: -1 }).limit(20),
    Search.find({ owner: req.uid }).sort({ createdAt: -1 }).limit(50),
  ]);
  res.json({
    videos: videos.map((v) => ({ id: String(v._id), name: v.name, ts: v.createdAt.getTime() })),
    searches: searches.map((s) => ({ q: s.q, count: s.count, ms: s.ms, ts: s.createdAt.getTime() })),
  });
}));

app.delete("/api/activity", auth, h(async (req, res) => {
  await Promise.all([Search.deleteMany({ owner: req.uid }), Video.deleteMany({ owner: req.uid })]);
  res.json({ ok: true });
}));

/* ---------- video: upload -> queue -> ML service ---------- */
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 1024 ** 3 } });

app.post("/api/upload", auth, upload.single("file"), h(async (req, res) => {
  if (!req.file) throw err(400, "No file received.");
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    fs.rm(req.file.path, { force: true }, () => {});
    throw err(400, `Unsupported file type. Use one of: ${ALLOWED.join(", ")}`);
  }
  const v = await Video.create({ owner: req.uid, name: req.file.originalname });
  await queue.add("index", { id: String(v._id), path: req.file.path, name: req.file.originalname }, { removeOnComplete: true, removeOnFail: true });
  res.json({ video_id: String(v._id) });
}));

async function owned(req) {
  if (!mongoose.isValidObjectId(req.params.id || req.body?.video_id)) throw err(404, "Video not found");
  const v = await Video.findOne({ _id: req.params.id || req.body.video_id, owner: req.uid });
  if (!v) throw err(404, "Video not found");
  return v;
}

app.get("/api/status/:id", auth, h(async (req, res) => {
  const v = await owned(req);
  res.json({ state: v.state, progress: v.progress, error: v.error || null });
}));

app.post("/api/search", auth, h(async (req, res) => {
  const v = await owned(req);
  const query = String(req.body.query || "").trim();
  if (!query) throw err(400, "Query is empty");
  if (v.state !== "ready") throw err(409, "Video is not indexed yet");
  const t0 = Date.now();
  const r = await fetch(`${ML_URL}/api/search`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: v.mlId, query }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw err(r.status, data.detail || "Search failed.");
  await Search.create({ owner: req.uid, video: v._id, q: query, count: data.segments.length, ms: Date.now() - t0 });
  res.json(data);
}));

// Stream video / clips from the ML service, passing Range headers so seeking works.
async function pipeFrom(url, req, res) {
  const r = await fetch(url, { headers: req.headers.range ? { range: req.headers.range } : {} });
  res.status(r.status);
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"]) {
    const val = r.headers.get(k);
    if (val) res.setHeader(k, val);
  }
  if (!r.body) return res.end();
  Readable.fromWeb(r.body).pipe(res);
}
app.get("/api/video/:id", auth, h(async (req, res) => pipeFrom(`${ML_URL}/api/video/${(await owned(req)).mlId}`, req, res)));
app.get("/api/clip/:id", auth, h(async (req, res) => {
  const v = await owned(req);
  const q = new URLSearchParams({ start: req.query.start, end: req.query.end });
  await pipeFrom(`${ML_URL}/api/clip/${v.mlId}?${q}`, req, res);
}));

/* ---------- errors ---------- */
app.use((e, _req, res, _next) => {
  const status = e.code === "LIMIT_FILE_SIZE" ? 413 : e.code === 11000 ? 409 : e.status || 500;
  let detail = e.code === "LIMIT_FILE_SIZE" ? "That file is too large (limit 1 GB)." : e.message;
  if (e.cause?.code === "ECONNREFUSED") detail = `The ML service is not running on ${ML_URL}.`;
  if (status === 500) console.error(e);
  if (!res.headersSent) res.status(e.cause?.code === "ECONNREFUSED" ? 502 : status).json({ detail });
});

/* ---------- real-time progress ---------- */
io.use((s, next) => {
  try { s.userId = jwt.verify(s.handshake.auth.token, JWT_SECRET).sub; next(); } catch { next(new Error("unauthorized")); }
});
io.on("connection", (s) => s.join(`user:${s.userId}`));

await mongoose.connect(MONGO_URI);
startWorker(io);
server.listen(PORT, () => console.log(`Surveyllix server on http://localhost:${PORT}`));
