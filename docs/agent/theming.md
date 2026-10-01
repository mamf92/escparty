# Theming

Read this when a task touches which design language a screen should use, or
how Calm and Sparkle relate to each other. **The rulebook for building any
screen is `docs/design/design-system.md`** (tokens, page anatomy,
components, UX patterns, accessibility, PR checklist); the code is in
`src/design/`. This file is the bridge between that and the code.

## How the theme is switched on live pages

One design language (modern soft neumorphism: one background, frameless
surfaces raised out of it or pressed into it), two themes.
`data-theme="calm" | "sparkle"` sits on `<html>`: `index.html` sets it from
`localStorage["escparty-theme"]` before first paint and
`DesignThemeProvider` (in `App.tsx`) keeps it in sync with the **Sparkle
mode** switch in the app bar (`MobileFrame`) and on the big screen.

- `src/design/tokens.css` sets every token per theme: colours, fonts,
  sizes, the surface faces and the raise/inset shadows. Most of Sparkle is
  just different token values.
- `src/design/surface.css` draws every surface class (`calm-ground`,
  `lycra-pane`, `lycra`, `lycra-field`, …) from those tokens.
- `src/design/sparkle.css` adds Sparkle's decoration: the glint, the stars,
  the marker glow.

All of it is scoped to `.esc-app`, so `/fabric-ui` is untouched, and is
imported once, from `main.tsx`, via `src/design/design-system.css`. Never
import a surface stylesheet from a page.

## The two themes

- **Calm** — the default and accessible landing experience. One flat
  violet background; controls are the same colour, raised by soft light
  and shade, with no motion beyond the press.
- **Sparkle** — opt-in, never the landing state. The same shapes in
  magenta sequins that flip to gold when chosen, on a glitter stage, with
  gold-foil titles. Its animations (twinkle, glint, foil) only run when the
  system allows motion.

## The /fabric-ui demo

`src/fabric-ui/` is a standalone proof of concept on `/fabric-ui` with two
renderers (a CSS one, `CalmSurface.tsx`, and a WebGL sequin membrane) that
read the same `OverlayItem[]` content model. It keeps the earlier lycra
surface (`lycra-surface.css`, `calm.css`, imported by `CalmSurface.tsx`)
and the skills that describe it (`.claude/skills/escparty-calm/`,
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
join, rate, my ranking, the room, host tools, awards, big screen) with
reduced motion on and measures it with `judge()`: no frames, controls made
of the background and raised by a light and a dark shadow, chosen pressed
in, at most four text sizes, nothing moving, and a small budget for green
and red. The measurements are attached to the Playwright report. Add a
`judge()` call when you build a new screen. Sparkle's contrast is checked
from its tokens (`src/design/contrast.test.ts`), and `e2e/theme.spec.ts`
checks the switch: it turns Sparkle on, survives a reload, and stops
animating with reduced motion.
