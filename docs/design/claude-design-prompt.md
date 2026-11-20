# Prompt for Claude Design

How to use it:

1. Open claude.ai → Design → new project.
2. Attach these files from the repo: `docs/design/SOUL.md`, `docs/project.md` (Claude Design reads §1, §6.1–6.6, §13), and any photos you have in `docs/design/images/`.
3. If Claude Design offers to scan the repo for a design system, **say no**. The current one is the look we're replacing.
4. Paste everything inside the box below as your first message.
5. When Ahmed has picked a direction, ask Claude Design for the handoff (the last section of the prompt), and put what it gives you in `docs/design/`.

---

```text
You are designing the personal professional website of Ahmed, a consultant in
management, governance, humanitarian work and development. His clients are
ministries, international and local humanitarian organizations, companies, and
individual trainees. The site is bilingual: Arabic first (RTL), then English.

THE SOUL — read SOUL.md, attached. In one line:
"Sitting across the table from someone who has seen a great deal, and is calm
because of it." Visitors should leave feeling they met Ahmed, not that they
browsed a consultant's website. The feeling is calm, earned trust. The thing
they remember is his voice: he speaks to them in the first person.

THIS IS A FULL REFRESH. Colors, fonts and layout are all open. Do NOT return to
either of these, they are what we're escaping:
- cream/ivory background + serif headings + gold or clay accent
- navy + gold "executive consultant"
Also banned: centered hero with title + subtitle + two buttons; photo in a gold
frame; the same card grid on every section; icons in circles; a short accent bar
above headings; gradient blobs, glass, glow; fade-and-slide on every block;
all-caps eyebrow labels; one word of a headline in another color; logo walls high
on the page; stock handshakes.

UNIVERSAL, NOT LOCAL: no country motifs, flags or landmarks. Heritage shows only
through Arabic typography and the dignity of people in photos.

WHAT TO MAKE FIRST: three distinct directions, each one honest to the soul.
Starting points (push each further, or replace one if you find better):
  A. "The letter" — typographic and editorial. His words lead. Near-monochrome,
     one ink-like accent. The home page opens with a short letter from him.
  B. "The room" — photography-led. Quiet spaces, natural light, people at work.
     The visitor feels invited to sit down.
  C. "The record" — evidence-led calm. A precise grid, dates, places, documents.
     The serenity of a well-kept institutional record.

For EACH direction, design in Arabic first, then English:
  1. Home page, desktop 1440 px and mobile 375 px, light and dark theme.
  2. One project page, told as a short story: situation, what he did, what changed.
Home page content, in this default order (each section can be hidden or
reordered by the team, so each must stand on its own):
  hero (photo, name, title, one-line value statement, primary action
  "تعرّف على خبرتي", secondary "اطلب استشارة") · quick stats (years, projects,
  organizations, trainees) · expertise (3 areas) · who I work with (government,
  humanitarian, private) · featured services · selected projects (3, each with
  one key result) · approved organization logos · testimonials from thank-you
  letters · latest media appearance · latest articles and resources · newsletter
  · quick contact.
Site-wide: an always-visible "اطلب استشارة" action, language switch, theme switch.

Use realistic long Arabic text, not lorem ipsum. Write copy in his first-person
voice: measured, short sentences, no superlatives, no hype. Mark all copy as draft.
Use placeholder photos where needed; mark them as placeholders.

HARD CONSTRAINTS (the code must be able to honor these):
- WCAG AA contrast in both themes. Keyboard and screen-reader friendly.
- RTL is native, not mirrored English: Arabic headings get their own size and
  line height. Directional icons mirror.
- Fonts must cover Arabic and Latin (one family with both, or a deliberate pair),
  be licensed for the web, and load in Next.js (next/font). Few weights.
- Motion: slow and rare, at most one orchestrated moment per page; everything
  works with reduced motion.
- Mobile first, works at 375 px. Home page under 3 seconds on a weak mobile
  network: no heavy video, no big motion libraries.
- Empty, loading and error states exist for every list.

Explain, for each direction, in three sentences: what the visitor feels, what
makes it unmistakably Ahmed's, and the biggest risk.

WHEN A DIRECTION IS CHOSEN (I'll tell you), then:
- Extend it to: about, services list + one service, expertise, contact, the
  projects list, the blog list + one article, FAQ, a 404, and the sign-in screen.
- Write DESIGN.md in Google's DESIGN.md format: YAML front matter with colors
  (light and dark), typography (Arabic and English scales), rounded, spacing,
  components; then prose on why each choice serves the soul, how each component
  is used, a motion section, and a "Banned patterns" section that repeats the
  bans above plus any your direction adds.
- Package the handoff for Claude Code: tokens, component specs, assets, and a
  screenshot of every screen in Arabic and English, light and dark.
```
