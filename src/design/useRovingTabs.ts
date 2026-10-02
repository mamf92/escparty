import { useId, useRef, type KeyboardEvent } from "react";

/*
 * The WAI-ARIA tabs pattern for a row of `Control`s (docs/design/design-system.md,
 * section 5): one tab stop for the whole tablist (the chosen tab), the arrow
 * keys, Home and End move the choice and the focus together, and every tab
 * labels and controls one tab panel.
 *
 *   const tabs = useRovingTabs(KEYS, chosen, setChosen);
 *   <Pane layout="split" role="tablist" aria-label="…">
 *     {KEYS.map(key => <Control key={key} chosen={key === chosen} {...tabs.tab(key)}>…</Control>)}
 *   </Pane>
 *   <Ground {...tabs.panel}>…</Ground>
 *
 * The panel is a tab stop of its own, so keyboard users can reach a panel
 * that holds only information (rows, not controls).
 */
export function useRovingTabs<K extends string>(
  keys: readonly K[],
  selected: K,
  onSelect: (key: K) => void,
) {
  const baseId = useId();
  const refs = useRef(new Map<K, HTMLButtonElement>());
  const tabId = (key: K) => `${baseId}-tab-${key}`;
  const panelId = `${baseId}-panel`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Leave Alt/Ctrl/Meta + arrow to the browser (Back, word jumps).
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const last = keys.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onSelect(keys[next]);
    refs.current.get(keys[next])?.focus();
  };

  const tab = (key: K) => {
    const index = keys.indexOf(key);
    const isSelected = key === selected;
    return {
      ref: (el: HTMLButtonElement | null) => {
        if (el) refs.current.set(key, el);
        else refs.current.delete(key);
      },
      id: tabId(key),
      role: "tab" as const,
      "aria-selected": isSelected,
      "aria-controls": panelId,
      tabIndex: isSelected ? 0 : -1,
      onClick: () => onSelect(key),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => onKeyDown(event, index),
    };
  };

  const panel = {
    id: panelId,
    role: "tabpanel" as const,
    "aria-labelledby": tabId(selected),
    tabIndex: 0,
  };

  return { tab, panel };
}
