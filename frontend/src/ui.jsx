import { createContext, useCallback, useContext, useEffect, useState } from "react";

const T = createContext(() => {});
export const useToast = () => useContext(T);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = "ok") => {
    const id = Math.random();
    setItems((a) => [...a, { id, text, kind }]);
    setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <T.Provider value={push}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 lg:bottom-6" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast rounded-md border bg-panel px-4 py-2 shadow-lg ${i.kind === "bad" ? "border-bad text-bad" : "border-line"}`}>{i.text}</div>
        ))}
      </div>
    </T.Provider>
  );
}

export function Avatar({ user, size = 40 }) {
  const ini = (user.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return user.avatar ? (
    <img src={user.avatar} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <span style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full bg-accent font-semibold text-on">{ini}</span>
  );
}

export function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// Looping "camera feed": a scan line sweeps while detection boxes appear.
export function ScanFrame({ className = "" }) {
  const box = (l, t, w, h, d, label) => (
    <div className="bbox" style={{ left: l, top: t, width: w, height: h, animationDelay: d }}><b>{label}</b></div>
  );
  return (
    <div className={`scanframe relative aspect-video overflow-hidden rounded-lg border border-white/10 ${className}`}
      role="img" aria-label="Animated camera view detecting a person, a bag and a car">
      <div className="scan-line" />
      <span className="absolute left-3 top-3 flex items-center gap-2 text-xs text-white/80"><i className="rec" />CAM 04</span>
      <span className="absolute right-3 top-3 text-xs tabular-nums text-white/80">00:14:32</span>
      {box("18%", "28%", "20%", "52%", "1.2s", "person 0.92")}
      {box("46%", "52%", "12%", "26%", "2.2s", "bag 0.88")}
      {box("66%", "36%", "22%", "44%", "3.2s", "car 0.95")}
    </div>
  );
}
