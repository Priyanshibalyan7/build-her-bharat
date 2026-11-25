# Surveyllix frontend (React 18 + Vite + Tailwind + React Router)

1. Backend: `cd backend && python -m uvicorn main:app --reload`
2. Here: `npm install` then `npm run dev`, open http://localhost:5173

Routes: `/` landing, `/login` sign in / create account (or "Continue as demo user"), `/app` dashboard, `/app/search` video search, `/app/profile` profile.

Auth is a browser-only demo (see src/auth.jsx). Swap it for the Node/Express JWT + Google OAuth API later; src/api.js already sends a stored token.
