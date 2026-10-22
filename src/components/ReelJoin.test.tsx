import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { ReelJoin, type ReelJoinAttempt } from "./ReelJoin";

const reducedMotion = () =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

const joinButton = () => screen.getByRole("button", { name: /^(Join the party|Joining…)$/ });
const spin = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Next name" }));
const reel = () => screen.getByRole("spinbutton", { name: "Your name" });

const setup = (change: Partial<ComponentProps<typeof ReelJoin>> = {}) => {
    let kept: ReelJoinAttempt | null = null;
    const props: ComponentProps<typeof ReelJoin> = {
        title: "Grand final",
        subtitle: "Join party ABBA.",
        footer: <span>Back</span>,
        others: [{ guestId: "g-1", name: "Loreen" }, { guestId: "g-2", name: "Netta" }],
        error: null,
        errorView: message => <p role="alert">Lost the party: {message}</p>,
        readPending: () => kept,
        savePending: vi.fn(attempt => { kept = attempt; }),
        clearPending: vi.fn(() => { kept = null; }),
        send: vi.fn(async () => true),
        onJoin: vi.fn(),
        what: "the party",
        pendingFailedNote: name => <>Couldn&apos;t reach it as {name}.</>,
        ...change,
    };
    const view = renderWithProviders(<ReelJoin {...props} />);
    const rerender = (more: Partial<ComponentProps<typeof ReelJoin>>) => view.rerender(<ReelJoin {...props} {...more} />);
    return { props, kept: () => kept, rerender };
};

describe("ReelJoin", () => {
    beforeEach(reducedMotion);
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("leaves the taken names off the reel, and joins as the landed name", async () => {
        const user = userEvent.setup();
        const { props } = setup({ children: <p>Below the button</p> });
        expect(screen.getByRole("heading", { level: 1, name: "Grand final" })).toBeInTheDocument();
        expect(screen.getByText("Below the button")).toBeInTheDocument();
        expect(joinButton()).toBeDisabled();
        await spin(user);
        // Loreen is taken, so the first name left on the reel is Käärijä.
        expect(reel()).toHaveAttribute("aria-valuetext", "Käärijä");
        await user.click(joinButton());
        const [guestId, name] = vi.mocked(props.send).mock.calls[0];
        expect(name).toBe("Käärijä");
        expect(props.savePending).toHaveBeenCalledWith({ guestId, name: "Käärijä" });
        expect(props.clearPending).toHaveBeenCalled();
        expect(props.onJoin).toHaveBeenCalledWith({ guestId, name: "Käärijä" });
    });

    it("doesn't call its own name taken when the join shows in the list before the write returns", async () => {
        let land: (joined: boolean) => void = () => {};
        const send = vi.fn(() => new Promise<boolean>(resolve => { land = resolve; }));
        const user = userEvent.setup();
        const { props, rerender } = setup({ send });
        await spin(user);
        await user.click(joinButton());
        const [guestId] = send.mock.calls[0] as unknown as [string];
        // Firestore's listener sees the local write first.
        rerender({ others: [...(props.others ?? []), { guestId, name: "Käärijä" }] });
        expect(screen.queryByText(/was just taken/)).not.toBeInTheDocument();
        expect(reel()).toHaveAttribute("aria-valuetext", "Käärijä");
        land(true);
    });

    it("says a name was just taken and keeps it off the reel", async () => {
        const user = userEvent.setup();
        const { props } = setup({ send: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true) });
        await spin(user);
        await user.click(joinButton());
        expect(await screen.findByText("Käärijä was just taken. Spin again.")).toBeInTheDocument();
        expect(props.onJoin).not.toHaveBeenCalled();
        await spin(user);
        expect(reel()).not.toHaveAttribute("aria-valuetext", "Käärijä");
    });

    it("keeps a join that timed out, and retries it with the same id and name", async () => {
        const user = userEvent.setup();
        const send = vi.fn()
            .mockRejectedValueOnce(Object.assign(new Error("slow"), { code: "deadline-exceeded" }))
            .mockResolvedValue(true);
        const { props, kept } = setup({ send });
        await spin(user);
        await user.click(joinButton());
        expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach it as Käärijä.");
        const [guestId, name] = send.mock.calls[0];
        expect(kept()).toEqual({ guestId, name });
        await user.click(joinButton());
        expect(send).toHaveBeenLastCalledWith(guestId, name);
        expect(props.onJoin).toHaveBeenCalledWith({ guestId, name });
    });

    it("lets any name be tried after a join refused for another reason", async () => {
        const user = userEvent.setup();
        const { kept } = setup({ send: vi.fn().mockRejectedValue(Object.assign(new Error("no"), { code: "permission-denied" })) });
        await spin(user);
        await user.click(joinButton());
        expect(await screen.findByRole("alert")).toHaveTextContent("You couldn't join just now");
        expect(kept()).toBeNull();
    });

    it("picks up a join kept from an earlier visit", async () => {
        const user = userEvent.setup();
        const { props } = setup({ readPending: () => ({ guestId: "g-late", name: "Hatari" }) });
        expect(screen.getByText("You were joining as Hatari. Press Join to finish.")).toBeInTheDocument();
        await user.click(joinButton());
        expect(props.send).toHaveBeenCalledWith("g-late", "Hatari");
    });

    it("keeps the numbered names a full party shows off the reel, only when distinct", async () => {
        // Two guests share every name: the second of each is shown as "<name> 2".
        const { PARTY_NAMES } = await import("../utils/partyNames");
        const others = PARTY_NAMES.flatMap((name, i) => [
            { guestId: `a-${i}`, name },
            { guestId: `b-${i}`, name },
        ]);
        const user = userEvent.setup();
        setup({ others, distinct: true });
        await spin(user);
        expect(reel()).toHaveAttribute("aria-valuetext", "Loreen 3");
    });

    it("offers the first numbered name when not distinct", async () => {
        const { PARTY_NAMES } = await import("../utils/partyNames");
        const user = userEvent.setup();
        setup({ others: PARTY_NAMES.map((name, i) => ({ guestId: `a-${i}`, name })) });
        await spin(user);
        expect(reel()).toHaveAttribute("aria-valuetext", "Loreen 2");
    });

    it("sends one join, however often Join is pressed while it is on its way", async () => {
        let land: (joined: boolean) => void = () => {};
        const send = vi.fn(() => new Promise<boolean>(resolve => { land = resolve; }));
        const user = userEvent.setup();
        setup({ send });
        await spin(user);
        await user.click(joinButton());
        expect(joinButton()).toHaveTextContent("Joining…");
        await user.click(joinButton());
        expect(send).toHaveBeenCalledTimes(1);
        land(true);
    });

    it("lets the guest try again when a join fails with no error code at all", async () => {
        const user = userEvent.setup();
        setup({ send: vi.fn().mockRejectedValue(undefined) });
        await spin(user);
        await user.click(joinButton());
        expect(await screen.findByRole("alert")).toHaveTextContent("You couldn't join just now");
        expect(joinButton()).toHaveTextContent("Join the party");
    });

    it("waits for the taken names before anyone can spin", () => {
        setup({ others: undefined });
        expect(screen.getByText("Checking which names are taken…")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next name" })).toBeDisabled();
    });

    it("shows the error view instead of the reel, and no join", () => {
        setup({ error: "gone" });
        expect(screen.getByRole("alert")).toHaveTextContent("Lost the party: gone");
        expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
        expect(joinButton()).toBeDisabled();
    });
});
