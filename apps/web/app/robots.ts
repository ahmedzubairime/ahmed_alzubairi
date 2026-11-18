import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { robotsFor, siteUrl } from "@/lib/seo";

/**
 * Read on request: CLI deploys carry no Vercel system variables at build time,
 * so `VERCEL_ENV` is only known at run time.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsFor(process.env["VERCEL_ENV"], siteUrl());
}
