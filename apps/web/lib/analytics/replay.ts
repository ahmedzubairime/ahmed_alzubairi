import { LOCALES } from "@repo/shared";

/**
 * Sections where session replay never runs (§6.23, §9): the client's account,
 * the dashboard, and the sign-in, sign-up and onboarding steps.
 */
const PRIVATE_SECTIONS = ["account", "dashboard", "sign-in", "sign-up", "onboarding"] as const;

const PUBLIC_PAGE = new RegExp(`^/(${LOCALES.join("|")})(?:/([^/?#]*))?`);

/**
 * Whether session replay may record this page: only a public page under a
 * language. Anything it can't read as one (no language, an encoded path it
 * can't decode, a private section) is refused, so a new private route is safe
 * unless it sits under a public section.
 */
export function replayAllowed(pathname: string): boolean {
  let path: string;
  try {
    path = decodeURI(pathname).toLowerCase();
  } catch {
    return false;
  }
  const match = PUBLIC_PAGE.exec(path);
  if (!match) return false;
  const rest = path.slice(match[1].length + 1);
  if (rest !== "" && !rest.startsWith("/")) return false;
  const section = match[2] ?? "";
  return !(PRIVATE_SECTIONS as readonly string[]).includes(section);
}
