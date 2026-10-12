import type { ComponentPropsWithRef, ReactNode } from "react";
import { Control } from "./Surface";
import { cx } from "./cx";

type ChoiceCardProps = {
  title: ReactNode;
  /** A short tag over the title (e.g. "Easy"). */
  tag?: ReactNode;
  /** A line of detail under the title (e.g. "10 Qs · ca. 3 min"). */
  meta?: ReactNode;
  /** One sentence on what the choice is. */
  sub?: ReactNode;
  chosen?: boolean;
} & Omit<ComponentPropsWithRef<"button">, "title" | "children">;

/**
 * A choice as a tile: an optional tag, a bold title, an optional meta line and a one-sentence
 * description. A `Control` underneath, so it is a dark tile that turns pink
 * when chosen. Give it `role="radio"` and `aria-checked` inside a radio group.
 */
export const ChoiceCard = ({ title, tag, meta, sub, chosen, className, ...props }: ChoiceCardProps) => (
  <Control block chosen={chosen} className={cx("esc-choice-card", className)} {...props}>
    {tag && <span className="esc-choice-tag">{tag}</span>}
    <span className="esc-choice-title">{title}</span>
    {meta && <span className="calm-sub">{meta}</span>}
    {sub && <span className="calm-sub">{sub}</span>}
  </Control>
);

type ChoiceGridProps = {
  /** Cards per row; 2 by default. */
  columns?: 1 | 2;
} & ComponentPropsWithRef<"div">;

/** Lays choice cards out in equal columns, each row's cards the same height. */
export const ChoiceGrid = ({ columns = 2, className, ...props }: ChoiceGridProps) => (
  <div className={cx("lycra-pane", "esc-choice-grid", columns === 1 && "is-single", className)} {...props} />
);
