# Surveyllix server (Node 20+, Express, MongoDB, Redis + BullMQ, Socket.IO)

Sits between the React app and the Python ML service.

    docker compose up -d          # MongoDB, Redis, MinIO (from the folder with docker-compose.yml)
    cd server
    copy .env.example .env        # then fill in JWT_SECRET (cp on Mac/Linux)
    npm install
    npm run dev                   # http://localhost:4000

No Docker? Use free cloud services instead: MongoDB Atlas (free M0 cluster) for MONGO_URI and Upstash Redis (free) for REDIS_URL (use its rediss:// URL).

Start the Python service too (`cd backend && python -m uvicorn main:app --reload`). Keep it private: it has no login of its own, only this server should call it.

What it does: JWT login (email + Google), profile, dashboard stats, upload -> BullMQ queue -> ML service, live progress over Socket.IO, and authenticated streaming of videos and clips. If MINIO_ENDPOINT is set, originals are also archived in MinIO.
