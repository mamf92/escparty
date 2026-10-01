/**
 * A settled answer's check or cross (docs/design/design-system.md,
 * "Markers"): a 20px round-capped glyph in `--esc-correct` or
 * `--esc-wrong`, placed at the end of the control it belongs to. Give that
 * control `is-marked` so its label keeps clear of the glyph.
 *
 * The glyph is silent; the screen says the same thing in words (a status
 * note), since colour and shape are never the only signal.
 */
export const Marker = ({ kind }: { kind: "correct" | "wrong" }) => (
  <span className={`calm-marker is-${kind}`} data-marker={kind} aria-hidden="true">
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "correct" ? (
        <path d="M5 12.5 L10 17.5 L19 7" />
      ) : (
        <>
          <path d="M6.5 6.5 L17.5 17.5" />
          <path d="M17.5 6.5 L6.5 17.5" />
        </>
      )}
    </svg>
  </span>
);
