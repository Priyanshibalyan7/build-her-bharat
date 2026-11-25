import { createContext, useContext, useEffect, useState } from "react";
import { closeSocket, getMe, getToken, googleApi, loginApi, patchMe, setToken, signupApi } from "./api.js";
import { useToast } from "./ui.jsx";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken()); // true while a saved token is being checked

  useEffect(() => {
    if (!getToken()) return;
    getMe().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener("sv-unauth", out);
    return () => window.removeEventListener("sv-unauth", out);
  }, []);

  const accept = ({ token, user: u }) => { setToken(token); setUser(u); };
  const signup = async (f) => accept(await signupApi(f));
  const login = async (f) => accept(await loginApi(f));
  const google = async (credential) => accept(await googleApi(credential));
  const logout = () => { setToken(null); closeSocket(); setUser(null); };
  const update = (patch) => {
    const prev = user;
    setUser({ ...user, ...patch }); // show the change immediately, undo it if the server refuses
    patchMe(patch).then(setUser).catch((e) => { setUser(prev); toast(e.message, "bad"); });
  };

  return <Ctx.Provider value={{ user, loading, signup, login, google, logout, update }}>{children}</Ctx.Provider>;
}
