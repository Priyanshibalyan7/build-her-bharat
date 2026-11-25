import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutDashboard, LogOut, Search, User } from "lucide-react";
import { useAuth } from "./auth.jsx";
import { Avatar, useToast } from "./ui.jsx";

const LINKS = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/search", label: "Search video", icon: Search },
  { to: "/app/profile", label: "Profile", icon: User },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const down = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);

  const out = () => { logout(); toast("You are signed out."); nav("/"); };

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-panel p-4 lg:flex">
        <Link to="/" className="font-display text-2xl font-bold">Surveyllix</Link>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `relative flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${isActive ? "bg-bg font-semibold" : "text-mute hover:bg-bg hover:text-ink"}`}>
              {({ isActive }) => (<>
                <span className={`absolute bottom-2 left-0 top-2 w-0.5 rounded bg-accent transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
                <l.icon size={18} aria-hidden="true" /> {l.label}
              </>)}
            </NavLink>
          ))}
        </nav>
        <button onClick={out} className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-mute transition-colors hover:bg-bg hover:text-ink">
          <LogOut size={18} aria-hidden="true" /> Sign out
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur">
        <Link to="/" className="font-display text-xl font-bold lg:invisible">Surveyllix</Link>
        <div ref={box} className="relative">
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
            className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 transition-colors hover:border-accent">
            <Avatar user={user} size={32} />
            <span className="hidden max-w-[10rem] truncate sm:block">{user.name}</span>
            <ChevronDown size={16} aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          <div role="menu" className={`menu absolute right-0 top-12 w-60 rounded-lg border border-line bg-panel p-2 shadow-xl ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}>
            <p className="truncate px-3 py-1 text-sm text-mute">{user.email}</p>
            <Link role="menuitem" to="/app/profile" className="flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-bg"><User size={16} aria-hidden="true" /> Profile</Link>
            <button role="menuitem" onClick={out} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-bg"><LogOut size={16} aria-hidden="true" /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 lg:px-8">
        <div key={loc.pathname} className="page-in mx-auto max-w-6xl"><Outlet /></div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-panel lg:hidden" aria-label="Main">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${isActive ? "text-accent" : "text-mute"}`}>
            <l.icon size={20} aria-hidden="true" /> {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
