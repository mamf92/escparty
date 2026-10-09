/**
 * Which way the Sparkle stage is lit (docs/design/design-system.md, "Themes
 * and the stage"). An opt-in exploration: `front` is the look the app has
 * always had and the default; `back` and `both` add a lamp behind the ball
 * whose spots land in the sequins. Chosen with `?lights=front|back|both` in
 * the address (links look like `https://host/?lights=back#/`, since the app
 * uses a HashRouter) and remembered per browser. There is no control for it.
 */

export type StageLighting = "front" | "back" | "both";

export const STAGE_LIGHTING: readonly StageLighting[] = ["front", "back", "both"];

/** Where the choice is remembered, per browser. */
export const LIGHTING_STORAGE_KEY = "escparty-lights";

export const isStageLighting = (value: unknown): value is StageLighting =>
  typeof value === "string" && (STAGE_LIGHTING as readonly string[]).includes(value);

const stored = (): StageLighting | null => {
  try {
    const value = window.localStorage.getItem(LIGHTING_STORAGE_KEY);
    return isStageLighting(value) ? value : null;
  } catch {
    return null;
  }
};

const remember = (mode: StageLighting) => {
  try {
    window.localStorage.setItem(LIGHTING_STORAGE_KEY, mode);
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
};

/**
 * The lighting for this visit: `?lights=` if it names a mode (and it is
 * remembered); an invalid `?lights=` falls back to `front`; otherwise the
 * remembered mode, otherwise `front`.
 */
export const readStageLighting = (): StageLighting => {
  const asked = ((): string | null => {
    try {
      return new URLSearchParams(window.location.search).get("lights");
    } catch {
      return null;
    }
  })();
  if (asked !== null) {
    if (!isStageLighting(asked)) return "front";
    remember(asked);
    return asked;
  }
  return stored() ?? "front";
};
