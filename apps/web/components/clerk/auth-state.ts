"use client";

import { useSyncExternalStore } from "react";

/**
 * Who the visitor is, as far as the public pages need to know (§13
 * Performance): signed in or not, and their email for prefilling a form.
 *
 * Public pages don't load Clerk up front. A bridge inside a `ClerkProvider`
 * publishes here once Clerk is ready, and the components read this store
 * instead of Clerk's hooks. Until then they show the signed-out state, which
 * is always safe: a signed-in visitor who follows a sign-in link is sent on.
 */
export type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  email: string | null;
};

export const NOT_LOADED: AuthState = { isLoaded: false, isSignedIn: false, email: null };

let state: AuthState = NOT_LOADED;
const listeners = new Set<() => void>();
const loadRequests = new Set<() => void>();
let requested = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called by the bridge inside a `ClerkProvider`. Ignores no-op updates. */
export function publishAuth(next: AuthState): void {
  if (next.isLoaded === state.isLoaded && next.isSignedIn === state.isSignedIn && next.email === state.email) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
}

/** The auth state; `NOT_LOADED` on the server and while hydrating. */
export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => NOT_LOADED);
}

export function readAuth(): AuthState {
  return state;
}

/**
 * Asks the lazy loader to load Clerk now (the visitor is about to use an
 * auth-aware control) instead of waiting for idle. Safe to call often.
 */
export function requestClerk(): void {
  if (state.isLoaded) return;
  requested = true;
  for (const request of loadRequests) request();
}

/** For the loader: `onRequest` runs on every `requestClerk()` call. */
export function onClerkRequest(onRequest: () => void): () => void {
  if (requested) onRequest();
  loadRequests.add(onRequest);
  return () => loadRequests.delete(onRequest);
}

/** Resolves with the auth state once Clerk has loaded, asking for it first. */
export function whenClerkLoaded(): Promise<AuthState> {
  if (state.isLoaded) return Promise.resolve(state);
  return new Promise((resolve) => {
    const unsubscribe = subscribe(() => {
      if (!state.isLoaded) return;
      unsubscribe();
      resolve(state);
    });
    requestClerk();
  });
}

/** Tests only: back to a fresh page. */
export function resetAuthStateForTests(): void {
  state = NOT_LOADED;
  requested = false;
  listeners.clear();
  loadRequests.clear();
}
