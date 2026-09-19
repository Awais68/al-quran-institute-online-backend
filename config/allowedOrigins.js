import "dotenv/config";

// Single source of truth for CORS. The HTTP server and the Socket.IO server
// must agree, otherwise realtime silently dies in production while REST works.
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://al-quran-institute-academy-frontend.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const UNIQUE_ORIGINS = [...new Set(ALLOWED_ORIGINS)];

export default UNIQUE_ORIGINS;
