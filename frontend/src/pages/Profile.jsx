import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, LogOut } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { Avatar, useToast } from "../ui.jsx";
import { clearActivity } from "../api.js";

const inp = "w-full rounded-md border border-line bg-bg px-3 py-2.5 transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)] focus:outline-none";
const ROLES = ["Security analyst", "Analyst", "Operations manager", "Product manager", "Student"];

export default function Profile() {
  const { user, update, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: user.name, org: user.org || "", role: user.role || "Analyst" });
  const dirty = f.name !== user.name || f.org !== (user.org || "") || f.role !== (user.role || "Analyst");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const photo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 200 * 1024) return toast("Choose an image under 200 KB.", "bad");
    const r = new FileReader();
    r.onload = () => { update({ avatar: r.result }); toast("Photo updated."); };
    r.readAsDataURL(file);
  };
  const save = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return toast("Name cannot be empty.", "bad");
    update({ ...f, name: f.name.trim() });
    toast("Profile saved.");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-bold">Profile</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-line bg-panel p-6 text-center">
          <label className="group relative mx-auto block h-24 w-24 cursor-pointer">
            <Avatar user={user} size={96} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Camera aria-hidden="true" />
            </span>
            <input type="file" accept="image/*" onChange={photo} className="sr-only" aria-label="Change profile photo" />
          </label>
          <p className="mt-3 text-lg font-semibold">{user.name}</p>
          <p className="text-mute">{user.email}</p>
          <p className="mt-1 text-sm text-mute">Member since {new Date(user.joined).toLocaleDateString()}</p>
          {user.avatar && <button onClick={() => { update({ avatar: null }); toast("Photo removed."); }} className="mt-3 text-sm text-accent underline">Remove photo</button>}
        </section>

        <section className="space-y-6 lg:col-span-2">
          <form onSubmit={save} className="space-y-4 rounded-lg border border-line bg-panel p-6">
            <h2 className="font-semibold">Details</h2>
            <label className="block"><span className="mb-1 block text-sm">Name</span><input className={inp} value={f.name} onChange={set("name")} /></label>
            <label className="block"><span className="mb-1 block text-sm">Email</span><input className={`${inp} opacity-60`} value={user.email} readOnly /></label>
            <label className="block"><span className="mb-1 block text-sm">Organisation</span><input className={inp} value={f.org} onChange={set("org")} /></label>
            <label className="block"><span className="mb-1 block text-sm">Role</span>
              <select className={inp} value={f.role} onChange={set("role")}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
            <button disabled={!dirty} className="press rounded-md bg-accent px-5 py-2.5 font-semibold text-on transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">Save changes</button>
          </form>

          <div className="space-y-3 rounded-lg border border-line bg-panel p-6">
            <h2 className="font-semibold">Account</h2>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => clearActivity().then(() => toast("Activity history cleared.")).catch((e) => toast(e.message, "bad"))}
                className="rounded-md border border-line px-4 py-2 transition-colors hover:border-accent">Clear activity history</button>
              <button onClick={() => { logout(); toast("You are signed out."); nav("/"); }}
                className="flex items-center gap-2 rounded-md border border-bad px-4 py-2 text-bad transition-colors hover:bg-bad hover:text-on">
                <LogOut size={16} aria-hidden="true" /> Sign out</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
