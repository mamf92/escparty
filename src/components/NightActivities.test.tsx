import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NightActivities } from "./NightActivities";

describe("NightActivities", () => {
    it("says nothing is on yet, as an information row", () => {
        render(<NightActivities activities={[]} />);
        expect(screen.getByRole("heading", { level: 2, name: "Now on" })).toBeInTheDocument();
        expect(screen.getByText("Nothing on yet. The host will start a quiz or a scoreboard soon.")).toHaveClass("is-static");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("lists each activity's kind and title, in order", () => {
        render(<NightActivities activities={[
            { kind: "quiz", code: "ABBA", title: "Eurovision trivia" },
            { kind: "scoreboard", code: "LENA", title: "Semi-final 1" },
        ]} />);
        const items = within(screen.getByRole("list", { name: "Now on" })).getAllByRole("listitem");
        expect(items.map(item => item.textContent)).toEqual(["QuizEurovision trivia", "ScoreboardSemi-final 1"]);
        expect(screen.queryByText(/Nothing on yet/)).not.toBeInTheDocument();
    });
});
