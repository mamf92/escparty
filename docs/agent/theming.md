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

Both themes render from the same `OverlayItem[]` content model produced by
the screen builders. That means they can differ in *how* they present a
given piece of UI state (raised/pressed/selected/correct/wrong) but never in
*what* state is being shown. If you're adding a new interactive state, it
needs to be expressible in that shared model, not bolted onto one theme
only — otherwise the two themes stop being twins.

## Where the implementation lives

Sparkle's renderer is `src/fabric-ui/` (see `docs/agent/architecture.md`).
Calm is CSS-driven and vendored per the notes in each skill's `SKILL.md`.
Don't duplicate the skills' `dna.json`/`PROMPT.md` content here or in
`CLAUDE.md` — if you need the measured values or build workflow, load the
skill.

## Picking a theme for new work

Default to Calm unless the task explicitly asks for Sparkle, party mode, or
similar — see each skill's description for the exact trigger wording.
