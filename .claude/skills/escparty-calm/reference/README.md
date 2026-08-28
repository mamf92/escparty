# Reference — ESCParty Calm

Captured 2026-08-28 from the live app at commit `f82f676`, route `/#/fabric-ui`, screen `quiz`, calm mode (the default landing state).

| File | What it shows |
| --- | --- |
| `calm-quiz-idle.png` | Four options at rest, before any answer. The elevation ladder at its quietest. |
| `calm-quiz-marked.png` | **The canonical reference.** An answer submitted: the correct option raised with a green check in the gutter, the chosen wrong option sunk with a red cross, the untaken options dimmed. Attach this one. |

Capture conditions: headless Chromium, 900x1400 viewport, `deviceScaleFactor` 2. The card is `min(92vw, 35rem)`, so it renders at its 560px maximum here.

`calm-quiz-marked.png` is the reference because it is the only frame showing all three elevation steps and both marker colours at once — everything the style refuses is visible by its absence in the same image.

## Source of truth

The reference images are evidence. The style itself lives in:

- `src/fabric-ui/lycra-surface.css` — vendored byte for byte from the file the project owner supplied, including its own comments, so it stays diffable against its source. **Never edit it.**
- `src/fabric-ui/calm.css` — the demo-side companion. Every deviation from the vendored stylesheet lives here.
- `src/fabric-ui/CalmSurface.tsx` — the renderer.
- `src/styles/theme.ts` — the token set the colours derive from.

If any of those change, re-capture and re-run the reconstruct-and-diff step rather than editing `dna.json` by hand.
