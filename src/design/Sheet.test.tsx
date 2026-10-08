import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetRow } from "./Sheet";

describe("Sheet", () => {
    it("is a table with the label as the row header", () => {
        render(
            <Sheet aria-label="Ratings">
                <tbody>
                    <SheetRow label="Vocals"><span>picker</span></SheetRow>
                </tbody>
            </Sheet>,
        );
        expect(screen.getByRole("table", { name: "Ratings" })).toBeInTheDocument();
        expect(screen.getByRole("rowheader", { name: "Vocals" })).toBeInTheDocument();
        expect(screen.getByText("Vocals")).toHaveClass("is-static");
        expect(screen.getByText("picker")).toBeInTheDocument();
    });
});
