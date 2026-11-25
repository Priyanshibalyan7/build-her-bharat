import { io } from "socket.io-client";

// All backend calls live here. The JWT is stored once and sent with every request.
export const getToken = () => { try { return localStorage.getItem("token"); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem("token", t) : localStorage.removeItem("token"); } catch { /* ignore */ } };

async function req(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let r;
  try {
    r = await fetch(url, { ...opts, headers });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Cannot reach the server. Check that the Node server is running on port 4000.");
  }
  if (!r.ok) {
    if (r.status === 401 && t) { setToken(null); window.dispatchEvent(new Event("sv-unauth")); }
    let msg = `Request failed (${r.status}).`;
    try { const d = await r.json(); if (typeof d.detail === "string") msg = d.detail; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return r.json();
}
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// auth + profile
export const signupApi = (b) => req("/api/auth/signup", json("POST", b));
export const loginApi = (b) => req("/api/auth/login", json("POST", b));
export const googleApi = (credential) => req("/api/auth/google", json("POST", { credential }));
export const getMe = () => req("/api/me");
export const patchMe = (b) => req("/api/me", json("PATCH", b));
export const getStats = () => req("/api/stats");
export const clearActivity = () => req("/api/activity", { method: "DELETE" });

// video
export const uploadVideo = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return req("/api/upload", { method: "POST", body: fd });
};
export const getStatus = (id) => req(`/api/status/${id}`);
export const searchVideo = (id, query) => req("/api/search", json("POST", { video_id: id, query }));
// <video> and download links cannot send headers, so the token rides in the query string.
export const videoUrl = (id) => `/api/video/${id}?token=${getToken()}`;
export const clipUrl = (id, s, e) => `/api/clip/${id}?start=${s}&end=${e}&token=${getToken()}`;

// real-time progress
let sock = null;
export const connectSocket = () => (sock ??= io({ auth: (cb) => cb({ token: getToken() }) }));
export const closeSocket = () => { sock?.disconnect(); sock = null; };
