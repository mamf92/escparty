import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";

type BadgeProps = {
  /** A small caption above the value ("Game code", "Points"). */
  label?: string;
  /** The big thing: a code, a score. Shown in the display font. */
  value?: string | number;
  /** Replaces the value's markup when it is more than text. */
  children?: ReactNode;
  /** Spell the value out letter by letter for a screen reader (a code, not a number). */
  spell?: boolean;
  /** Lets the value be selected and copied (`esc-selectable`). */
  selectable?: boolean;
  className?: string;
} & Omit<ComponentPropsWithRef<"div">, "className" | "children">;

/**
 * Information worth seeing from across the room: a dark tile (like a Row) with
 * its value large in the display font and an optional small caption above
 * it (docs/design/design-system.md, "Components"). It is not a control: no
 * pointer, no hover, no tab stop. The caption and value are hidden from a
 * screen reader in favour of one line that reads them together ("Game code
 * A B B A").
 */
export const Badge = ({ label, value, children, spell = false, selectable = false, className, ...props }: BadgeProps) => {
  const text = value === undefined ? "" : String(value);
  const spoken = [label, spell ? text.split("").join(" ") : text].filter(Boolean).join(" ");
  return (
    <div className={cx("esc-badge", className)} {...props}>
      {label && <span className="esc-badge-label" aria-hidden="true">{label}</span>}
      <span className={cx("esc-badge-value", selectable && "esc-selectable")} aria-hidden="true">{children ?? text}</span>
      <span className="esc-badge-spoken">{spoken}</span>
    </div>
  );
};
