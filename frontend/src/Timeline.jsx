import { fmt } from "./util.js";

// Bar for the whole video; each search result is a marker placed by its start time.
export default function Timeline({ segments, duration, time, active, onPick }) {
  if (!duration) return null;
  return (
    <div className="mt-3">
      <div className="relative h-9 rounded-md border border-line bg-bg" role="group" aria-label="Matches on the video timeline">
        {segments.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            aria-label={`Match ${i + 1}, ${fmt(s.start)} to ${fmt(s.end)}`}
            title={`${fmt(s.start)} - ${fmt(s.end)}`}
            className={`absolute top-1 bottom-1 rounded-sm border ${i === active ? "bg-accent border-ink" : "bg-accent/60 border-accent"}`}
            style={{ left: `${(s.start / duration) * 100}%`, width: `max(6px, ${((s.end - s.start) / duration) * 100}%)` }}
          />
        ))}
        <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `${(time / duration) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-mute"><span>00:00</span><span>{fmt(duration)}</span></div>
    </div>
  );
}
