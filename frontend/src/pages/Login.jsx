import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { ScanFrame } from "../ui.jsx";

const inp = "w-full rounded-md border border-line bg-bg px-3 py-2.5 transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)] focus:outline-none";

export default function Login() {
  const { user, login, signup, demo } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const to = loc.state?.from || "/app";
  const [mode, setMode] = useState("in");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => { if (user) nav(to, { replace: true }); }, [user, nav, to]);
  const fail = (m) => { setErr(m); setShake((s) => s + 1); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (mode === "up" && !f.name.trim()) return fail("Enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return fail("Enter a valid email address.");
    if (f.password.length < 6) return fail("Password must be at least 6 characters.");
    setBusy(true);
    try { await (mode === "in" ? login(f) : signup(f)); } catch (x) { fail(x.message); }
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-10">
        <div className="page-in w-full max-w-sm">
          <Link to="/" className="font-display text-3xl font-bold">Surveyllix</Link>
          <h1 className="mt-6 text-2xl font-semibold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-mute">{mode === "in" ? "Sign in to search your footage." : "It takes a few seconds."}</p>

          <div className="relative mt-6 grid grid-cols-2 rounded-md border border-line bg-panel p-1" role="tablist">
            <span className="tab-ind" style={{ transform: `translateX(${mode === "in" ? 0 : 100}%)` }} />
            {[["in", "Sign in"], ["up", "Create account"]].map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(""); }}
                className={`relative z-10 py-2 font-medium transition-colors ${mode === m ? "text-on" : "text-mute"}`}>{l}</button>
            ))}
          </div>

          <form onSubmit={submit} noValidate key={shake} className={`mt-5 space-y-4 ${shake ? "shake" : ""}`}>
            {mode === "up" && (
              <label className="block"><span className="mb-1 block text-sm">Name</span>
                <input className={inp} value={f.name} onChange={set("name")} autoComplete="name" /></label>
            )}
            <label className="block"><span className="mb-1 block text-sm">Email</span>
              <input className={inp} type="email" value={f.email} onChange={set("email")} autoComplete="email" /></label>
            <label className="block"><span className="mb-1 block text-sm">Password</span>
              <span className="relative block">
                <input className={`${inp} pr-10`} type={show ? "text" : "password"} value={f.password} onChange={set("password")}
                  autoComplete={mode === "in" ? "current-password" : "new-password"} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-mute hover:text-ink">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span></label>
            {err && <p role="alert" className="text-sm text-bad">{err}</p>}
            <button disabled={busy} className="press flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 font-semibold text-on transition-transform hover:-translate-y-0.5 disabled:opacity-60">
              {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button onClick={demo} className="mt-3 w-full rounded-md border border-line py-2.5 transition-colors hover:border-accent">Continue as demo user</button>
          <p className="mt-4 text-xs text-mute">Demo sign-in: accounts are saved in this browser only.</p>
        </div>
      </div>
      <div className="hidden flex-col justify-center gap-6 bg-[#0b1522] p-12 lg:flex">
        <ScanFrame />
        <p className="max-w-md font-display text-3xl font-semibold text-white">Hours of footage. One sentence to find the moment.</p>
      </div>
    </div>
  );
}
