# Plan

The build order for the Ahmed Alzubairi website. `docs/project.md` describes each feature in detail.

The PRD's four stages map to these phases: stage 1 is Phases 1–2, stage 2 is Phases 3–4, stage 3 is Phases 5–6. Stage 4 (recorded courses and trainee certificates) is out of scope until its own document exists.

## Rules

- Build phases in this order. Don't add, remove, or reorder phases.
- Every phase after Phase 0 has two parallel lanes, one per developer, so nobody waits.
- Each phase is one board in JSM HQ. The lead creates the board and its tasks there, with the product owner, before the phase starts. The next phase can be broken down while the current one is being built.
- Tasks and their status live only in JSM HQ. This file never lists tasks.
- A phase is done when all its tasks are merged, its "Done when" checks pass on the latest Vercel preview, it was tested on mobile and desktop, in both languages and both themes, and Ahmed has reviewed and approved it. Production goes live only once, in Phase 7.
- Each phase lists the keys it needs. When an agent reaches a step that needs one, it stops and asks (see `CLAUDE.md`), and the product owner adds it. Agents never create accounts or handle raw keys in chat.
- Keep JSM HQ's "Export plan to docs/plan.md" off. It would overwrite this file.

---

## Phase 0 — Setup

**Goal:** an empty app that builds and deploys. This is the only phase with one lane, because everything else builds on it.

**Lanes:** one. The lead plans it like any other phase, and gives every task to one developer.

**Keys needed:** none at the start. The product owner connects Vercel during this phase, before its last task: imports the repo (automatic promotion off), allows `*.vercel.app` in each developer's sandbox, and adds `VERCEL_AUTOMATION_BYPASS_SECRET` to each developer's env file (Vercel → Deployment Protection → Protection Bypass for Automation). The lead plans the Vercel check as the last task.

| Includes | project.md |
| --- | --- |
| Monorepo with `apps/web`, `packages/shared`, `packages/db` | §10 |
| Next.js app with TypeScript and Tailwind | §3 |
| Vercel project: a preview per PR, production from `main` (automatic promotion off) | §3, §4 |
| `.env.example` with every variable | §11 |

**Done when:** a PR gets a Vercel preview URL, and the home page loads on it.

---

## Phase 1 — Foundation

**Goal:** the shared contract, the database, sign-in, and the empty shells in both languages.

**Keys needed:** the Supabase dev project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`), the Supabase MCP connected to each developer and scoped to the dev project, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, and Clerk set up as a third-party auth provider in Supabase

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Contract + database** | Supabase migrations for all tables, Storage buckets, RLS policies and grants, seeded roles, `has_permission`, the user and service clients, generated types. `PERMISSIONS`, limits and shared types for every API route. | §5, §7, §8 |
| **B — Auth + shells** | Clerk sign in / sign up with `arSA`, onboarding page, `profiles` row, middleware, return path. `next-intl` routing, RTL, theme switch, design tokens, fonts. Public header and footer, empty account and dashboard layouts. | §6.1, §6.16, §13 |

Lane B also checks the two items in §14 "To verify in Phase 1" and reports the result.

**Done when:** migrations run on dev; a new user signs up, completes onboarding and lands on an empty account page; `/ar` and `/en` show the shell, mirrored, in both themes.

---

## Phase 2 — Public site + content dashboard

**Goal:** the public site reads from the database, and the team can edit all of it.

**Keys needed:** `ARCJET_KEY`

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Content dashboard** | Content editors with Arabic and English fields, draft/published, preview, Tiptap, image upload. Home sections (edit, hide, reorder), quick stats, testimonials and logos with consent and admin approval, site settings. Cache revalidation on publish. | §6.2, §6.11, §6.20 |
| **B — Public pages** | `lib/content`. Home, about, expertise, services, projects with filters and hidden names, clients and testimonials, public document list, FAQ, legal pages. Contact form with Arcjet, saved to `contact_messages`. Missing-translation behavior. | §6.2–6.6, §6.11–6.14, §6.25 |

Lane B builds against made-up seed content until Lane A is merged.

**Done when:** an edit in the dashboard appears on the public page after publishing; a section hidden there disappears; a testimonial without consent or admin approval never appears; a project with a hidden name doesn't send the name to the browser; an English-only item is absent from `/ar`.

---

## Phase 3 — Team + email

**Goal:** the team signs in with the right permissions, and the site sends email.

**Keys needed:** `RESEND_API_KEY`, `EMAIL_FROM`, a domain verified in Resend with SPF and DKIM, `CRON_SECRET`, `CLERK_WEBHOOK_SIGNING_SECRET`, and a Clerk webhook to `/api/clerk/webhook`. A verified domain is required: Resend won't send to real recipients without one. Any domain the product owner controls works until the final one is chosen.

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Team + clients** | Team and role management, invitations, permission editing, `audit_log`, disabling members. Clients section. Client disable and reactivate with Clerk ban. Profile page and account disable. Dashboard sections limited by permission. | §5, §6.16, §6.19, §6.20 |
| **B — Email + notifications** | `email_outbox`, React Email templates in Arabic and English, template editor, notification preferences, dashboard counter, messages section, contact email, `POST /api/cron/hourly` with Vercel Schedules, Clerk webhook. | §6.14, §6.21, §8 |

Lane A writes `email_outbox` rows through a stub until Lane B is merged.

**Done when:** each of the four roles sees only what §5 allows; a role edited in the dashboard takes effect without a deploy; a disabled member can't sign in; the contact form delivers an email to the admin's inbox that passes SPF and DKIM.

---

## Phase 4 — Consultations + documents

**Goal:** the two core client systems work end to end.

**Keys needed:** none new

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Consultations** | Request form with service preselected, attachments, chat, statuses, assignment, meetings with time zones, `.ics`, 24-hour reminder, closing, deleting with double confirmation. Client and dashboard views. | §6.17, §6.22 |
| **B — Protected documents** | Document upload, `request_document` with merging, recommendations, grant, contact first, expiry, withdraw, watermark pipeline, in-site viewer, access log. Client "وثائقي المتاحة" page. | §6.12, §6.18 |

Lane B needs the chat for "التواصل أولاً". It creates the `document_request` consultation first, and links it to the chat UI once Lane A is merged.

**Done when:** steps 3 to 10 of the core flow (§2) pass; an Arabic client name is correctly shaped in the watermark; a 4.5 MB+ PDF opens on the Vercel preview; a document URL fails when opened by another account; there is no reject button anywhere.

---

## Phase 5 — Audience + training

**Goal:** the blog, resources, media, newsletter and training are live.

**Keys needed:** `RESEND_AUDIENCE_ID`, `RESEND_WEBHOOK_SECRET`, and a Resend webhook to `/api/resend/webhook`

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Publishing** | Blog with search, categories, sharing and related articles. Resource library with direct and email-gated downloads. Media and events. | §6.8–6.10 |
| **B — Newsletter + training** | Double opt-in, Resend audience sync, unsubscribe webhook, subscriber list and export. Courses, registration with seat limit, "قريباً" badge, "اكتملت المقاعد", custom training requests, "دوراتي", training section of the dashboard. | §6.7, §6.15 |

Lane A adds a newsletter checkbox to the email gate after Lane B is merged.

**Done when:** an article in one language shows only in that language; an email-gated resource downloads only after the email is given; a subscriber gets nothing before confirming; unsubscribing updates the dashboard; two people can't take the last seat.

---

## Phase 6 — Analytics + SEO

**Goal:** we can measure the site and search engines can read it.

**Keys needed:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`. The wizard needs a browser sign-in, so the product owner runs it in the developer's sandbox (HQ's Bash tab). The developer then reviews its changes and builds the rest of the lane.

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Analytics** | PostHog wizard, events, funnel, error tracking, session replay on public pages only, cookie banner, dashboard home summary, statistics page. | §6.20, §6.23, §6.25 |
| **B — SEO + performance** | Metadata per page and language, `hreflang`, sitemap, robots, Open Graph, `noindex` rules. Image and bundle work to reach the 3-second target. Accessibility pass. | §6.24, §13 |

**Done when:** PostHog shows the events with no personal data; no replay exists for account or dashboard pages; `hreflang` appears only where a translation exists; the home page loads in under 3 seconds on a throttled mobile network.

---

## Phase 7 — Harden + launch

**Goal:** the core flow works on production, with no open security issues.

**Keys needed:** the Cloudflare R2 bucket and the GitHub Actions secrets in §11. At the end, the product owner creates the Supabase prod project and sets Vercel's production variables. Before this phase starts, §14 decisions 1, 2, 6, 7, 8, 10 and 11 must be settled.

| Lane | Includes | project.md |
| --- | --- | --- |
| **A — Security** | Fix open review findings, security headers, final pass on every rule in §9, the malware scanning decision, team 2FA if chosen. | §9, §14 |
| **B — Backups + launch** | Nightly backup job, one tested restore, responsive and empty-state polish, run the full core flow on `main`. | §2, §6.26 |

**Done when:** the product owner creates the Supabase prod project, applies every migration to it, sets Vercel's production variables and promotes the build; Ahmed's real content and the approved legal text are entered; a first backup is verified; then all ten steps of the core flow (§2) pass on the production URL.
