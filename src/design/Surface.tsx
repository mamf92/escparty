import type { ComponentPropsWithRef, ReactNode } from "react";

/*
 * The surface anatomy every screen is built from (docs/design/design-system.md,
 * "Materials" and "Components"):
 *
 *   <Ground>            a section of the page, layout only (.calm-ground)
 *     <Pane>            a stack, or a white card when it holds a Field (.lycra-pane)
 *       <Control />     a button, always a <button> (.lycra): white for an
 *                       action, a dark tile for a choice, black for the next step
 *       <Row />         a dark tile of information, not a control (.lycra.is-static)
 *       <Field />       a blush well on a card: input, select or textarea (.lycra-field)
 *
 * These render the classes and nothing else: no wrapper elements, so
 * controls stay direct siblings and the neighbour tug keeps working.
 */

import { cx } from "./cx";

export const Ground = ({ className, ...props }: ComponentPropsWithRef<"div">) => (
  <div className={cx("calm-ground", className)} {...props} />
);

type PaneProps = {
  /** A list reads as a list: render the pane as an <ol> or <ul>. */
  as?: "div" | "ol" | "ul";
  /** `scale` lays a rating scale out as a grid; `split` puts moves side by side. */
  layout?: "stack" | "scale" | "split";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"div">, "className" | "children">;

export const Pane = ({ as: Tag = "div", layout = "stack", className, ...props }: PaneProps) => {
  const classes = cx("lycra-pane", layout === "scale" && "calm-scale", layout === "split" && "calm-split", className);
  return <Tag className={classes} {...(props as object)} />;
};

type ControlProps = ComponentPropsWithRef<"button"> & {
  /** Chosen turns hot pink: the answer or option someone picked. */
  chosen?: boolean;
  /** A row with a title and detail under it, left aligned. */
  block?: boolean;
  /**
   * `high` is the black button: the screen's one next step
   * (design-system.md, "Page anatomy"). It still answers hover and press,
   * and `chosen` wins over it: a chosen control stays pink.
   */
  elevation?: "high" | "rest";
};

/*
 * Chosen is announced as `aria-pressed` on a plain toggle button. A control
 * given a role (`radio`, `tab`, `option`) states its own choice instead
 * (`aria-checked`, `aria-selected`), where `aria-pressed` isn't allowed.
 */
export const Control = ({ chosen, block, elevation = "rest", className, type = "button", ...props }: ControlProps) => (
  <button
    type={type}
    className={cx("lycra", block && "is-block", chosen && "is-chosen", !chosen && elevation === "high" && "is-high", className)}
    aria-pressed={chosen === undefined || props.role ? undefined : chosen}
    {...props}
  />
);

type RowProps = {
  /** `li` inside a list pane (`<Pane as="ol">`), `div` anywhere else. */
  as?: "li" | "div";
  /**
   * Its rank: `high` is the white proud row (first place, your own row),
   * `low` a sunk tile (the bottom of a ladder).
   */
  elevation?: "high" | "rest" | "low";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"li">, "className" | "children">;

/**
 * Information on the stage: a dark tile like a choice, but no pointer, no
 * hover, no press and no tab stop. Anything you can act on is a Control.
 */
export const Row = ({ as: Tag = "div", elevation = "rest", className, ...props }: RowProps) => (
  <Tag
    className={cx("lycra", "is-block", "is-static", elevation === "high" && "is-high", elevation === "low" && "is-low", className)}
    {...(props as object)}
  />
);

type FieldProps =
  | ({ as?: "input" } & ComponentPropsWithRef<"input">)
  | ({ as: "select" } & ComponentPropsWithRef<"select">)
  | ({ as: "textarea" } & ComponentPropsWithRef<"textarea">);

/** A sunken field: an <input> by default, or `as="select"` / `as="textarea"`. */
export const Field = ({ as: Tag = "input", className, ...props }: FieldProps) => (
  <Tag className={cx("lycra-field", className)} {...(props as object)} />
);
