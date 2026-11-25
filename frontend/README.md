# Surveyllix frontend (React 18 + Vite + Tailwind + React Router + Socket.IO)

Run order (see the project README): databases -> Python ML service (8000) -> Node server (4000) -> this app.

    npm install
    npm run dev      # http://localhost:5173, proxies /api and /socket.io to the Node server on 4000

Optional Google sign-in: copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID` (same ID as the server's `GOOGLE_CLIENT_ID`).
