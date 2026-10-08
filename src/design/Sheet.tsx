import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";
import { Row } from "./Surface";

/*
 * A two-column sheet: a label on the left, the thing you set on the right
 * (a rating sheet: category | value picker). A real <table>, so a screen
 * reader hears "Vocals, row 1 of 5". The label is a dark tile, set in white,
 * so it reads on the Calm and the Sparkle stage alike.
 */

export const Sheet = ({ className, ...props }: ComponentPropsWithRef<"table">) => (
    <table className={cx("calm-sheet", className)} {...props} />
);

export const SheetRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <tr>
        <th scope="row"><Row>{label}</Row></th>
        <td>{children}</td>
    </tr>
);
