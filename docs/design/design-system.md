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

1. **One surface, one anatomy.** Every screen is a page header over one or
   more panes of controls on a ground. No screen invents its own cards,
   buttons or colours.
2. **Elevation is the hierarchy.** Importance is shown by height (proud,
   rest, flush), not by bigger type or louder colour.
3. **State is shape; colour is a verdict.** A control says raised or
   pressed. Correct and wrong are a check and a cross in the gutter; green
   and red appear nowhere else.
4. **Accessible first, then fabulous.** Calm meets WCAG 2.2 AA on its own.
   Sparkle adds bling on top without taking any of that away: the same
   contrast floor, targets, focus ring and reduced-motion behaviour.
5. **The party is the point.** Copy is warm, short and in on the joke
   (douze points, nul points, the Jedward Twins), and never at the expense
   of clarity.

## 2. Themes

| | Calm | Sparkle |
| --- | --- | --- |
| Role | Default, accessible, the landing state | Opt-in party skin |
| Ground | Dark violet, softly pooled | Stage-lit plum with a fine glitter field |
| Controls | Violet fabric pushed up as stacked shadows | Magenta sequins with a gold-foil hem |
| Chosen / pressed | Sunk into the sheet | Sunk, sequins flipped to their dark-gold side, gold ring |
| Pane | Translucent sheet, 1px light edge | Same sheet with a gold, silver and pink foil rim |
| Page title | Lavender, uppercase, tracked | Gold foil, framed by ✦ stars |
| Motion | The press only | The press, a glint across a hovered control, twinkling stars, foil shimmer — **only** when the system allows motion |
| Markers | `#28a745` check, `#ff6b78` cross | Brighter green and red, with a glow |

What a theme may change: token values (`src/design/tokens.css`), the
surface shadows and faces (`--lyc-*`, re-skinned in `src/design/sparkle.css`),
and decoration that carries no meaning (`<Sparkles />`, glints, foil).

What a theme may never change: layout, spacing, type sizes, copy, which
state a control is in, focus behaviour, or anything a screen reader hears.

How it works: `data-theme="calm" | "sparkle"` sits on `<html>` (set before
first paint by the script in `index.html`, then kept in sync by
`DesignThemeProvider`). Every token is a CSS variable that switches with
it. Skins are scoped to `.esc-app`, the class on the phone frame's screen
and on the big screen, so the standalone `/fabric-ui` WebGL demo keeps its
own renderers.

The WebGL sequin membrane in `src/fabric-ui/` (`.claude/skills/escparty-sparkle/`)
is Sparkle's showcase renderer, still only on `/fabric-ui`. Live pages get
Sparkle through the CSS skin described here.

## 3. Tokens

All in `src/design/tokens.css`. Pages read variables; they never write a
hex value, a font name or a pixel size of their own.

| Token | Use |
| --- | --- |
| `--esc-font-display` | Montserrat 700/800: page titles, the brand, big numbers |
| `--esc-font-body` | Open Sans 400/600: everything else |
| `--esc-text-control` (15px) / `--esc-text-sub` (12px) | The only two sizes allowed **inside** a ground (1.25:1) |
| `--esc-text-title`, `--esc-text-display` | Page title (1.5rem), and a one-off hero number (2rem) |
| `--esc-text-note`, `--esc-text-link` | Notes and links around the surface |
| `--esc-space-1` … `--esc-space-8` | 4px steps: 4, 8, 12, 16, 20, 24, 32 |
| `--esc-radius-control` / `--esc-radius-pane` | 12px / 22px |
| `--esc-target-min` | 48px: a control's minimum height |
| `--esc-backdrop` | Behind the phone frame |
| `--esc-screen` | The phone screen and big screen background |
| `--esc-ground` | The ground behind a pane |
| `--esc-ink`, `--esc-ink-muted` | Text, and secondary text |
| `--esc-title`, `--esc-title-fill` | Title colour, and Sparkle's foil fill |
| `--esc-link`, `--esc-focus` | Links, and the focus ring |
| `--esc-correct`, `--esc-wrong` | The check and cross glyphs, nothing else |

`src/styles/theme.ts` (styled-components' theme) is legacy: its fonts point
at the tokens, and its named colours only remain until every screen is
migrated (see the design system epic). Don't use `theme.colors` in new code.

## 4. Page anatomy

```
MobileFrame (or the big screen)
├─ App bar            ESCParty brand · Sparkle mode switch
└─ CalmPage           every screen's chrome
   ├─ Page header     <h1> title (one per page) · optional subtitle
   ├─ Ground          <Ground>  the dark, never-flat ground
   │  └─ Pane         <Pane>    one sheet of controls
   │     ├─ Control   <Control> a raised button, a direct child
   │     └─ Field     <Field>   a sunken input
   ├─ Notes           <CalmNote> status, hints, errors, between grounds
   └─ Footer          <CalmLink> the way back
```

- Every screen renders through `CalmPage` (`src/components/CalmPage.tsx`).
  No screen builds its own header, background or container.
- Use the primitives from `src/design` (`Ground`, `Pane`, `Control`,
  `Field`). They render the surface classes (`calm-ground`, `lycra-pane`,
  `lycra`, `lycra-field`; the names are historical) and nothing else.
- **Controls are direct children of their pane.** No row wrapper `div`s:
  the neighbour tug, and the Calm check, depend on it.
- One `<h1>` per screen, in the page header. Sections inside a page use
  `<h2>` labels outside the ground, set as a note.
- Group related controls in one pane; separate unrelated groups into
  separate grounds rather than adding dividers.
- A list of things reads as a list: `<Pane as="ol">` with
  `<Control as="li" info>` rows (an `<li>`, not a button, and no tab stop).

## 5. Components

**Control** (`<Control>`, `.lycra`). The only button. Label in sentence
case, verb first ("Host a party", "Lock in", "Next act"). States:

| State | Calm | Sparkle | Markup |
| --- | --- | --- | --- |
| Rest | Raised | Raised, gold hem | — |
| Hover | Face lightens slightly | Glint crosses the face | — |
| Pressed | Sinks (80ms in, 420ms overshoot out) | Same | `:active` |
| Chosen | Holds the sink | Holds the sink, dark-gold sequins, gold ring | `chosen` → `.is-chosen` + `aria-pressed` |
| Proud (ranked first) | Raised further | Stronger gold glow | `.is-high` (ladders only) |
| Flush (bottom of a ladder) | Flush with the sheet | Same | `low` → `.is-low` |
| Information row | Raised, no pointer, no glint | Same | `info` → `.is-static`, usually `as="li"` or `as="div"` |
| Disabled | Faded into a groove | Same | `disabled` |

Rows with a title and detail use `block`: title in the control size, detail
in `.calm-sub`, laid out left to right with `.calm-row`.

**Field** (`<Field>`, `.lycra-field`). Sunken. Always has a visible
`.calm-label` above it (placeholders are examples, never labels).
Textareas and selects take the same class.

**Pane layouts.** `layout="stack"` (default, one control per row),
`"split"` (two or three moves side by side, e.g. Previous / Next) and
`"scale"` (a 1..N rating grid of small plates).

**Tabs.** A split pane of controls with `role="tab"`; the current tab is
chosen (sunk).

**Markers.** A check or cross in the pane's left gutter (`.calm-marker`),
20px, round-capped strokes. Calm's cross is `#ff6b78`, lifted from the
Calm skill's measured `#dc3545`, which only holds 2.4:1 over the ground's
brightest pool. Only for a settled answer. Always paired with
text that says the same thing for screen readers.

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

- **Contrast:** text 4.5:1 against what it sits on (including a sequin),
  large text and non-text (markers, focus ring, field edges in high
  contrast) 3:1. `src/design/contrast.test.ts` checks the tokens.
- **Targets:** controls at least 48px tall; links and the switch at least
  44px.
- **Focus:** one ring everywhere, 2px in `--esc-focus` with a 3px offset.
  Never remove it without replacing it.
- **Motion:** `prefers-reduced-motion: reduce` stops every animation and
  transform except the press's shadow change, in both themes. Sparkle
  without motion is still Sparkle: the sequins, foil and stars stay, still.
- **Colour is never alone:** correctness is a glyph plus text; chosen is a
  sink plus `aria-pressed` or `aria-selected`.
- **Forced colours and more contrast:** in Windows High Contrast every
  control, field and pane gets a real border and the glitter is removed;
  with `prefers-contrast: more` controls and fields get a visible edge.
- **Semantics:** one `<h1>` per screen, real `<button>`s for actions and
  links for navigation, labelled fields, lists as lists, `role="status"`
  (or `aria-live="polite"`) for scores and timers that change on their own.
- **Decoration is silent:** `<Sparkles />`, the title's ✦ stars and glints
  are hidden from assistive tech.

## 8. Do and don't

| Do | Don't |
| --- | --- |
| Build every screen from `CalmPage` + `Ground` / `Pane` / `Control` | Write a `styled.button` or a card of your own |
| Read colours, fonts and sizes from tokens | Write hex values, `theme.colors.*`, or font names in a page |
| Raise the most important control | Make it bigger, bolder or a different colour |
| Put controls straight into the pane | Wrap each control in a row `div` |
| Say errors in a note with a way out | Show red text, a white card or `alert()` |
| Keep emoji to content (a flag next to a country) | Put emoji in titles or buttons |
| Gate every animation on reduced motion | Animate anything that carries meaning only in motion |

## 9. Checklist for a PR that touches UI

- [ ] The screen renders through `CalmPage` and the `src/design` primitives.
- [ ] No hex values, `theme.colors`, or font names added outside `src/design/`.
- [ ] Looked at in both Calm and Sparkle (flip the switch), and with
      reduced motion on.
- [ ] Loading, empty and error states exist and follow section 6.
- [ ] Keyboard only: everything reachable, focus visible, order sensible.
- [ ] `npm test` (includes `contrast.test.ts`) and, for a new screen, an
      entry in `e2e/theme.spec.ts` so the Calm self-check measures it.

## Where the rules are enforced

- `src/design/contrast.test.ts` — token contrast in both themes.
- `e2e/theme.spec.ts` — measures live screens with the Calm skill's
  `tools/check.py` (two type sizes, three shadow layers, no tint, direct
  siblings, accent budget, reduced motion) and checks the theme switch.
- `.claude/skills/escparty-calm/` and `.claude/skills/escparty-sparkle/` —
  the measured DNA behind the surface, for anyone changing the surface
  itself rather than building on it.
