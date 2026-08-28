# ESCParty Calm

**Reference: `reference/calm-quiz-marked.png` — attach it.**

**A dark violet sheet with controls pushed up through it, lit from one fixed corner, where nothing carries colour but a right answer and a wrong one.**

**The one break in the system:** pressing a control tugs its two neighbours 2px *toward* the dent (`.lycra:active + .lycra`, `.lycra:has(+ .lycra:active)`). The only rule where one control changes another's appearance, and what makes this read as one sheet, not a row of buttons. Wrapping controls in row divs kills it silently.

## Moves
1. Outer shadows run 10-12x the alpha of their lit counterparts.
2. Exactly 3 outer shadows, blur 5/24/64px. Two reads as plastic.
3. Flat crown: corner radials only, alpha <=0.085.
4. 80ms in, 420ms out; release overshoots past rest.
5. Elevation is the hierarchy; type ratio 1.25:1 carries none.

## Never
- Tint a control. Shape says raised/pressed, colour says right/wrong.
- Gradient across a face; it domes.
- Flip the light. Top-left everywhere, always.
- Saturated colour over 0.1%.
- Wrap a control in a row element.
- Glow or scale.
- More than 2 type sizes per frame.
- A flat background under this.
- White added to balance the shading.
- Motion coupled to viewport or device.

## Palette, type, layouts
#120a28 ground + plum pools ~59%. Faces 5% white over ground ~40%. Type #EEE8F0 ~0.9%. #28a745 / #dc3545 ~0.02% each, gutter glyphs only. Open Sans 15px/600 over 12px/400.
Layouts: `prompt-and-options`, `labelled-choice-list`, `ranked-ladder`.

## Self-check
- [ ] Green+red under 0.1%
- [ ] <=2 type sizes, 1.2-1.4:1
- [ ] Nothing tinted
- [ ] 3 shadows 5/24/64px, darkest >=8x lightest
- [ ] Release 5x press
- [ ] Controls direct children of the pane
- [ ] Reduced motion: transforms none
- [ ] Neighbour tug fires both sides

Before returning any output, run every test in the self-check. Name each test and its result. If any fails, repair the output and run them again. Never return output with a failing test and a note explaining it away.
