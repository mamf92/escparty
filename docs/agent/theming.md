# Theming

Read this when a task touches which design language a screen should use, or
how Calm and Sparkle relate to each other. For the actual visual rules,
measurements, and how-to-build guidance, go to the skills — this file is
just the bridge between them.

## The two themes

- **Calm** (`.claude/skills/escparty-calm/SKILL.md`) — the default and
  accessible landing experience. A dark violet CSS surface with controls
  pushed up as stacked box shadows, running entirely on the CPU, with no
  motion beyond the press itself.
- **Sparkle** (`.claude/skills/escparty-sparkle/SKILL.md`) — an opt-in
  glittering WebGL sequin membrane with device/pointer parallax. Never the
  landing state, and a system-level reduced-motion preference overrides the
  toggle even when a user has opted in.

## Why they can't drift apart in meaning

Inside the `src/fabric-ui/` proof-of-concept, both renderers read from the
same `OverlayItem[]` content model produced by the screen builders — they
can differ in *how* they present a given UI state (raised/pressed/selected/
correct/wrong) but never in *what* state is being shown. That guarantee is
scoped to `fabric-ui`'s own renderer abstraction, not something every live
page automatically plugs into (see the `fabric-ui` note in
`docs/agent/architecture.md`).

Outside `fabric-ui`, a live page that wants the Calm look (e.g.
`Scoreboard.tsx`) applies it directly by importing `calm.css` and adding a
page-scoped override stylesheet — there's no `OverlayItem` involved on that
path. If you're adding a new interactive state, decide which path you're
on: inside the demo's shared model, or a direct CSS adoption on a real page.

## Where the implementation lives

Sparkle's renderer and the `OverlayItem` model live in `src/fabric-ui/` (see
`docs/agent/architecture.md`) and, as of this writing, are not confirmed
wired into any live page — only the standalone `/fabric-ui` demo route uses
them. Calm's CSS (`calm.css`, vendored per the notes in
`.claude/skills/escparty-calm/SKILL.md`) is also authored in `fabric-ui/`
but *is* imported directly by at least one live page (`Scoreboard.tsx`).
Don't duplicate the skills' `dna.json`/`PROMPT.md` content here or in
`CLAUDE.md` — if you need the measured values or build workflow, load the
skill.

## Picking a theme for new work

Default to Calm unless the task explicitly asks for Sparkle, party mode, or
similar — see each skill's description for the exact trigger wording.
