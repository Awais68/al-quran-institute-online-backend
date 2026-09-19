import "dotenv/config";

// Single source of truth for CORS. The HTTP server and the Socket.IO server
// must agree, otherwise realtime silently dies in production while REST works.
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://alquraninstituteonline.com",
  "https://www.alquraninstituteonline.com",
  "https://al-quran-institute-academy-frontend.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const UNIQUE_ORIGINS = [...new Set(ALLOWED_ORIGINS)];

/**
 * Every Vercel deployment of the frontend gets its own hostname — the
 * production alias, `...-hamzajiis-projects.vercel.app`, and a fresh one per
 * preview build. Listing them by hand means the production origin is blocked
 * the moment the alias changes (it was), so match the project's deployments by
 * shape instead.
 */
const VERCEL_DEPLOYMENT =
  /^https:\/\/al-quran-institute-academy-frontend[a-z0-9-]*\.vercel\.app$/;

export function isAllowedOrigin(origin) {
  // No Origin header at all: curl, server-to-server, health checks.
  if (!origin) return true;
  if (UNIQUE_ORIGINS.includes(origin)) return true;
  return VERCEL_DEPLOYMENT.test(origin);
}

export default UNIQUE_ORIGINS;
