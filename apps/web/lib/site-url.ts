/**
 * Canonical base URL for the site. Used for metadataBase, sitemap, robots, and JSON-LD.
 * Prefer NEXT_PUBLIC_SITE_URL or SITE_URL in production; fallback to Vercel URL or localhost.
 */
export function getBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.VERCEL_URL;
  if (env) {
    return env.startsWith("http") ? env : `https://${env}`;
  }
  return "http://localhost:3000";
}
