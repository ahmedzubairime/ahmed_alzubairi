import type { MetadataRoute } from "next";

/** Never crawled: private areas, sign-in flows, the UI kit and the API. */
export const DISALLOWED_PATHS = [
  "/api/",
  "/*/account",
  "/*/dashboard",
  "/*/sign-in",
  "/*/sign-up",
  "/*/onboarding",
  "/*/ui-kit",
] as const;

/**
 * `robots.txt`: only production is crawled. Previews, staged builds without
 * the variable, and local dev disallow everything.
 */
export function robotsFor(vercelEnv: string | undefined, origin: URL): MetadataRoute.Robots {
  if (vercelEnv !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] },
    sitemap: new URL("/sitemap.xml", origin).toString(),
  };
}
