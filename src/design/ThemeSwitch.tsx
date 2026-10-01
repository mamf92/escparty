import { useDesignTheme } from "./useDesignTheme";

/**
 * The one control that switches between Calm and Sparkle. A switch, so a
 * screen reader hears "Sparkle mode, switch, off/on"; the label doesn't
 * change with the state, only the switch does.
 */
export const ThemeSwitch = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useDesignTheme();
  const on = theme === "sparkle";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={className ? `esc-theme-switch ${className}` : "esc-theme-switch"}
      onClick={() => setTheme(on ? "calm" : "sparkle")}
    >
      <span className="esc-theme-switch-track" aria-hidden="true">
        <span className="esc-theme-switch-thumb">✦</span>
      </span>
      Sparkle mode
    </button>
  );
};

export default ThemeSwitch;
