// Client for the Python (FastAPI) analysis service.
import fs from "node:fs";
import fsp from "node:fs/promises";
import { cfg } from "./config.js";

async function json(r) {
  if (!r.ok) {
    let m = `Analysis service error (${r.status}).`;
    try { const d = await r.json(); if (typeof d.detail === "string") m = d.detail; } catch { /* keep default */ }
    const e = new Error(m);
    e.status = [400, 409].includes(r.status) ? r.status : 502;
    throw e;
  }
  return r.json();
}
export async function call(path, init) {
  try { return await fetch(cfg.ml + path, init); }
  catch {
    const e = new Error("The analysis service is not running. Start the Python backend on port 8000.");
    e.status = 503;
    throw e;
  }
}
export async function mlUpload(file, name) {
  const blob = fs.openAsBlob ? await fs.openAsBlob(file) : new Blob([await fsp.readFile(file)]);
  const fd = new FormData();
  fd.append("file", blob, name);
  return (await json(await call("/api/upload", { method: "POST", body: fd }))).video_id;
}
export const mlStatus = async (id) => json(await call(`/api/status/${id}`));
export const mlSearch = async (id, query) =>
  json(await call("/api/search", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: id, query }) }));
