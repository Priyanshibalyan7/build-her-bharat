import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Languages, Scissors, Search } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { ScanFrame } from "../ui.jsx";

const FEATURES = [
  { icon: Search, title: "Plain-language search", text: "Type what you saw, like “person in red jacket near the gate”." },
  { icon: Languages, title: "English and Hindi", text: "Hindi queries are translated automatically before searching." },
  { icon: Scissors, title: "Exact clips", text: "Jump to the second, or download just the matching segment." },
];
const STEPS = ["Upload your footage.", "We analyse the frames once.", "Search in your own words and get timestamps."];

export default function Landing() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  const d = (ms) => ({ animationDelay: `${ms}ms` });
  const cta = "press rounded-md bg-accent px-5 py-3 font-semibold text-on transition-transform hover:-translate-y-0.5";

  return (
    <div className="min-h-screen">
      <header className={`sticky top-0 z-30 transition-all duration-300 ${scrolled ? "border-b border-line bg-bg/70 backdrop-blur" : "border-b border-transparent"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-display text-2xl font-bold">Surveyllix</span>
          <nav className="flex items-center gap-4">
            <a href="#how" className="hidden text-mute transition-colors hover:text-ink sm:block">How it works</a>
            <Link to={user ? "/app" : "/login"} className="press rounded-md bg-accent px-4 py-2 font-semibold text-on transition-transform hover:-translate-y-0.5">
              {user ? "Open dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-24">
        <div>
          <h1 className="rise font-display text-6xl font-bold leading-[0.95] sm:text-7xl" style={d(0)}>Ask your video anything.</h1>
          <p className="rise mt-4 font-display text-3xl text-accent" style={d(150)}>Get the exact second.</p>
          <p className="rise mt-5 max-w-md text-lg text-mute" style={d(300)}>Hours of CCTV footage, searched in plain English or Hindi. Type what you saw and jump straight to it.</p>
          <div className="rise mt-7 flex flex-wrap gap-3" style={d(450)}>
            <Link to={user ? "/app" : "/login"} className={cta}>Get started</Link>
            <a href="#how" className="rounded-md border border-line px-5 py-3 transition-colors hover:border-accent">See how it works</a>
          </div>
        </div>
        <div className="rise" style={d(300)}><ScanFrame /></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group border-l-2 border-line pl-5 transition-colors hover:border-accent">
              <f.icon className="mb-3 text-accent transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-mute">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-12">
        <h2 className="font-display text-4xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="lift rounded-lg border border-line bg-panel p-5">
              <span className="font-display text-3xl font-bold text-accent">{i + 1}</span>
              <p className="mt-2">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-mute">Team TriTech</footer>
    </div>
  );
}
