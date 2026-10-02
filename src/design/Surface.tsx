import type { ComponentPropsWithRef, ReactNode } from "react";

/*
 * The surface anatomy every screen is built from (docs/design/design-system.md):
 *
 *   <Ground>            the dark, never-flat ground (.calm-ground)
 *     <Pane>            one sheet; controls are direct children (.lycra-pane)
 *       <Control />     a raised control, always a <button> (.lycra)
 *       <Row />         a raised row of information, not a control (.lycra.is-static)
 *       <Field />       a sunken field: input, select or textarea (.lycra-field)
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
  /** Chosen stays pressed in: the answer or option someone picked. */
  chosen?: boolean;
  /** A row with a title and detail under it, left aligned. */
  block?: boolean;
};

/*
 * Chosen is announced as `aria-pressed` on a plain toggle button. A control
 * given a role (`radio`, `tab`, `option`) states its own choice instead
 * (`aria-checked`, `aria-selected`), where `aria-pressed` isn't allowed.
 */
export const Control = ({ chosen, block, className, type = "button", ...props }: ControlProps) => (
  <button
    type={type}
    className={cx("lycra", block && "is-block", chosen && "is-chosen", className)}
    aria-pressed={chosen === undefined || props.role ? undefined : chosen}
    {...props}
  />
);

type RowProps = {
  /** `li` inside a list pane (`<Pane as="ol">`), `div` anywhere else. */
  as?: "li" | "div";
  /**
   * Its step on the elevation ladder: `high` stands proud (first place,
   * your own row), `low` sits pressed in (the bottom of a ladder).
   */
  elevation?: "high" | "rest" | "low";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"li">, "className" | "children">;

/**
 * Information on the surface: raised like a control, but no pointer, no
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
