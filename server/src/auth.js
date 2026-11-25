import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { cfg } from "./config.js";
import { User, pubUser } from "./models.js";

export const sign = (u) => jwt.sign({ sub: u.id }, cfg.jwt, { expiresIn: "7d" });

// Protects API routes. Media tokens (typ "media") are rejected here on purpose.
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return res.status(401).json({ detail: "Please sign in." });
  try {
    const p = jwt.verify(t, cfg.jwt);
    if (p.typ) throw new Error("wrong token type");
    req.userId = p.sub;
    next();
  } catch {
    res.status(401).json({ detail: "Your session has expired. Please sign in again." });
  }
}

const gc = cfg.googleId ? new OAuth2Client(cfg.googleId) : null;
const credsMsg = "Email or password is incorrect.";
const r = Router();

r.post("/signup", async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(1, "Enter your name.").max(80),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters.").max(100),
  }).parse(req.body);
  if (await User.findOne({ email: b.email.toLowerCase() }))
    return res.status(409).json({ detail: "An account with this email already exists. Sign in instead." });
  const u = await User.create({ name: b.name, email: b.email, passwordHash: await bcrypt.hash(b.password, 10) });
  res.status(201).json({ token: sign(u), user: pubUser(u) });
});

r.post("/login", async (req, res) => {
  const b = z.object({ email: z.string().email(credsMsg), password: z.string().min(1, credsMsg) }).parse(req.body);
  const u = await User.findOne({ email: b.email.toLowerCase() });
  if (!u?.passwordHash || !(await bcrypt.compare(b.password, u.passwordHash)))
    return res.status(401).json({ detail: credsMsg });
  res.json({ token: sign(u), user: pubUser(u) });
});

r.post("/google", async (req, res) => {
  if (!gc) return res.status(501).json({ detail: "Google sign-in is not configured on the server." });
  const { credential } = z.object({ credential: z.string() }).parse(req.body);
  let p;
  try {
    p = (await gc.verifyIdToken({ idToken: credential, audience: cfg.googleId })).getPayload();
  } catch {
    return res.status(401).json({ detail: "Google sign-in could not be verified. Try again." });
  }
  if (!p?.email || !p.email_verified) return res.status(401).json({ detail: "Your Google email is not verified." });
  let u = await User.findOne({ email: p.email.toLowerCase() });
  if (!u) u = await User.create({ name: p.name || p.email, email: p.email, googleId: p.sub, avatar: p.picture });
  else if (!u.googleId) { u.googleId = p.sub; await u.save(); }
  res.json({ token: sign(u), user: pubUser(u) });
});

r.get("/me", requireAuth, async (req, res) => {
  const u = await User.findById(req.userId);
  if (!u) return res.status(401).json({ detail: "Account not found. Please sign in again." });
  res.json(pubUser(u));
});

r.patch("/me", requireAuth, async (req, res) => {
  const b = z.object({
    name: z.string().trim().min(1, "Name cannot be empty.").max(80).optional(),
    org: z.string().trim().max(100).optional(),
    role: z.string().trim().max(60).optional(),
    avatar: z.string().max(280000).startsWith("data:image/", "Avatar must be an image.").nullable().optional(),
  }).parse(req.body);
  const u = await User.findById(req.userId);
  if (!u) return res.status(401).json({ detail: "Account not found. Please sign in again." });
  Object.assign(u, b);
  await u.save();
  res.json(pubUser(u));
});

export default r;
