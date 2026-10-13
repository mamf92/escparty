import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NightScreenActivity } from "./NightScreenActivity";
import { makeBallot, makeParty } from "../test/partyFixtures";
import type { PartyData } from "../hooks/usePartyData";
import type { Room } from "../utils/roomsFirestore";

const mocks = vi.hoisted(() => ({ room: undefined as unknown, party: {} as unknown }));
vi.mock("../hooks/useRoom", () => ({ useRoom: () => mocks.room }));
vi.mock("../hooks/usePartyData", () => ({ usePartyData: () => mocks.party }));

const room = (change: Partial<Room> = {}) => ({
    id: "ABBA",
    hostId: "h",
    started: false,
    phase: "lobby",
    players: [{ id: "h", name: "Loreen", score: 0 }, { id: "g", name: "Lordi", score: 0 }],
    ...change,
}) as unknown as Room;
const quiz = [{ kind: "quiz" as const, code: "ABBA", title: "Quiz 2" }];
const board = [{ kind: "scoreboard" as const, code: "LENA", title: "Semi-final 1" }];

describe("NightScreenActivity", () => {
    beforeEach(() => {
        mocks.room = room();
        mocks.party = { party: makeParty({ code: "LENA" }), ballots: [makeBallot("a", "Loreen", [4, 12, 8, 1])], error: null, retry: vi.fn() } satisfies PartyData;
    });

    it("says nothing is on yet, as an information row", () => {
        render(<NightScreenActivity activities={[]} />);
        expect(screen.getByRole("heading", { level: 2, name: "Now on" })).toBeInTheDocument();
        expect(screen.getByText("Nothing on yet. The host will start a quiz or a scoreboard soon.")).toHaveClass("is-static");
    });

    it("shows only the newest activity", () => {
        render(<NightScreenActivity activities={[...board, ...quiz]} />);
        expect(screen.getByText("Quiz 2")).toBeInTheDocument();
        expect(screen.queryByText("Semi-final 1")).not.toBeInTheDocument();
    });

    describe("a quiz", () => {
        it("in its lobby, names who is waiting", () => {
            render(<NightScreenActivity activities={quiz} />);
            expect(screen.getByRole("heading", { level: 3, name: "Waiting for players" })).toBeInTheDocument();
            const names = within(screen.getByRole("list", { name: "Waiting for players" })).getAllByRole("listitem");
            expect(names.map(item => item.textContent)).toEqual(["Loreen", "Lordi"]);
        });

        it("leaves an observer host off the list, and says when nobody is there", () => {
            mocks.room = room({ hostIsObserver: true, players: [{ id: "h", name: "Loreen", score: 0 }] } as Partial<Room>);
            render(<NightScreenActivity activities={quiz} />);
            expect(screen.getByText("Nobody has joined yet.")).toBeInTheDocument();
            expect(screen.queryByText("Loreen")).not.toBeInTheDocument();
        });

        it("being played, shows the standings", () => {
            mocks.room = room({ phase: "question", started: true, players: [{ id: "h", name: "Loreen", score: 300 }, { id: "g", name: "Lordi", score: 900 }] });
            render(<NightScreenActivity activities={quiz} />);
            expect(screen.getByRole("heading", { level: 3, name: "Standings" })).toBeInTheDocument();
            const rows = within(screen.getByRole("list", { name: "Quiz standings" })).getAllByRole("listitem");
            expect(rows.map(row => row.textContent)).toEqual(["1. Lordi900 points", "2. Loreen300 points"]);
        });

        it("finished, shows the final standings", () => {
            mocks.room = room({ phase: "results", started: true });
            render(<NightScreenActivity activities={quiz} />);
            expect(screen.getByRole("heading", { level: 3, name: "Final standings" })).toBeInTheDocument();
        });

        it("says when it is loading or gone", () => {
            mocks.room = undefined;
            const { unmount } = render(<NightScreenActivity activities={quiz} />);
            expect(screen.getByRole("status")).toHaveTextContent("Finding the quiz…");
            unmount();
            mocks.room = null;
            render(<NightScreenActivity activities={quiz} />);
            expect(screen.getByRole("status")).toHaveTextContent("This quiz isn't available any more.");
        });
    });

    describe("a scoreboard", () => {
        it("shows the room's standings, the way the party's own screen does", () => {
            render(<NightScreenActivity activities={board} />);
            expect(screen.getByRole("heading", { level: 3, name: "The room's standings" })).toBeInTheDocument();
            const rows = within(screen.getByRole("list", { name: "The room's standings" })).getAllByRole("listitem");
            expect(rows[0]).toHaveTextContent("1st 🇳🇴 Norway");
            expect(screen.queryByText("Loreen")).not.toBeInTheDocument();
        });

        it("says the ratings are being counted rather than claiming nobody rated", () => {
            mocks.party = { party: makeParty(), ballots: undefined, error: null, retry: vi.fn() };
            render(<NightScreenActivity activities={board} />);
            expect(screen.getByRole("status")).toHaveTextContent("Counting the ratings…");
            expect(screen.queryByText(/^No ratings yet/)).not.toBeInTheDocument();
        });

        it("says when it is loading, unreachable or gone", () => {
            mocks.party = { party: undefined, ballots: undefined, error: null, retry: vi.fn() };
            const first = render(<NightScreenActivity activities={board} />);
            expect(screen.getByRole("status")).toHaveTextContent("Finding the party…");
            first.unmount();
            mocks.party = { party: undefined, ballots: undefined, error: "The party couldn't be reached.", retry: vi.fn() };
            const second = render(<NightScreenActivity activities={board} />);
            expect(screen.getByRole("status")).toHaveTextContent("The party couldn't be reached.");
            second.unmount();
            mocks.party = { party: null, ballots: undefined, error: null, retry: vi.fn() };
            render(<NightScreenActivity activities={board} />);
            expect(screen.getByRole("status")).toHaveTextContent("This party isn't available any more.");
        });

        it("says the ratings couldn't be followed", () => {
            mocks.party = { party: makeParty(), ballots: undefined, error: "The party couldn't be reached.", retry: vi.fn() };
            render(<NightScreenActivity activities={board} />);
            expect(screen.getByRole("status")).toHaveTextContent("The party couldn't be reached.");
        });
    });
});
