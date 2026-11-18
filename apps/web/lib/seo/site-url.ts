/**
 * The site's origin for absolute URLs (canonical, hreflang, Open Graph):
 * `NEXT_PUBLIC_APP_URL`, else the deployment's Vercel URL, else local dev.
 * Never a hardcoded domain.
 */
export function siteUrl(): URL {
  const configured = process.env["NEXT_PUBLIC_APP_URL"]?.trim();
  if (configured) {
    try {
      return new URL(new URL(configured).origin);
    } catch {
      // A malformed value falls through to the next source.
    }
  }
  const vercel = process.env["VERCEL_URL"]?.trim();
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
