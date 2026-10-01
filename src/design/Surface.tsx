import type { ComponentPropsWithRef, ReactNode } from "react";

/*
 * The surface anatomy every screen is built from (docs/design/design-system.md):
 *
 *   <Ground>            the dark, never-flat ground (.calm-ground)
 *     <Pane>            one sheet; controls are direct children (.lycra-pane)
 *       <Control />     a raised control (.lycra)
 *       <Field />       a sunken field (.lycra-field)
 *
 * These render the classes and nothing else: no wrapper elements, so
 * controls stay direct siblings and the neighbour tug keeps working.
 */

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

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
  /** Chosen holds the sink: the answer or option someone picked. */
  chosen?: boolean;
  /** A row with a title and detail under it, left aligned. */
  block?: boolean;
  /** Information on the surface, not a control: no pointer, no hover. */
  info?: boolean;
  /** The bottom of the elevation ladder: flush with the sheet. */
  low?: boolean;
};

export const Control = ({ chosen, block, info, low, className, type = "button", ...props }: ControlProps) => (
  <button
    type={type}
    className={cx("lycra", block && "is-block", info && "is-static", low && "is-low", chosen && "is-chosen", className)}
    aria-pressed={chosen === undefined ? undefined : chosen}
    {...props}
  />
);

export const Field = ({ className, ...props }: ComponentPropsWithRef<"input">) => (
  <input className={cx("lycra-field", className)} {...props} />
);
