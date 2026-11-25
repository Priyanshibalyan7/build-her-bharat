import { useEffect, useRef, useState } from "react";
import { Upload, Search, Play, Download, Film } from "lucide-react";
import { uploadVideo, getStatus, searchVideo, videoUrl, clipUrl } from "../api.js";
import { ALLOWED, STAGE_LABEL, fmt } from "../util.js";
import { logVideo, logSearch } from "../store.js";
import Timeline from "../Timeline.jsx";

const EXAMPLES = ["person carrying a bag", "white car parked", "group of people running", "someone entering through the door"];
const strength = (i, n) => (i < n / 3 ? "Strong" : i < (2 * n) / 3 ? "Good" : "Weak");

export default function Workspace() {
  const [file, setFile] = useState(null);
  const [vid, setVid] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | uploading | indexing | ready | error
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const video = useRef(null);

  // Poll indexing status once per second. TODO: replace with Socket.IO events when the Node server exists.
  useEffect(() => {
    if (stage !== "indexing" || !vid) return;
    const timer = setInterval(async () => {
      try {
        const s = await getStatus(vid);
        setProgress(s.progress);
        setLabel(STAGE_LABEL[s.state] || s.state);
        if (s.state === "ready") setStage("ready");
        if (s.state === "error") { setError(s.error || "Indexing failed."); setStage("error"); }
      } catch (e) { setError(e.message); setStage("error"); }
    }, 1000);
    return () => clearInterval(timer);
  }, [stage, vid]);

  const pick = (f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.name.slice(f.name.lastIndexOf(".")).toLowerCase())) {
      setError(`Unsupported file type. Use ${ALLOWED.join(", ")}.`); return;
    }
    setError(""); setFile(f);
  };

  const start = async () => {
    if (!file) { setError("Choose a video file first."); return; }
    setError(""); setResult(null); setActive(null); setStage("uploading"); setLabel("Uploading"); setProgress(0);
    try {
      const { video_id } = await uploadVideo(file);
      logVideo(video_id, file.name);
      setVid(video_id); setStage("indexing"); setLabel(STAGE_LABEL.queued);
    } catch (e) { setError(e.message); setStage("error"); }
  };

  const runSearch = async (q = query) => {
    if (!q.trim() || stage !== "ready") return;
    setSearching(true); setError(""); setActive(null);
    const t0 = performance.now();
    try {
      const r = await searchVideo(vid, q.trim());
      logSearch(q.trim(), r.segments.length, Math.round(performance.now() - t0));
      setResult({ ...r, typed: q.trim(), ms: Math.round(performance.now() - t0) });
    } catch (e) { setError(e.message); }
    setSearching(false);
  };

  const play = (i) => {
    setActive(i);
    const v = video.current;
    if (v) { v.currentTime = result.segments[i].start; v.play(); }
  };

  const onTime = (e) => {
    const t = e.currentTarget.currentTime;
    setTime(t);
    if (active !== null && t >= result.segments[active].end) e.currentTarget.pause();
  };

  const segs = result?.segments || [];
  const busy = stage === "uploading" || stage === "indexing";

  return (
    <div>
      <h1 className="mb-4 font-display text-3xl font-bold">Search video</h1>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3 lg:order-2">
          <section className="rounded-lg border border-line bg-panel p-4">
            {vid ? (
              <video ref={video} src={videoUrl(vid)} controls className="w-full max-h-[460px] rounded-md bg-black"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onTimeUpdate={onTime} />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-mute">
                <Film aria-hidden="true" /> <p>Upload footage to see it here.</p>
              </div>
            )}
            <Timeline segments={segs} duration={duration} time={time} active={active} onPick={play} />
          </section>
        </div>

        <div className="space-y-5 lg:col-span-2 lg:order-1">
          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-2 font-semibold">Upload footage</h2>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-line p-5 text-center hover:border-accent focus-within:outline focus-within:outline-2"
            >
              <Upload aria-hidden="true" />
              <span>{file ? `${file.name} (${(file.size / 1048576).toFixed(1)} MB)` : "Drop a video here or choose a file"}</span>
              <input type="file" accept="video/*" className="sr-only" onChange={(e) => pick(e.target.files[0])} />
            </label>
            <button onClick={start} disabled={busy}
              className="mt-3 w-full rounded-md bg-accent px-4 py-2 font-semibold text-on disabled:opacity-50">
              Upload and index
            </button>
            {(busy || stage === "ready") && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${stage === "ready" ? 100 : progress}%` }} />
                </div>
                <p className="mt-1 text-sm text-mute" role="status">{stage === "ready" ? STAGE_LABEL.ready : label}</p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-line bg-panel p-4">
            <h2 className="mb-2 font-semibold">Search</h2>
            <form onSubmit={(e) => { e.preventDefault(); runSearch(); }} className="flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={stage !== "ready"}
                aria-label="Search query" placeholder="person in red jacket near the gate"
                className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 disabled:opacity-50" />
              <button disabled={stage !== "ready" || searching}
                className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 font-semibold text-on disabled:opacity-50">
                <Search size={16} aria-hidden="true" /> Search
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((x) => (
                <button key={x} disabled={stage !== "ready"} onClick={() => { setQuery(x); runSearch(x); }}
                  className="rounded-full border border-line px-3 py-1 text-sm text-mute hover:text-ink disabled:opacity-50">{x}</button>
              ))}
            </div>

            {error && <p role="alert" className="mt-3 text-bad">{error}</p>}

            <div aria-live="polite" className="mt-3">
              {searching && <p className="text-mute">Searching...</p>}
              {result && !searching && (
                <>
                  <p className="text-sm text-mute">
                    {segs.length} {segs.length === 1 ? "match" : "matches"} in {result.ms} ms
                    {result.query_used !== result.typed && <> - searched for "{result.query_used}"</>}
                  </p>
                  {!segs.length && <p className="mt-2">No matches. Try different words or describe what the person or object looks like.</p>}
                  <ul className="mt-2">
                    {segs.map((s, i) => (
                      <li key={i} className={`flex items-center justify-between gap-2 border-t border-line py-2 ${i === active ? "bg-bg" : ""}`}>
                        <div>
                          <p className="font-semibold">{fmt(s.start)} - {fmt(s.end)}</p>
                          <p className="text-sm text-mute">{Math.round(s.end - s.start)} s - {strength(i, segs.length)} match</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => play(i)} className="flex items-center gap-1 rounded-md bg-accent px-3 py-1 text-on">
                            <Play size={14} aria-hidden="true" /> Play
                          </button>
                          <a href={clipUrl(vid, s.start, s.end)} download className="flex items-center gap-1 text-accent underline">
                            <Download size={14} aria-hidden="true" /> Clip
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
