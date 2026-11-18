import type { Instrumentation } from "next";

/**
 * Server errors go to PostHog Error tracking (§6.23): the route path without
 * its query, never headers or body, under the fixed distinct id `server`.
 * Node.js runtime only; Next awaits this, so the send finishes before the
 * function stops.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerError } = await import("./lib/analytics/server");
  await captureServerError(error, {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
