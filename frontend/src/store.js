// Small localStorage helpers. Every access is wrapped in try/catch (storage can be blocked).
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
export const store = { get, set };
export const logVideo = (id, name) => set("sv_videos", [{ id, name, ts: Date.now() }, ...get("sv_videos", [])].slice(0, 20));
export const logSearch = (q, count, ms) => set("sv_searches", [{ q, count, ms, ts: Date.now() }, ...get("sv_searches", [])].slice(0, 50));
