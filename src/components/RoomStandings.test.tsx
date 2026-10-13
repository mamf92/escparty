import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RoomStandings } from "./RoomStandings";
import { makeBallot, makeParty } from "../test/partyFixtures";

describe("RoomStandings", () => {
    it("says nothing is rated yet, as an information row", () => {
        render(<RoomStandings party={makeParty()} ballots={[]} />);
        expect(screen.getByText(/^No ratings yet/)).toHaveClass("is-static");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("ranks the acts by the room's average, with no guest's name", () => {
        render(<RoomStandings party={makeParty()} ballots={[makeBallot("a", "Loreen", [4, 12, 8, 1]), makeBallot("b", "Lordi", [6, 10, 8, 2])]} />);
        const rows = within(screen.getByRole("list", { name: "The room's standings" })).getAllByRole("listitem");
        expect(rows.map(row => row.textContent)).toEqual([
            "1st 🇳🇴 Norway9.2",
            "2nd 🇫🇮 Finland6.7",
            "3rd 🇸🇪 Sweden4.2",
            "4th 🇮🇪 Ireland1.3",
        ]);
        expect(screen.queryByText(/Loreen|Lordi/)).not.toBeInTheDocument();
    });

    it("keeps the top of the table, and shows the real place and who went through", () => {
        const party = makeParty({ results: { places: { no: 2 }, qualifiers: ["se"] } });
        render(<RoomStandings party={party} ballots={[makeBallot("a", "Loreen", [4, 12, 8, 1])]} limit={2} />);
        const rows = within(screen.getByRole("list", { name: "The room's standings" })).getAllByRole("listitem");
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent("Really 2nd");
        expect(rows[1]).not.toHaveTextContent("Really");
    });
});
