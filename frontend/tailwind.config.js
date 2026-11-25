export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", panel: "var(--panel)", ink: "var(--ink)", mute: "var(--mute)",
        line: "var(--line)", accent: "var(--accent)", on: "var(--on)", bad: "var(--bad)", ok: "var(--ok)",
      },
      fontFamily: {
        display: ['"Barlow Condensed"', "Arial Narrow", "sans-serif"],
        sans: ["Inter", '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
      },
    },
  },
};
