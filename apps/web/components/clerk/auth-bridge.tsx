"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { publishAuth } from "./auth-state";

/** Inside a `ClerkProvider`: copies Clerk's state into the auth store. Renders nothing. */
export function AuthBridge() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  useEffect(() => {
    publishAuth({ isLoaded, isSignedIn: Boolean(isLoaded && isSignedIn), email: isSignedIn ? email : null });
  }, [isLoaded, isSignedIn, email]);

  return null;
}
