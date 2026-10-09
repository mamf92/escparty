# Theming

Read this when a task touches which design language a screen should use, or
how Calm and Sparkle relate to each other. **The rulebook for building any
screen is `docs/design/design-system.md`** (tokens, page anatomy,
components, UX patterns, accessibility, PR checklist); the code is in
`src/design/`. This file is the bridge between that and the code.

## How the theme is switched on live pages

One design language ("Bobby Socks": white cards, white buttons, dark
tiles and one black next step on a dark pink stage under a disco ball),
two themes.
`data-theme="calm" | "sparkle"` sits on `<html>`: `index.html` sets it from
`localStorage["escparty-theme"]` before first paint and
`DesignThemeProvider` (in `App.tsx`) keeps it in sync with the **Sparkle
mode** switch in the app bar (`MobileFrame`) and on the big screen.

- `src/design/tokens.css` sets every token: colours, fonts, sizes,
  materials and shadows. Sparkle overrides only `--esc-screen` and
  `--esc-stage-text-shadow` (`contrast.test.ts` holds it to that).
- `src/design/surface.css` draws every surface class (`calm-ground`,
  `lycra-pane`, `lycra`, `lycra-field`, …) from those tokens, picking the
  material from the markup: a pane with a field is a card, a control with
  `aria-pressed` or a choice role is a tile, `is-high` is the black next
  step.
- `src/design/Stage.tsx` (with `stage.css`, and the maths in
  `stageLights.ts`) draws the stage behind the screen: the disco ball and
  its spots on a 2D canvas, still in Calm and turning in Sparkle, plus
  Sparkle's WebGL sequins. `MobileFrame` and the big screen render it
  once. With reduced motion it is one still frame.

All of it is scoped to `.esc-app`, so `/fabric-ui` is untouched, and is
imported once, from `main.tsx`, via `src/design/design-system.css`. Never
import a surface stylesheet from a page.

Those tokens are the app's only palette: the styled-components theme and
its named colours are gone (#179), and `src/test/designGuard.test.ts`
fails `npm test` on a hex or `rgb()`/`hsl()` colour, or `theme.colors`,
outside `src/design/`.

## The two themes

- **Calm** — the default and accessible landing experience. The dark
  pink stage with a still disco ball in muted pinks; no motion beyond the
  press.
- **Sparkle** — opt-in, never the landing state. The same screens on a
  floor of pink sequins, with a white and light pink ball turning slowly
  clockwise and its light spots sweeping right to left; the pointer is the lamp.
  It only moves when the system allows motion.

The boards both were chosen from, and two style studies kept for later
adjustments, are in `docs/design/references/`.

## The /fabric-ui demo

`src/fabric-ui/` is a standalone proof of concept on `/fabric-ui` with two
renderers (a CSS one, `CalmSurface.tsx`, and a WebGL sequin membrane) that
read the same `OverlayItem[]` content model. It keeps the earlier lycra
surface (`lycra-surface.css`, `calm.css`, imported by `CalmSurface.tsx`),
its own palette (`palette.ts`, the colours the app used before the design
system), and the skills that describe it (`.claude/skills/escparty-calm/`,
`.claude/skills/escparty-sparkle/`). Those rules apply to the demo only;
live pages follow `docs/design/design-system.md`, and the app's
`.esc-app`-scoped surface outranks the demo's stylesheets after a visit to
the demo.

## Picking a theme for new work

There's no picking per screen: every screen is built once, on the design
system, and must look right in both themes. Calm is what everyone lands
on; Sparkle is the user's switch.

## Checking a live page

`e2e/theme.spec.ts` renders each scoreboard party screen (home, setup,
join, rate, my ranking, the room, host tools, awards, big screen) and
each screen migrated since (the app's Home screen, the scoreboard break and
the host's view, the single-player entry, the solo scoreboard, the
multiplayer create and join screen) with reduced motion on and measures it
with `judge()`: no frames, a card only
around a form and always white, an action white (blush on a card) and
lifted, a choice a dark tile, chosen hot pink, at most four text sizes, nothing moving, and a small budget for green
and red. The measurements are attached to the Playwright report. Add a
`judge()` call when you build a new screen. Sparkle's contrast is checked
from its tokens (`src/design/contrast.test.ts`), and `e2e/theme.spec.ts`
checks the switch: it turns Sparkle on (the sequin canvas appears),
survives a reload, and stops animating with reduced motion.
