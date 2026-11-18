"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { AuthBridge } from "./auth-bridge";

/**
 * Clerk for the public pages, loaded by `LazyClerk` in its own chunk. It
 * renders no Clerk UI, so it needs no appearance or localization: only the
 * URLs, as the account and auth pages set them.
 */
export default function PublicClerk({
  signInUrl,
  signUpUrl,
  afterSignOutUrl,
}: {
  signInUrl: string;
  signUpUrl: string;
  afterSignOutUrl: string;
}) {
  return (
    <ClerkProvider signInUrl={signInUrl} signUpUrl={signUpUrl} afterSignOutUrl={afterSignOutUrl}>
      <AuthBridge />
    </ClerkProvider>
  );
}
