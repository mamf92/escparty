import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../test/test-utils";
import { NightActivities } from "./NightActivities";
import { makeParty } from "../test/partyFixtures";
import type { Party } from "../utils/partyFirestore";
import { JoinRejected, type Room } from "../utils/roomsFirestore";
import { readPartyIdentity, savePartyIdentity } from "../utils/partySession";

const mocks = vi.hoisted(() => ({ rooms: {} as Record<string, unknown>, parties: {} as Record<string, unknown>, joinRoom: vi.fn() }));
vi.mock("../hooks/useRoom", () => ({ useRoom: (code: string) => mocks.rooms[code] }));
vi.mock("../hooks/useParty", () => ({ useParty: (code: string) => mocks.parties[code] }));
vi.mock("../utils/roomsFirestore", () => ({
    MAX_PLAYERS: 32,
    JoinRejected: class JoinRejected extends Error {
        constructor(public readonly reason: string, message: string) {
            super(message);
        }
    },
    joinRoom: mocks.joinRoom,
}));

const Where = () => {
    const location = useLocation();
    return <p>at {location.pathname} {JSON.stringify(location.state)}</p>;
};
const me = { guestId: "g-me", name: "Lordi" };
const renderCards = (activities: Parameters<typeof NightActivities>[0]["activities"], identity = me) =>
    renderWithProviders(
        <Routes>
            <Route path="/" element={<NightActivities activities={activities} me={identity} />} />
            <Route path="*" element={<Where />} />
        </Routes>,
    );

const self = { id: "g-me", name: "Lordi", score: 0 };
const room = (change: Partial<Room> = {}) => ({
    id: "ABBA", hostId: "host-1", started: false, phase: "lobby", difficulty: "nul-points", players: [{ id: "host-1", name: "Loreen", score: 0 }], ...change,
}) as unknown as Room;
const quiz = [{ kind: "quiz" as const, code: "ABBA", title: "Quiz" }];
const board = [{ kind: "scoreboard" as const, code: "LENA", title: "Semi-final 1" }];
const party = (): Party => makeParty({ code: "LENA", hostId: "host-1" });

describe("NightActivities", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.rooms = { ABBA: room() };
        mocks.parties = { LENA: party() };
        mocks.joinRoom.mockResolvedValue(true);
    });

    it("says nothing is on yet, as an information row", () => {
        renderCards([]);
        expect(screen.getByRole("heading", { level: 2, name: "Now on" })).toBeInTheDocument();
        expect(screen.getByText("Nothing on yet. The host will start a quiz or a scoreboard soon.")).toHaveClass("is-static");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("lists a card for each activity, the newest first, with a dark tile and a white button", () => {
        // A quiz titled "Quiz" doesn't say "Quiz" twice.
        renderCards([...quiz, ...board]);
        const items = within(screen.getByRole("list", { name: "Now on" })).getAllByRole("listitem");
        expect(items.map(item => item.textContent)).toEqual([
            "ScoreboardSemi-final 14 acts to rateRate",
            "QuizWaiting for playersJoin the quiz",
        ]);
        const button = screen.getByRole("button", { name: "Rate" });
        expect(button).not.toHaveClass("is-high");
        expect(screen.getByText("Semi-final 1").closest(".lycra")).toHaveClass("is-static");
    });

    describe("a scoreboard", () => {
        it("rates as the night's guest: the party remembers who this is, and opens", async () => {
            renderCards(board);
            await userEvent.setup().click(screen.getByRole("button", { name: "Rate" }));
            expect(readPartyIdentity("LENA")).toEqual({ guestId: "g-me", name: "Lordi", isHost: false });
            expect(screen.getByText(/^at \/party\/LENA/)).toBeInTheDocument();
        });

        it("tells the host's own identity by the party's host", async () => {
            renderCards(board, { guestId: "host-1", name: "Loreen" });
            await userEvent.setup().click(screen.getByRole("button", { name: "Rate" }));
            expect(readPartyIdentity("LENA")).toEqual({ guestId: "host-1", name: "Loreen", isHost: true });
        });

        it("keeps the place in the lineup of a guest who was rating already", async () => {
            savePartyIdentity("LENA", { guestId: "g-me", name: "Lordi", isHost: false, actId: "fi" });
            renderCards(board);
            await userEvent.setup().click(screen.getByRole("button", { name: "Rate" }));
            expect(readPartyIdentity("LENA")?.actId).toBe("fi");
        });

        it("says when it is loading or gone, without a button", () => {
            mocks.parties = { LENA: undefined };
            const first = renderCards(board);
            expect(screen.getByText("Looking for the party…")).toBeInTheDocument();
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
            first.unmount();
            mocks.parties = { LENA: null };
            renderCards(board);
            expect(screen.getByText("Not available any more")).toBeInTheDocument();
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });
    });

    describe("a quiz in its lobby", () => {
        it("joins with the night's id and name, and goes to the waiting room", async () => {
            renderCards(quiz);
            await userEvent.setup().click(screen.getByRole("button", { name: "Join the quiz" }));
            expect(mocks.joinRoom).toHaveBeenCalledWith("ABBA", "g-me", "Lordi");
            expect(localStorage.getItem("playerId")).toBe("g-me");
            expect(localStorage.getItem("playerName")).toBe("Lordi");
            expect(localStorage.getItem("gameCode")).toBe("ABBA");
            expect(localStorage.getItem("isHost")).toBe("false");
            expect(screen.getByText(/^at \/lobby/)).toBeInTheDocument();
        });

        it("offers a player the way back to the waiting room instead, the host included", async () => {
            mocks.rooms = { ABBA: room({ players: [{ id: "host-1", name: "Loreen", score: 0 }, self] }) };
            const user = userEvent.setup();
            renderCards(quiz);
            await user.click(screen.getByRole("button", { name: "Back to the waiting room" }));
            expect(mocks.joinRoom).not.toHaveBeenCalled();
            expect(screen.getByText(/^at \/lobby/)).toBeInTheDocument();
        });

        it("marks the host's own device as the host", async () => {
            mocks.rooms = { ABBA: room({ players: [{ id: "host-1", name: "Loreen", score: 0 }] }) };
            renderCards(quiz, { guestId: "host-1", name: "Loreen" });
            await userEvent.setup().click(screen.getByRole("button", { name: "Back to the waiting room" }));
            expect(localStorage.getItem("isHost")).toBe("true");
        });

        it("says so when the quiz is gone meanwhile, and the button works again", async () => {
            mocks.joinRoom.mockResolvedValueOnce(false);
            const user = userEvent.setup();
            renderCards(quiz);
            await user.click(screen.getByRole("button", { name: "Join the quiz" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("This quiz isn't available any more.");
            expect(localStorage.getItem("gameCode")).toBeNull();
            expect(screen.getByRole("button", { name: "Join the quiz" })).toBeEnabled();
        });

        it("says a full room is full, without asking it to join", async () => {
            const players = Array.from({ length: 32 }, (_, index) => ({ id: `p${index}`, name: `Guest ${index}`, score: 0 }));
            mocks.rooms = { ABBA: room({ players }) };
            renderCards(quiz);
            await userEvent.setup().click(screen.getByRole("button", { name: "Join the quiz" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("This quiz is full.");
            expect(mocks.joinRoom).not.toHaveBeenCalled();
        });

        it("says a room that filled up in the meantime is full, not a connection problem", async () => {
            mocks.joinRoom.mockRejectedValueOnce(new JoinRejected("full", "The room is full"));
            renderCards(quiz);
            await userEvent.setup().click(screen.getByRole("button", { name: "Join the quiz" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("This quiz is full.");
            expect(console.error).not.toHaveBeenCalled();
        });

        it("says a failed join can be tried again", async () => {
            mocks.joinRoom.mockRejectedValueOnce(new Error("offline"));
            const user = userEvent.setup();
            renderCards(quiz);
            await user.click(screen.getByRole("button", { name: "Join the quiz" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't join the quiz. Check your connection and try again.");
            mocks.joinRoom.mockResolvedValueOnce(true);
            await user.click(screen.getByRole("button", { name: "Join the quiz" }));
            await waitFor(() => expect(screen.getByText(/^at \/lobby/)).toBeInTheDocument());
        });

        it("joins once on a double tap", async () => {
            mocks.joinRoom.mockReturnValue(new Promise(() => {}));
            const user = userEvent.setup();
            renderCards(quiz);
            const button = screen.getByRole("button", { name: "Join the quiz" });
            await user.click(button);
            await user.click(screen.getByRole("button", { name: "Joining…" }));
            expect(mocks.joinRoom).toHaveBeenCalledTimes(1);
        });
    });

    describe("a quiz being played", () => {
        const running = (players = [{ id: "host-1", name: "Loreen", score: 0 }, self]) =>
            ({ ABBA: room({ phase: "question", started: true, players }) });

        it("takes a player back into it by the rejoin path", async () => {
            mocks.rooms = running();
            renderCards(quiz);
            expect(screen.getByText("In progress")).toBeInTheDocument();
            await userEvent.setup().click(screen.getByRole("button", { name: "Back to the quiz" }));
            expect(localStorage.getItem("playerId")).toBe("g-me");
            expect(localStorage.getItem("gameCode")).toBe("ABBA");
            expect(screen.getByText(/^at \/lobby/)).toBeInTheDocument();
        });

        it("only says it is in progress to someone who is not playing", () => {
            mocks.rooms = running([{ id: "host-1", name: "Loreen", score: 0 }]);
            renderCards(quiz);
            expect(screen.getByText("In progress")).toBeInTheDocument();
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });
    });

    describe("a finished quiz", () => {
        it("shows the results to a player, as the results page reads its room", async () => {
            mocks.rooms = { ABBA: room({ phase: "results", started: true, players: [self] }) };
            renderCards(quiz);
            expect(screen.getByText("Finished")).toBeInTheDocument();
            await userEvent.setup().click(screen.getByRole("button", { name: "See the results" }));
            expect(screen.getByText(/^at \/results/)).toHaveTextContent('{"multiplayer":true,"roomCode":"ABBA","playerId":"g-me"}');
            expect(JSON.parse(sessionStorage.getItem("multiplayerGame")!)).toMatchObject({ roomCode: "ABBA", playerId: "g-me" });
        });

        it("only says it finished to someone who did not play", () => {
            mocks.rooms = { ABBA: room({ phase: "results", started: true }) };
            renderCards(quiz);
            expect(screen.getByText("Finished")).toBeInTheDocument();
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });
    });

    it("says when a quiz room is loading or gone, without a button", () => {
        mocks.rooms = { ABBA: undefined };
        const first = renderCards(quiz);
        expect(screen.getByText("Looking for the room…")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        first.unmount();
        mocks.rooms = { ABBA: null };
        renderCards(quiz);
        expect(screen.getByText("Not available any more")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
