import { Link } from "react-router-dom";
import { Film, Search } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useCountUp } from "../ui.jsx";
import { store } from "../store.js";
import { ago } from "../util.js";

function Stat({ label, value, suffix = "" }) {
  const v = useCountUp(value);
  return (
    <div className="p-4">
      <p className="text-sm text-mute">{label}</p>
      <p className="font-display text-4xl font-bold tabular-nums">{v}{suffix}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const videos = store.get("sv_videos", []);
  const searches = store.get("sv_searches", []);
  const matches = searches.reduce((a, s) => a + s.count, 0);
  const avg = searches.length ? Math.round(searches.reduce((a, s) => a + s.ms, 0) / searches.length) : 0;
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold">{hello}, {user.name.split(" ")[0]}</h1>
          <p className="text-mute">Here is what has been happening with your footage.</p>
        </div>
        <Link to="/app/search" className="press flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 font-semibold text-on transition-transform hover:-translate-y-0.5">
          <Search size={18} aria-hidden="true" /> Search a video
        </Link>
      </div>

      <div className="grid grid-cols-2 divide-x divide-line rounded-lg border border-line bg-panel lg:grid-cols-4">
        <Stat label="Videos uploaded" value={videos.length} />
        <Stat label="Searches run" value={searches.length} />
        <Stat label="Matches found" value={matches} />
        <Stat label="Average search time" value={avg} suffix=" ms" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 font-semibold">Recent searches</h2>
          {searches.length ? (
            <ul>{searches.slice(0, 6).map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-bg">
                <span className="truncate">{s.q}</span>
                <span className="shrink-0 text-sm text-mute">{s.count} {s.count === 1 ? "match" : "matches"} - {ago(s.ts)}</span>
              </li>
            ))}</ul>
          ) : <p className="text-mute">No searches yet. Upload a video and ask it something.</p>}
        </section>
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 font-semibold">Recent uploads</h2>
          {videos.length ? (
            <ul>{videos.slice(0, 6).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-bg">
                <span className="flex min-w-0 items-center gap-2"><Film size={16} className="shrink-0 text-accent" aria-hidden="true" /><span className="truncate">{v.name}</span></span>
                <span className="shrink-0 text-sm text-mute">{ago(v.ts)}</span>
              </li>
            ))}</ul>
          ) : <p className="text-mute">No uploads yet. Your footage will be listed here.</p>}
        </section>
      </div>
    </div>
  );
}
