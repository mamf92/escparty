# ESCParty design system

One design language for every screen in the app, in two themes. This file
is the rulebook: read it before building or restyling a screen, and check
a PR against the checklist at the end. The code lives in `src/design/`.

- **Calm** is the accessible default. Everyone lands on it.
- **Sparkle** is the opt-in skin: sequins, gold foil, stage light and
  glitter, in the spirit of fifty years of Eurovision and Melodi Grand Prix
  stages. Anyone can turn it on with the **Sparkle mode** switch in the app
  bar, and the choice is remembered on that device.

The two themes are one language, not two designs. They share every
structure, state, size, word and rule below; a theme only changes the
*material* things are made of (token values, plus Sparkle's decorative
layer). If a screen looks right in one theme and wrong in the other, the
screen is wrong, not the theme.

## 1. Principles

The language is **modern soft neumorphism** (sometimes called flat
skeuomorphism): a flat, modern UI whose surfaces are moulded out of the
background rather than placed on top of it.

1. **One background, no frames.** A screen is one colour. Every surface is
   made of that same colour and connects with it; nothing has a border, an
   outline, a card around a group, or a darker rim. Space groups things.
2. **Raised or pressed, nothing else.** A surface is lifted out of the
   background by a pair of soft shadows (light from the top left, shade to
   the bottom right) or pressed into it by the same pair turned inwards.
   That is the whole visual vocabulary.
3. **Height is the hierarchy.** Importance is shown by how far a surface
   stands out (proud, rest, sunk), not by bigger type or louder colour.
4. **One accent, used sparingly.** The accent marks what is chosen, links
   and focus. Correct and wrong are a check and a cross; green and red
   appear nowhere else.
5. **Accessible first, then fabulous.** Soft shadows alone are a weak cue,
   so every state also has a non-shadow signal (the accent, a glyph,
   `aria-pressed`) and text always meets 4.5:1. Sparkle adds bling on top
   without taking any of that away.
6. **The party is the point.** Copy is warm, short and in on the joke
   (douze points, nul points, the Jedward Twins), and never at the expense
   of clarity.

## 2. Themes

| | Calm | Sparkle |
| --- | --- | --- |
| Role | Default, accessible, the landing state | Opt-in party skin |
| Background | One flat violet (`#2a2142`) | A plum stage with spotlights and fine glitter |
| Controls | The background colour, raised by soft light and shade | Magenta sequins, raised the same way, with a pink stage glow |
| Chosen / pressed | Pressed into the background, label in the accent | Pressed in, sequins flipped to their dark-gold side, gold label and glow |
| Fields | Wells pressed into the background | Dark wells |
| Page title | Uppercase, tracked, in ink | Gold foil, framed by ✦ stars |
| Motion | The press only | The press, a glint across a hovered control, twinkling stars, foil shimmer — **only** when the system allows motion |
| Frames | None | None: the bling is in the material, never a rim |

What a theme may change: token values (`src/design/tokens.css`, which
holds the faces, shadows and the screen background too) and decoration
that carries no meaning (`<Sparkles />`, glints, foil).

What a theme may never change: layout, spacing, shape, type sizes, copy,
which state a control is in, focus behaviour, or anything a screen reader
hears.

How it works: `data-theme="calm" | "sparkle"` sits on `<html>` (set before
first paint by the script in `index.html`, then kept in sync by
`DesignThemeProvider`). Every token is a CSS variable that switches with
it. The surface (`src/design/surface.css`) and the skin are scoped to
`.esc-app`, the class on the phone frame's screen and on the big screen,
so the standalone `/fabric-ui` WebGL demo keeps its own renderers.

The WebGL sequin membrane in `src/fabric-ui/` is a showcase on
`/fabric-ui` only. Live pages get Sparkle through the CSS described here.

## 3. Tokens

All in `src/design/tokens.css`. Pages read variables; they never write a
hex value, a font name, a shadow or a pixel size of their own.

| Token | Use |
| --- | --- |
| `--esc-font-display` | Montserrat 700/800: page titles, the brand, big numbers |
| `--esc-font-body` | Open Sans 400/600: everything else |
| `--esc-text-control` (16px) / `--esc-text-sub` (13px) | Control labels, and detail text, captions and notes |
| `--esc-text-body` (15px) | Subtitles and links around the surface |
| `--esc-text-heading`, `--esc-text-title`, `--esc-text-display` | A section heading, the page title (1.5rem), a one-off hero number (2rem) |
| `--esc-space-1` … `--esc-space-8` | 4px steps: 4, 8, 12, 16, 20, 24, 32 |
| `--esc-radius-control` / `--esc-radius-field` / `--esc-radius-card` | 16px / 14px / 24px |
| `--esc-target-min` | 52px: a control's and a field's minimum height |
| `--esc-bg` / `--esc-surface` | The background, and the colour every surface is made of (the same in Calm) |
| `--esc-screen` | What the phone screen and big screen paint: the background, plus Sparkle's stage |
| `--esc-backdrop`, `--esc-frame` | Behind the phone, and the phone's body |
| `--esc-raise-sm`, `--esc-raise`, `--esc-raise-lg` | Soft lifts: an information row, a control, the proud row |
| `--esc-inset`, `--esc-inset-sm` | Pressed in: chosen and fields, and the bottom of a ladder |
| `--esc-face`, `--esc-face-hover`, `--esc-face-pressed` | A surface's face at rest, hovered, pressed or chosen |
| `--esc-ink`, `--esc-ink-muted` | Text, and secondary text |
| `--esc-accent`, `--esc-on-accent` | The one accent (chosen), and text set on it |
| `--esc-title`, `--esc-title-fill` | Title colour, and Sparkle's foil fill |
| `--esc-link`, `--esc-focus` | Links, and the focus ring |
| `--esc-correct`, `--esc-wrong` | The check and cross glyphs, nothing else |
| `--esc-press` | The one transition: 120ms ease-out |

`src/styles/theme.ts` (styled-components' theme) is legacy: its fonts point
at the tokens, and its named colours only remain until every screen is
migrated (see the design system epic). Don't use `theme.colors` in new code.

## 4. Page anatomy

```
MobileFrame (or the big screen)    one background, edge to edge
├─ App bar            ESCParty brand · Sparkle mode switch
└─ CalmPage           every screen's chrome
   ├─ Page header     <h1> title (one per page) · optional subtitle
   ├─ Ground          <Ground>  a section of the page (layout only)
   │  └─ Pane         <Pane>    a stack of surfaces (layout only)
   │     ├─ Control   <Control> a raised button
   │     ├─ Row       <Row>     a raised row of information
   │     └─ Field     <Field>   a well pressed into the background
   ├─ Notes           <CalmNote> status, hints, errors, between sections
   └─ Footer          <CalmLink> the way back
```

- Every screen renders through `CalmPage` (`src/components/CalmPage.tsx`).
  No screen builds its own header, background or container.
- Use the primitives from `src/design` (`Ground`, `Pane`, `Control`,
  `Row`, `Field`). They render the surface classes (`calm-ground`,
  `lycra-pane`, `lycra`, `lycra-field`; the names are historical) and
  nothing else.
- **Ground and Pane draw nothing.** They are spacing and grouping only: no
  fill, no border, no shadow. The background shows through, so every
  control sits directly on it.
- Surfaces need room for their shadows: keep at least `--esc-space-3`
  between raised things, and never clip them with `overflow: hidden` on a
  tight box.
- One `<h1>` per screen, in the page header. Sections inside a page use
  `<h2>` labels outside the pane, set as a note.
- Separate unrelated groups with space (another `Ground`), never a divider
  or a box.
- A list of things reads as a list: `<Pane as="ol">` with `<Row as="li">`
  rows (an `<li>`, not a button, and no tab stop).

## 5. Components

**Control** (`<Control>`, `.lycra`). The only button. Label in sentence
case, verb first ("Host a party", "Lock in", "Next act"). States:

| State | Calm | Sparkle | Markup |
| --- | --- | --- | --- |
| Rest | Raised (`--esc-raise`) | Raised sequins, pink glow | — |
| Hover | Face lightens a touch | A glint crosses the face | — |
| Pressed | Pressed in (`--esc-inset`), no movement | Same | `:active` |
| Chosen | Stays pressed in, label in the accent | Stays pressed in, gold sequins, gold label and glow | `chosen` → `.is-chosen` + `aria-pressed` |
| Disabled | Faded, a smaller lift | Same | `disabled` |

Rows with a title and detail use `block`: title in the control size, detail
in `.calm-sub`, laid out left to right with `.calm-row`.

**Row** (`<Row>`, `.lycra.is-block.is-static`). Information on the
surface: a quieter lift than a control (`--esc-raise-sm`), and no pointer,
hover, press, glint or tab stop. Anything you can act on is a `Control`; a
row never takes `onClick`. `as="li"` inside a list pane. Its height
carries rank: `elevation="high"` stands proud (first place, your own row),
`"rest"` is the default, `"low"` sits pressed in (the bottom). A row may be
marked `is-chosen` only to show the viewer's own pick, which it shows the
same way a control does.

**Field** (`<Field>`, `.lycra-field`). A well pressed into the background.
Always has a visible `.calm-label` above it (placeholders are examples,
never labels). Textareas and selects take the same class.

**Pane layouts.** `layout="stack"` (default, one surface per row),
`"split"` (two or three moves side by side, e.g. Previous / Next) and
`"scale"` (a 1..N rating grid of round keys).

**Tabs.** A split pane of controls with `role="tab"`; the current tab is
chosen (pressed in).

**Markers.** A check or cross (`.calm-marker`, 20px, round-capped strokes)
in `--esc-correct` or `--esc-wrong`, at the end of the answer it belongs
to. Only for a settled answer. Always paired with text that says the same
thing for screen readers. Use `<Marker kind="correct" | "wrong" />` from
`src/design` as the control's first child and give the control
`is-marked` (which keeps its label clear of the glyph); the right answer
may stand proud (`is-high`) and a wrong pick sit pressed in (`is-low`).

**Note** (`<CalmNote>`). Status, hints and errors around the surface, in
`--esc-ink-muted`. Errors are notes too: say what happened and what to do
next, without red text.

**Link** (`<CalmLink>`). The quiet underlined move for "back" and
secondary actions, at least 44px tall. One per footer is the norm.

**Big screen** (`calm-screen` on `CalmPage`). The same anatomy for a TV:
only the sizes scale up, together.

## 6. UX patterns

**Navigation.**
- The app bar carries the brand and the Sparkle mode switch, and is not a
  home link: several screens are mid-game and need their own way out.
  Every screen has one explicit way back in its footer, named for where it
  goes ("Back to the quiz library", not "Back").
- Leaving a game in progress (a quiz, a lobby, a party) asks first or says
  what happens ("Leave the waiting room"). Never strand someone mid-game
  with a bare home button.
- Routes stay under `HashRouter` (`#/...`); don't change existing paths.

**Copy.**
- Page titles: two to four words, sentence case in the source (the style
  uppercases them), no emoji, no trailing punctuation.
- Buttons: verb first, specific, sentence case, no emoji.
- Write like the host of a good party: short, warm, Eurovision-literate.
  The joke never replaces the instruction.
- Names of the shows and places are spelled as the contest spells them
  ("Melodi Grand Prix", "Burgas 2027"). Never use the EBU's logo or
  heart-flag device.

**States.** Every screen that loads, can be empty, or can fail designs
all four:
- *Loading:* a note ("Finding the room…") in place of the content; never a
  blank pane or a spinner alone.
- *Empty:* an information row saying what will appear and how to get it
  ("No runs yet — play a quiz and your scores land here").
- *Error:* a note with what happened and a control for the way out
  ("Try again", "Back to the quiz library"). Never a white card, never
  raw error text.
- *Success:* the next step is the most raised control on the screen.

**Forms.** Labels are visible and above the field. Validate on submit,
explain beside the field in a note, keep what was typed. The primary
action is the last control in the pane.

**Multiplayer.** Whoever waits sees who and what they wait for ("2 of 5
are ready"). Timers are shown as text as well as any bar. Host-only
controls live in the host's own tab or pane, never mixed into a guest's.

## 7. Accessibility (both themes)

- **Contrast:** text 4.5:1 against what it sits on (the background, every
  face, and a sequin), large text and non-text (markers, focus ring, edges
  in high contrast) 3:1. `src/design/contrast.test.ts` checks the tokens.
- **Shadows are never the only cue.** Chosen also takes the accent and
  `aria-pressed`; the edge of a control is also its label and its target
  size; with `prefers-contrast: more` every control and field gets a
  visible 1px edge.
- **Targets:** controls and fields at least 52px tall; links and the switch
  at least 44px.
- **Focus:** one ring everywhere, 2px in `--esc-focus` with a 3px offset.
  Never remove it without replacing it.
- **Motion:** nothing moves position, ever: a press is a shadow change.
  `prefers-reduced-motion: reduce` also stops every animation, in both
  themes. Sparkle without motion is still Sparkle: the sequins, foil and
  stars stay, still.
- **Colour is never alone:** correctness is a glyph plus text; chosen is
  pressed in plus the accent plus `aria-pressed` or `aria-selected`.
- **Forced colours:** in Windows High Contrast every control and field gets
  a real border and the glitter is removed.
- **Semantics:** one `<h1>` per screen, real `<button>`s for actions and
  links for navigation, labelled fields, lists as lists, `role="status"`
  (or `aria-live="polite"`) for scores and timers that change on their own.
- **Decoration is silent:** `<Sparkles />`, the title's ✦ stars and glints
  are hidden from assistive tech.

## 8. Do and don't

| Do | Don't |
| --- | --- |
| Build every screen from `CalmPage` + `Ground` / `Pane` / `Control` | Write a `styled.button` or a card of your own |
| Let surfaces sit straight on the background | Put a border, outline, rim or boxed card around anything |
| Read colours, fonts, sizes and shadows from tokens | Write hex values, `theme.colors.*`, shadows or font names in a page |
| Raise the most important control further | Make it bigger, bolder or a different colour |
| Separate groups with space | Add dividers or a darker panel behind a group |
| Say errors in a note with a way out | Show red text, a white card or `alert()` |
| Keep emoji to content (a flag next to a country) | Put emoji in titles or buttons |
| Gate every animation on reduced motion | Move a control when it is pressed |

## 9. Checklist for a PR that touches UI

- [ ] The screen renders through `CalmPage` and the `src/design` primitives.
- [ ] No borders, frames or boxed groups; surfaces connect with the
      background.
- [ ] No hex values, `theme.colors`, shadows or font names added outside
      `src/design/`.
- [ ] Looked at in both Calm and Sparkle (flip the switch), and with
      reduced motion on.
- [ ] Loading, empty and error states exist and follow section 6.
- [ ] Keyboard only: everything reachable, focus visible, order sensible.
- [ ] `npm test` (includes `contrast.test.ts`) and, for a new screen, a
      `judge()` call in `e2e/theme.spec.ts` so its surface is measured.

## Where the rules are enforced

- `src/design/contrast.test.ts` — token contrast in both themes, and that
  Calm's surfaces are the background colour.
- `e2e/theme.spec.ts` — measures live screens: no frames, controls made of
  the background and raised by a light and a dark shadow, chosen pressed
  in, at most four text sizes, nothing moving with reduced motion, and a
  small budget for green and red; then checks the theme switch.
- `.claude/skills/escparty-calm/` and `.claude/skills/escparty-sparkle/`
  describe the earlier lycra surface and the `/fabric-ui` demo, and are
  kept for that demo only; this file wins where they differ.
