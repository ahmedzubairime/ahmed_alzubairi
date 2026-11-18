import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/**
 * `next/image` may load only from the Supabase project's `public-media` bucket.
 * The host is read at build time; a build without the variable allows none.
 */
function publicMediaPattern(): URL[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return [];
  const { origin } = new URL(supabaseUrl);
  return [new URL(`${origin}/storage/v1/object/public/public-media/**`)];
}

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared", "@repo/db"],
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: publicMediaPattern() },
  // Native modules for the document watermark (§6.18). They load their own
  // platform binaries at run time, so they stay out of the bundle. `sharp` is
  // already on Next's built-in list; it is named here so the set is in one place.
  serverExternalPackages: ["@napi-rs/canvas", "sharp"],
  // The watermark font is read from disk, which tracing can't see. The open
  // route (`/api/documents/[id]/open`) and any other documents route carry it.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./assets/fonts/**/*"],
  },
  // PostHog through our own origin (§6.23): ad blockers and the CSP see one
  // host. EU cloud; static bundles come from its assets host.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://eu-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  // PostHog's paths end in "/"; without this each batch gets a 308 first.
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
