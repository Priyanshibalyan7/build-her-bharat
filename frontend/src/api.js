// All backend calls live here. When login (JWT) is added, only this file changes.
const token = () => {
  try { return localStorage.getItem("token"); } catch { return null; }
};

async function req(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let r;
  try {
    r = await fetch(url, { ...opts, headers });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Cannot reach the server. Check that the backend is running on port 8000.");
  }
  if (!r.ok) {
    let msg = `Request failed (${r.status}).`;
    try { const d = await r.json(); if (typeof d.detail === "string") msg = d.detail; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return r.json();
}

export const uploadVideo = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return req("/api/upload", { method: "POST", body: fd });
};
export const getStatus = (id) => req(`/api/status/${id}`);
export const searchVideo = (id, query) =>
  req("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: id, query }),
  });
export const videoUrl = (id) => `/api/video/${id}`;
export const clipUrl = (id, s, e) => `/api/clip/${id}?start=${s}&end=${e}`;
