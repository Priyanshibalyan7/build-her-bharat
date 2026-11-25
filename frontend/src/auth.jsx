import { createContext, useContext, useState } from "react";
import { store } from "./store.js";

// DEMO AUTH: accounts live in this browser only. Replace with the Node/Express + JWT API later.
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => store.get("sv_session", null));
  const save = (u) => { setUser(u); store.set("sv_session", u); };

  const signup = async ({ name, email, password }) => {
    const users = store.get("sv_users", {});
    const key = email.trim().toLowerCase();
    if (users[key]) throw new Error("An account with this email already exists. Sign in instead.");
    const profile = { name: name.trim(), email: key, org: "", role: "Analyst", avatar: null, joined: Date.now() };
    users[key] = { hash: await sha(password), profile };
    store.set("sv_users", users);
    save(profile);
  };
  const login = async ({ email, password }) => {
    const u = store.get("sv_users", {})[email.trim().toLowerCase()];
    if (!u || u.hash !== (await sha(password))) throw new Error("Email or password is incorrect.");
    save(u.profile);
  };
  const demo = () => save({ name: "Demo User", email: "demo@surveyllix.app", org: "Team TriTech", role: "Security analyst", avatar: null, joined: Date.now() });
  const logout = () => { setUser(null); store.set("sv_session", null); };
  const update = (patch) => {
    const next = { ...user, ...patch };
    save(next);
    const users = store.get("sv_users", {});
    if (users[next.email]) { users[next.email].profile = next; store.set("sv_users", users); }
  };
  return <Ctx.Provider value={{ user, signup, login, demo, logout, update }}>{children}</Ctx.Provider>;
}
