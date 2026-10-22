import { useMemo, useState, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { Control, Ground, Pane } from "../design";
import { availablePartyNames, withDistinctNames } from "../utils/partyNames";
import type { PendingJoin } from "../utils/partySession";
import { CalmNote, CalmPage } from "./CalmPage";
import { NamePicker } from "./NamePicker";

/** A join: the guest id and the name it claims (a party's and a night's are the same shape). */
export type ReelJoinAttempt = PendingJoin;

/**
 * Join a scoreboard party or a party night (#249): the name reel (names
 * already taken are off it) and the black Join button. A join that times
 * out is kept with its guest id and name and retried as is, even after a
 * reload, so a write that landed late is found rather than left as a second
 * guest (#229). A name another guest claimed at the same moment is kept off
 * the reel and said aloud.
 */
export const ReelJoin = ({
    title, subtitle, footer, others, distinct = false, error, errorView,
    readPending, savePending, clearPending, send, onJoin, what, pendingFailedNote, children,
}: {
    title: string;
    subtitle: string;
    footer: ReactNode;
    /** Everyone already in, whose names are taken; undefined until they arrive. */
    others: readonly ReelJoinAttempt[] | undefined;
    /** Also keep the numbered names guests are shown as (" 2") off a full reel: parties, which may hold old shared names. */
    distinct?: boolean;
    /** A listener errored: nobody joins until the taken names can be read. */
    error: string | null;
    /** Shown in place of the reel while `error` is set. */
    errorView: (error: string) => ReactNode;
    readPending: () => ReelJoinAttempt | null;
    savePending: (attempt: ReelJoinAttempt) => void;
    clearPending: () => void;
    /** Writes the join: true when it landed, false when the name was just taken. */
    send: (guestId: string, name: string) => Promise<boolean>;
    onJoin: (attempt: ReelJoinAttempt) => void;
    /** What is joined, for the console: "the party". */
    what: string;
    /** Said when a kept join couldn't reach the server on this visit. */
    pendingFailedNote: (name: string) => ReactNode;
    /** Below the Join button. */
    children?: ReactNode;
}) => {
    const [name, setName] = useState<string | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [joining, setJoining] = useState(false);
    const [pending, setPending] = useState(readPending);
    // Whether the pending join failed on this visit, or was only found from an earlier one.
    const [pendingFailed, setPendingFailed] = useState(false);
    const [failed, setFailed] = useState(false);
    const [freshId] = useState(() => uuidv4());
    const guestId = pending?.guestId ?? freshId;
    // Names other guests claimed first when this guest pressed Join, kept off
    // the reel even before the list shows them; the last one is said aloud.
    const [refused, setRefused] = useState<string[]>([]);
    const [refusedNow, setRefusedNow] = useState<string | null>(null);
    const checking = others === undefined && !error;
    // The names nobody has yet. Only offered with no pending join (that one
    // keeps its name), so this guest is never among `others` here.
    const names = useMemo(() => {
        const taken = others ?? [];
        const shown = distinct ? withDistinctNames(taken).map(other => other.name) : [];
        return availablePartyNames([...taken.map(other => other.name), ...refused], shown);
    }, [others, refused, distinct]);
    // Any listener error stops joining, even with names on screen: they may be stale.
    const blocked = !!error;
    // A pending join keeps its name. Otherwise a landed name that an update
    // takes before this guest joins is let go.
    const landed = pending ? pending.name : name !== null && names.includes(name) ? name : null;
    const justTaken = !pending && name !== null && landed === null ? name : refusedNow;
    const land = (next: string | null) => {
        setName(next);
        setRefusedNow(null);
        setFailed(false);
    };
    const join = async () => {
        if (landed === null || joining) return;
        const attempt = { guestId, name: landed };
        savePending(attempt);
        setJoining(true);
        setFailed(false);
        try {
            const joined = await send(attempt.guestId, attempt.name);
            clearPending();
            if (joined) {
                onJoin(attempt);
                return;
            }
            setPending(null);
            setName(null);
            setRefused(current => [...current, attempt.name]);
            setRefusedNow(attempt.name);
        } catch (joinError) {
            console.error(`Couldn't join ${what}:`, joinError);
            const code = (joinError as { code?: string } | null | undefined)?.code;
            if (code === "deadline-exceeded" || code === "unavailable") {
                // It may still land: keep the name and id for the retry.
                setPending(attempt);
                setPendingFailed(true);
            } else {
                // Refused for another reason: nothing landed, so any name may be tried.
                clearPending();
                setPending(null);
                setFailed(true);
            }
        }
        setJoining(false);
    };
    return (
        <CalmPage title={title} subtitle={subtitle} footer={footer}>
            {error !== null ? errorView(error) : (
                <>
                    <CalmNote>Spin the reel for a Eurovision legend to be tonight. You can&apos;t type your own.</CalmNote>
                    <NamePicker value={landed} onChange={land} onSpinningChange={setSpinning} names={pending ? [pending.name] : names} disabled={checking || joining || !!pending} />
                </>
            )}
            {checking && <CalmNote role="status">Checking which names are taken…</CalmNote>}
            {justTaken !== null && <CalmNote role="status">{justTaken} was just taken. Spin again.</CalmNote>}
            {pending && !joining && (pendingFailed
                ? <CalmNote role="alert">{pendingFailedNote(pending.name)}</CalmNote>
                : <CalmNote role="status">You were joining as {pending.name}. Press Join to finish.</CalmNote>)}
            {failed && <CalmNote role="alert">You couldn&apos;t join just now. Spin again or try in a moment.</CalmNote>}
            <Ground>
                <Pane>
                    <Control
                        elevation="high"
                        disabled={landed === null || spinning || checking || blocked || joining}
                        onClick={() => void join()}
                    >
                        {joining ? "Joining…" : "Join the party"}
                    </Control>
                </Pane>
            </Ground>
            {children}
        </CalmPage>
    );
};
