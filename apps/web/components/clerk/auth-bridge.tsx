"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { NOT_LOADED, publishAuth } from "./auth-state";

/** Inside a `ClerkProvider`: copies Clerk's state into the auth store. Renders nothing. */
export function AuthBridge() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  useEffect(() => {
    publishAuth({ isLoaded, isSignedIn: Boolean(isLoaded && isSignedIn), email: isSignedIn ? email : null });
  }, [isLoaded, isSignedIn, email]);

  // Once its provider is gone (a client navigation from a private page to a
  // public one), nothing vouches for this state any more: back to not loaded
  // until the next bridge publishes. On unmount only, never between renders.
  useEffect(() => () => publishAuth(NOT_LOADED), []);

  return null;
}
