# ESCParty design system

One design language for every screen in the app, in two themes. This file
is the rulebook: read it before building or restyling a screen, and check
a PR against the checklist at the end. The code lives in `src/design/`.

- **Calm** is the accessible default. Everyone lands on it.
- **Sparkle** is the opt-in party stage. Anyone can turn it on with the
  **Sparkle mode** switch in the app bar, and the choice is remembered on
  that device.

The two themes are one language, not two designs. They share every
material, structure, state, size, word and rule below; the only thing a
theme changes is **the stage behind the screen**. If a screen looks right
in one theme and wrong in the other, the screen is wrong, not the theme.

The design was chosen on the `/design` canvas
(https://claude.ai/artifact/EDS4mmDKv2e1Mrc9KT3rCE, boards "Calm (chosen)"
and "Sparkle (chosen)"). Its sources, and the two style studies kept for
later adjustments (Pearl neumorphism and Flat pleats), are in
`docs/design/references/`.

## 1. Principles

The language is **Bobby Socks**: white, black and pink sequins on a dark
pink stage, after Norway's 1985 Eurovision winners. Every screen is the
same stage, with a disco ball hanging over it.

1. **One stage, four materials.** The background is always the dark pink
   stage. Everything on it is made of one of four materials (section 2),
   and each material means one thing. Nothing has a border or a rim.
2. **The material says what it is.** A white card is a form; a white
   button is an action; a dark tile is a choice or a piece of
   information; the one black button is the screen's next step. A reader
   learns this once and it holds on every screen.
3. **One accent, used sparingly.** Hot pink (`--esc-accent`) marks what is
   chosen, and nothing else. Correct and wrong are a check and a cross;
   green and red appear nowhere else.
4. **The ball is decoration.** The disco ball and its light spots carry no
   meaning, are hidden from assistive tech and the pointer, and never sit
   behind the page title (the header leaves room for it).
5. **Accessible first, then fabulous.** Every state has a non-colour signal
   (a glyph, `aria-pressed`, the material changing) and text always meets
   4.5:1. Sparkle adds motion only when the system allows it.
6. **The party is the point.** Copy is warm, short and in on the joke
   (douze points, nul points, the Jedward Twins), and never at the expense
   of clarity.

## 2. Materials

| Material | Looks like | Means | Markup |
| --- | --- | --- | --- |
| **Stage** | Dark pink (`--esc-bg`), brightest under the ball | The background of every screen | `MobileFrame`, the big screen |
| **Card** | White, rounded 28px, a deep soft lift; dark ink | A form: anything holding a field | Automatic for a `Pane` with a `Field`; `<Pane className="is-card">` on purpose |
| **Button** | White, lifted; dark ink, bold | An action | `<Control>` |
| **Next step** | Black, in the display font, white ink | The one thing to do next on this screen | `<Control elevation="high">` |
| **Tile** | Solid-reading dark wine (`--esc-tile`, 90% opaque), lighter and pinker than the black next step, white ink | A choice (toggle, radio, tab, option, checkbox), or a row of information | A `Control` with `aria-pressed` or a choice `role`; `<Row>` |
| **Proud row** | A white row among the tiles | First place, your own row, the right answer | `<Row elevation="high">` |
| **Sunk** | A darker, pressed tile | The bottom of a ladder, a wrong pick | `elevation="low"` |
| **Chosen** | Hot pink (`--esc-accent`), white ink, pressed in | What is picked | `chosen` → `.is-chosen` + `aria-pressed` |
| **Unavailable** | Solid, dimmer than a tile (`--esc-disabled`) with muted ink; faded blush on a card | Can't be used yet | `disabled` |

**Inside a card** the same roles are made of **blush** (`--esc-blush`)
with Pearl's soft neumorphic depth: a button is raised by a light and a
shade, a field and a pressed control are pressed in. A card never holds a
dark tile.

**Ink is a scope.** Each material sets `--esc-ink`, `--esc-ink-muted`,
`--esc-correct` and `--esc-wrong` for everything inside it: white on the
stage, a tile, the black button and a chosen pink one; dark
(`--esc-card-ink`) on a card, a white button and a proud row. Notes,
sub lines and markers read `--esc-ink`, so they are right wherever they
land. Never set a text colour on a page.

## 3. Themes and the stage

| | Calm | Sparkle |
| --- | --- | --- |
| Role | Default, accessible, the landing state | Opt-in party stage |
| Stage | The dark pink gradient | Pink sequins (a WebGL shader), dimmed behind the content |
| Disco ball | Hangs still, in muted pinks; soft spots on the stage | White and light pink, turning slowly; brighter spots sweep the stage **left to right** with the ball |
| Light | Fixed, from the top left | The pointer (or a finger) is the lamp |
| Stage text | A solid dark outline (the halo), for the spots of light behind it | The same, with a wider glow for the sequins |
| Materials, sizes, states, copy | Identical | Identical |
| Motion | The press only | The ball turns and the sequins shimmer, **only** when the system allows motion; with reduced motion it is one still frame |

The stage is `<Stage />` (`src/design/Stage.tsx`), rendered once by
`MobileFrame` and the big screen. It paints the ball and spots on a 2D
canvas (the maths is in `src/design/stageLights.ts` and is unit tested),
and in Sparkle the sequins on a WebGL canvas. Without canvas or WebGL it
is the CSS gradient alone (`--esc-screen`). The ball turns at
`SPIN` (negative, so its facets and spots travel left to right, slowly
enough to read as reflections, not snow).

What a theme may change: `--esc-screen`, `--esc-stage-text-shadow` (never dropping the halo), and
what `<Stage />` draws. `contrast.test.ts` fails if Sparkle sets any other
token.

What a theme may never change: a material, layout, spacing, shape, type
sizes, copy, which state a control is in, focus behaviour, or anything a
screen reader hears.

How it works: `data-theme="calm" | "sparkle"` sits on `<html>` (set before
first paint by the script in `index.html`, then kept in sync by
`DesignThemeProvider`). Every token is a CSS variable. The surface
(`src/design/surface.css`) is scoped to `.esc-app`, the class on the phone
frame's screen and on the big screen, so the standalone `/fabric-ui` WebGL
demo keeps its own renderers.

## 4. Tokens

All in `src/design/tokens.css`. Pages read variables; they never write a
hex value, a font name, a shadow or a pixel size of their own.

| Token | Use |
| --- | --- |
| `--esc-font-display` | Righteous: page titles, the brand, the next-step button, big numbers |
| `--esc-font-body` | DM Sans 400/500/700: everything else |
| `--esc-text-control` / `--esc-text-body` (16px) / `--esc-text-sub` (14px) | Control labels and body text, and detail text, captions and notes |
| `--esc-text-heading`, `--esc-text-title`, `--esc-text-display` | A section heading, the page title (2.25rem), a one-off hero number (2.5rem) |
| `--esc-space-1` … `--esc-space-8` | 4px steps: 4, 8, 12, 16, 20, 24, 32 |
| `--esc-radius-control` / `--esc-radius-field` / `--esc-radius-card` | 18px / 16px / 28px |
| `--esc-target-min` | 52px: a control's and a field's minimum height |
| `--esc-bg`, `--esc-screen` | The stage colour, and what the screen paints (a gradient, brightest under the ball) |
| `--esc-ball-size`, `--esc-ball-hang`, `--esc-stage-clearance` | The disco ball's size (24% of the stage's width, 84px to 200px) and how far down it hangs, which `<Stage />` measures, and the room the header leaves for it |
| `--esc-backdrop`, `--esc-frame`, `--esc-bezel`, `--esc-home-bar`, `--esc-frame-glow` | Behind the phone, its body, bezel, home bar and shadow |
| `--esc-ink`, `--esc-ink-muted`, `--esc-title`, `--esc-link`, `--esc-focus` | Ink on the stage (scoped: a card swaps them) |
| `--esc-stage-ink*`, `--esc-stage-correct`, `--esc-stage-wrong` | The same stage ink by name, for dark surfaces inside a light scope |
| `--esc-card*` | The card, its ink, label, focus, markers and lift |
| `--esc-blush*`, `--esc-light`, `--esc-shade`, `--esc-raise-sm`, `--esc-inset`, `--esc-well` | Inside a card: blush controls and wells, and Pearl's soft depth |
| `--esc-button*`, `--esc-on-button` | The white action button |
| `--esc-primary*`, `--esc-on-primary` | The black next-step button |
| `--esc-tile*` | The dark tile: rest, hover, sunk, edge, press, and a proud row's lift |
| `--esc-accent`, `--esc-on-accent`, `--esc-on-accent-muted`, `--esc-accent-press` | Chosen |
| `--esc-disabled`, `--esc-on-disabled` | Unavailable |
| `--esc-correct`, `--esc-wrong` | The check and cross glyphs, nothing else |
| `--esc-switch-on`, `--esc-on-switch`, `--esc-switch-ring` | The Sparkle mode switch |
| `--esc-halo`, `--esc-stage-text-shadow` | The dark halo around text on the stage, which keeps it readable over a spot of light (wider in Sparkle) |
| `--esc-press` | The one transition: 120ms ease-out |

There is no other palette: the styled-components theme (`theme.colors`)
was retired in #179, and `src/test/designGuard.test.ts` fails `npm test` on
a hex or `rgb()`/`hsl()` colour, or `theme.colors`, outside `src/design/`
(comments aside; write issue references as "(#179)"). A colour a screen
needs and no token gives is a new token here, not a literal in the page.

## 5. Page anatomy

```
MobileFrame (or the big screen)    the stage, edge to edge
├─ Stage              <Stage />: the disco ball (and Sparkle's sequins), behind everything
├─ App bar            ESCParty brand (a link home) · Sparkle mode switch
└─ CalmPage           every screen's chrome
   ├─ Page header     <h1> title (one per page) · optional subtitle
   ├─ Ground          <Ground>  a section of the page (layout only)
   │  └─ Pane         <Pane>    a stack (layout only), or a white card when it holds a Field
   │     ├─ Control   <Control> a white button, a dark choice tile, or the black next step
   │     ├─ Row       <Row>     a dark tile of information
   │     └─ Field     <Field>   a blush well, on a card
   ├─ Notes           <CalmNote> status, hints, errors, between sections
   ├─ Actions         `actions` prop: the next-step area, at the bottom of a short page
   └─ Footer          <CalmLink> the way back
```

- Every screen renders through `CalmPage` (`src/components/CalmPage.tsx`).
  No screen builds its own header, background or container.
- **The next step sits at the thumb.** A screen whose last thing is its
  next-step area (Home's Host/Join, a menu of choices) passes it as
  `actions`: on a short page it sticks to the bottom of the screen, on a
  long one it follows the content, and the footer comes right under it.
- Use the primitives from `src/design` (`Ground`, `Pane`, `Control`,
  `Row`, `Field`). They render the surface classes (`calm-ground`,
  `lycra-pane`, `lycra`, `lycra-field`; the names are historical) and
  nothing else.
- **Ground draws nothing, and a Pane draws nothing unless it is a card.**
  They are spacing and grouping only; the stage shows through. A pane
  becomes a white card when it holds a field (a form), or with
  `className="is-card"`. Don't make a card to group buttons or tiles.
- Surfaces need room for their shadows: keep at least `--esc-space-3`
  between them, and never clip them with `overflow: hidden` on a tight box.
- One `<h1>` per screen, in the page header. Sections inside a page use
  `<h2>` labels outside the pane, set as a note.
- Separate unrelated groups with space (another `Ground`), never a divider
  or a box.
- **One next step per screen.** The control that moves the person on
  ("Save quiz", "Start the game") takes `elevation="high"` and
  turns black. Everything else is a white button. A screen with no single
  next step (a menu) has none, or marks its main way in.
- A list of things reads as a list: `<Pane as="ol">` with `<Row as="li">`
  rows (an `<li>`, not a button, and no tab stop).

## 6. Components

**Control** (`<Control>`, `.lycra`). The only button. Label in sentence
case, verb first ("Host a party", "Save quiz", "Next act"). Its material
follows its role:

| State | Action (white button) | Choice (dark tile) | Next step (black) | On a card (blush) |
| --- | --- | --- | --- | --- |
| Rest | White, lifted | Dark tile | Black, lifted, display font | Blush, softly raised |
| Hover | A touch pinker | A touch lighter | A touch lighter | A touch deeper |
| Pressed | Pressed in, no movement | Pressed in | Pressed in | Pressed in |
| Chosen | — | Hot pink, white ink, pressed in, `aria-pressed` | — (never chosen) | Hot pink |
| Disabled | Solid dark, muted ink | Same | Same | Faded blush |

A control is a choice when it has `aria-pressed` or a choice `role`
(`radio`, `tab`, `option`, `checkbox`); the stylesheet reads the ARIA, so
the semantics and the look can't drift apart. Rows with a title and detail
use `block`: title in the control size, detail in `.calm-sub`, laid out
left to right with `.calm-row`.

**Row** (`<Row>`, `.lycra.is-block.is-static`). Information on the stage:
a dark tile with no pointer, hover, press or tab stop. Anything you can
act on is a `Control`; a row never takes `onClick`. `as="li"` inside a
list pane. Its elevation carries rank: `"high"` is the white proud row
(first place, your own row), `"rest"` the default tile, `"low"` a sunk
tile (the bottom). A row may be `is-chosen` only to show the viewer's own
pick, in the accent.

**Field** (`<Field>`, `.lycra-field`). A blush well pressed into a white
card (its pane becomes the card). Always has a visible `.calm-label`, in
`--esc-card-label`, above it (placeholders are examples,
never labels). Textareas and selects are Fields too: `<Field as="textarea">`,
`<Field as="select">`.

**Pane layouts.** `layout="stack"` (default, one surface per row),
`"split"` (two or three moves side by side, e.g. Previous / Next) and
`"scale"` (a 1..N rating grid of round keys).

**Tabs.** A split pane of controls with `role="tab"`; the current tab is
chosen (hot pink). `useRovingTabs` (`src/design/`) gives each tab and its
tab panel their ids, roles, keys and chosen look: one tab stop, arrows, Home
and End move the choice, and the panel is focusable.

**Markers.** A check or cross (`.calm-marker`, 20px, round-capped strokes)
in `--esc-correct` or `--esc-wrong`, at the end of the answer it belongs
to, in the colours of the surface it sits on (lighter on a tile, darker
on white, white on pink). Only for a settled answer. Always paired with text that says the same
thing for screen readers. Use `<Marker kind="correct" | "wrong" />` from
`src/design` as the control's first child and give the control
`is-marked` (which keeps its label clear of the glyph); the right answer
may stand proud (`is-high`, white) and a wrong pick sit sunk (`is-low`).

**Note** (`<CalmNote>`). Status, hints and errors around the surface, in
`--esc-ink-muted` (pale pink on the stage, plum on a card). Errors are notes too: say what happened and what to do
next, without red text.

**Link** (`<CalmLink>`). The quiet underlined move for "back" and
secondary actions, at least 44px tall. One per footer is the norm.

**Page title.** One `<h1>` in Righteous, white on the stage, sentence
case, below the ball (the header's `--esc-stage-clearance` keeps it
clear).

**Hero** (`calm-hero` on `CalmPage`, Home only). The landing screen
floats a bigger ball (46% of the stage's width, 148px to 280px) with no
wire (`--esc-ball-wire: none`, which `<Stage />` reads), and the header's
clearance grows with it. Two ways in under the title, nothing more.

**Big screen** (`calm-screen` on `CalmPage`). The same anatomy for a TV:
only the sizes and the ball's clearance scale up, together.

## 7. UX patterns

**Navigation.**
- The app bar carries the brand and the Sparkle mode switch. The brand is
  a link home. A screen with something in progress (a running quiz, a room
  this tab is in, a quiz being built) registers a leave guard with
  `useLeaveGuard`, and then the brand first asks "Go back to ESCParty?" with
  "Stay here" and "Go to ESCParty" (`ConfirmLeave`, as in `LeaveQuiz`) and
  runs the screen's own leave (a guest's lobby leave takes them out of the
  room). With no guard it goes straight home.
  Moves from the quiz to a break or the results, and from a break back
  into the quiz, replace the history entry, so Back can't re-enter a
  finished question.
  Every screen has one explicit way back in its footer, named for where it
  goes ("Back to the quiz library", not "Back"). The one exception is Home
  (`/`), the root: there is nowhere further back to go.
- Leaving a game in progress (a quiz, a lobby, a party) asks first or says
  what happens ("Leave the waiting room"). Never strand someone mid-game
  with a bare home button.
- Routes stay under `HashRouter` (`#/...`); don't change existing paths.

**Copy.**
- Page titles: two to four words, sentence case, no emoji, no trailing
  punctuation.
- Buttons: verb first, specific, sentence case, no emoji.
- Write like the host of a good party: short, warm, Eurovision-literate.
  The joke never replaces the instruction.
- Names of the shows and places are spelled as the contest spells them
  ("Melodi Grand Prix", "Burgas 2027"). Never use the EBU's logo or
  heart-flag device.

**States.** Every screen that loads, can be empty, or can fail designs
all four:
- *Loading:* a note ("Finding the room…") in place of the content; never a
  blank pane or a spinner alone. When the screen waits on the network before
  it moves on (a code being checked, a room being set up), use `<Loader>`
  (`src/design`): a small disco ball and one line over the whole screen,
  `role="status"`, blocking taps on the page beneath. The ball turns only in
  Sparkle and only when the system allows motion.
- *Empty:* an information row saying what will appear and how to get it
  ("No runs yet — play a quiz and your scores land here").
- *Error:* a note with what happened and a control for the way out
  ("Try again", "Back to the quiz library"). Never raw error text.
- *Success:* the next step is the black button.

**Forms.** Labels are visible and above the field. Validate on submit,
explain beside the field in a note, keep what was typed. The form is a
white card; its next step is the black button, last in the pane.

**Multiplayer.** Whoever waits sees who and what they wait for ("2 of 5
are ready"). Timers are shown as text as well as any bar. Host-only
controls live in the host's own tab or pane, never mixed into a guest's.

## 8. Accessibility (both themes)

- **Contrast:** text 4.5:1 against what it sits on (the stage's gradient,
  a tile over a white spot of light, a card, a white or blush
  button, the black button and a chosen pink one); markers and the focus
  ring 3:1. Text straight on the stage can have a spot of light behind it,
  so it always carries a solid dark outline (the halo), and the ink holds
  4.5:1 against it.
  `src/design/contrast.test.ts` checks the tokens. Disabled controls are
  solid, so the stage never shows through behind their label.
- **Colour is never alone:** chosen is pink plus pressed in plus
  `aria-pressed` or `aria-selected`; correctness is a glyph plus text; the
  next step is black plus its own font.
- **Targets:** controls and fields at least 52px tall; links and the switch
  at least 44px.
- **Focus:** one ring everywhere, 2px in `--esc-focus` (pale pink on the
  stage, deep pink on a card) with a 3px offset. Never remove it without
  replacing it.
- **Motion:** nothing moves position, ever: a press is a shadow change.
  `prefers-reduced-motion: reduce` stops the ball, the sequins and every
  transition, and the stage follows the setting live. Sparkle without motion is still Sparkle: one still frame.
- **More contrast:** with `prefers-contrast: more` every control and field
  gets an edge in its own ink (dark on white, white on a tile) and notes
  turn full ink.
- **Forced colours:** in Windows High Contrast every control and field gets
  a real border and the stage is removed.
- **Semantics:** one `<h1>` per screen, real `<button>`s for actions and
  links for navigation, labelled fields, lists as lists, `role="status"`
  (or `aria-live="polite"`) for scores and timers that change on their own.
- **Decoration is silent:** `<Stage />` is `aria-hidden` and ignores the
  pointer.

## 9. Do and don't

| Do | Don't |
| --- | --- |
| Build every screen from `CalmPage` + `Ground` / `Pane` / `Control` / `Row` / `Field` | Write a `styled.button` or a card of your own |
| Pick the material by meaning: card = form, white = action, tile = choice or info, black = next step | Use white to make something look important, or a card to group buttons |
| Give a screen one black next step | Make two buttons black, or a choice black |
| Mark choices with `aria-pressed` or a choice `role` | Style a button as a tile with a class |
| Read colours, fonts, sizes and shadows from tokens | Write hex values, `theme.colors.*`, shadows or font names in a page |
| Let the stage show through Ground and Pane | Put a border, outline, rim or boxed panel around anything |
| Say errors in a note with a way out | Show red text or `alert()` |
| Keep emoji to content (a flag next to a country) | Put emoji in titles or buttons |
| Keep decoration on `<Stage />` | Add a page-level background, photo or animation |

## 10. Checklist for a PR that touches UI

- [ ] The screen renders through `CalmPage` and the `src/design` primitives.
- [ ] Each surface is the right material for its meaning, and the screen
      has at most one black next step.
- [ ] No borders, frames or boxed groups.
- [ ] No hex values, `theme.colors`, shadows or font names added outside
      `src/design/`.
- [ ] Looked at in both Calm and Sparkle (flip the switch), and with
      reduced motion on; the title clears the disco ball.
- [ ] Loading, empty and error states exist and follow section 7.
- [ ] Keyboard only: everything reachable, focus visible, order sensible.
- [ ] `npm test` (includes `contrast.test.ts`) and, for a new screen, a
      `judge()` call in `e2e/theme.spec.ts` so its surface is measured.

## Where the rules are enforced

- `src/design/contrast.test.ts` — token contrast on every material, and
  that Sparkle changes only the stage.
- `src/design/stageLights.test.ts` — the ball's facets and spots, and that
  they sweep left to right, slowly.
- `src/test/designGuard.test.ts` — no colour literals outside
  `src/design/`.
- `e2e/theme.spec.ts` — measures live screens: no frames, a card only
  where there is a form and always white, an action white (blush on a
  card) and lifted, a choice a dark tile, chosen hot pink, at most four
  text sizes, nothing moving with reduced motion, and a small budget for
  green and red; then checks the theme switch and the stage.
- `docs/design/references/` — the chosen boards and the two style studies,
  for future adjustments. They are references, not rules: this file wins.
- `.claude/skills/escparty-calm/` and `.claude/skills/escparty-sparkle/`
  describe the earlier lycra surface and the `/fabric-ui` demo, and are
  kept for that demo only.
