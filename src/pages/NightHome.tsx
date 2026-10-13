import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { CalmLink, CalmNote, CalmPage } from "../components/CalmPage";
import { ConfirmLeave } from "../components/ConfirmLeave";
import { NamePicker } from "../components/NamePicker";
import { NightActivities } from "../components/NightActivities";
import { NightError, NightNotFound } from "../components/NightStates";
import { QrFullScreen } from "../components/QrFullScreen";
import { Badge, Control, Ground, Loader, Pane, Row } from "../design";
import { useNightData } from "../hooks/useNightData";
import { nightLink } from "../utils/joinCode";
import { leaveNightActivities } from "../utils/nightActivities";
import { closeNight, createNight, fetchNightGuest, joinNight, leaveNight, moveNight, type Night, type NightGuest } from "../utils/nightsFirestore";
import { JOIN_TIMEOUT_MS } from "../utils/partyFirestore";
import {
    clearNightIdentity,
    clearPendingNightJoin,
    readNightIdentity,
    readPendingNightJoin,
    saveNightIdentity,
    savePendingNightJoin,
    type NightIdentity,
} from "../utils/nightSession";
import { availablePartyNames } from "../utils/partyNames";

// The host closes the night on the way out (#237): nobody is left in a night
// with no host tools, and the guests are told it is over rather than waiting.
const HOST_LEAVE_PROMPT = "Leave the party night? It ends for everyone, and you can't get the host controls back. Your name is freed.";
const END_PROMPT = "End the party night? Nobody can join or add a quiz or scoreboard after this. What is already on stays open to the guests in it.";
const START_OVER_PROMPT = "Start over with a new code? The guests are carried on to a fresh party night and pick their names again. What was played stays with this code.";
const GUEST_LEAVE_PROMPT = "Leave the party night? Your name is freed and you'd join again as someone new.";

/** The big screen's address in a new tab, from the page's own address. */
const screenUrl = (code: string) => `${nightLink(code)}/screen`;

/**
 * A party night's home (#233), at `/n/CODE`: where a phone lands from the
 * join code or the QR link. Not joined yet, it is the name reel; joined, it
 * is the night itself: its code and QR, what's on, who's here, and the way
 * out. A night that is over, or moved on to a fresh code, says so instead.
 * Keyed by the code, so moving from one night to the next starts clean.
 */
const NightHome = () => {
    const code = useParams().code?.toUpperCase();
    return <NightHomeFor key={code} code={code} />;
};

const NightHomeFor = ({ code }: { code: string | undefined }) => {
    const navigate = useNavigate();
    const { night, guests, error, retry } = useNightData(code);
    const [identity, setIdentity] = useState<NightIdentity | null>(() => (code ? readNightIdentity(code) : null));
    // A stored identity is only good while the roster still has this guest
    // (they may have left from another tab, or the night may be a new one under
    // an old code): checked once on load, then watched in the roster.
    const [verifying, setVerifying] = useState(identity !== null);
    const seenSelf = useRef(false);
    const leaving = useRef(false);
    const [askingLeave, setAskingLeave] = useState(false);
    const [leaveFailed, setLeaveFailed] = useState(false);
    const [leavingNow, setLeavingNow] = useState(false);
    const [showingQr, setShowingQr] = useState(false);
    // The host's own tools (#237): which one is being confirmed, and how it went.
    const [hostAction, setHostAction] = useState<"end" | "restart" | null>(null);
    const [hostBusy, setHostBusy] = useState(false);
    const [hostFailed, setHostFailed] = useState<string | null>(null);
    const hostButton = useRef<HTMLButtonElement>(null);
    // The fresh night a start over made, so a retry after a failed move carries the guests there rather than making a third.
    const freshNight = useRef<string | null>(null);
    const qrButton = useRef<HTMLButtonElement>(null);
    const leaveButton = useRef<HTMLButtonElement>(null);
    const stored = useRef(identity);

    useEffect(() => {
        const first = stored.current;
        if (!code || !first) return;
        let live = true;
        fetchNightGuest(code, first.guestId)
            .then(guest => {
                if (!live) return;
                if (!guest) {
                    clearNightIdentity(code);
                    setIdentity(null);
                }
            })
            // Offline or refused: keep the identity; the roster listener says if it's wrong.
            .catch(err => console.error("Couldn't check the guest list:", err))
            .finally(() => live && setVerifying(false));
        return () => {
            live = false;
        };
    }, [code]);

    // Once the roster has had this guest, a snapshot without them means they
    // were removed: they are not in the night any more.
    useEffect(() => {
        if (!code || !identity || !guests || leaving.current) return;
        if (guests.some(guest => guest.id === identity.guestId)) seenSelf.current = true;
        else if (seenSelf.current) {
            seenSelf.current = false;
            clearNightIdentity(code);
            setIdentity(null);
        }
    }, [code, identity, guests]);

    const toJoin = <CalmLink onClick={() => navigate("/join")}>Back to Join</CalmLink>;

    if (!code || night === null) {
        return (
            <CalmPage title="Party night" footer={toJoin}>
                <NightNotFound code={code} />
            </CalmPage>
        );
    }
    if (night === undefined || verifying) {
        return (
            <CalmPage title="Party night" footer={toJoin}>
                {error ? <NightError error={error} onRetry={retry} /> : <Loader>Finding the party…</Loader>}
            </CalmPage>
        );
    }
    if (night.movedTo) {
        const next = night.movedTo;
        return (
            <CalmPage
                title="Party night"
                footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
                actions={(
                    <Ground>
                        <Pane>
                            <Control elevation="high" onClick={() => navigate(`/n/${next}`)}>Join {next}</Control>
                        </Pane>
                    </Ground>
                )}
            >
                <CalmNote role="status">The party moved to {next}.</CalmNote>
            </CalmPage>
        );
    }
    if (night.closed && !identity) {
        return (
            <CalmPage title="Party night" footer={toJoin}>
                <CalmNote role="status">This party night is over.</CalmNote>
            </CalmPage>
        );
    }
    if (!identity) {
        return (
            <NightJoin
                night={night}
                guests={guests}
                error={error}
                onRetry={retry}
                onJoin={next => {
                    // The guest and their name are written; remember them on this device.
                    saveNightIdentity(night.code, next);
                    setIdentity(next);
                }}
                footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
            />
        );
    }

    const isHost = identity.guestId === night.hostId;
    const roster = guests ?? [];

    const leave = async () => {
        // Between the delete and the roster's snapshot, the roster watcher must
        // not treat this as a removal and flash the join view.
        leaving.current = true;
        setLeavingNow(true);
        setLeaveFailed(false);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            // Offline, a write waits rather than fails: give up after a while
            // and say so, as a join does. If it lands later, the roster no
            // longer has this guest and the join view shows.
            await Promise.race([
                (async () => {
                    await leaveNightActivities(night.activities, identity);
                    if (isHost && !night.closed) await closeNight(night.code);
                    await leaveNight(night.code, identity.guestId, identity.name);
                })(),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error("The leave took too long")), JOIN_TIMEOUT_MS);
                }),
            ]);
            clearNightIdentity(night.code);
            navigate("/");
        } catch (err) {
            console.error("Couldn't leave the party night:", err);
            leaving.current = false;
            setLeavingNow(false);
            setLeaveFailed(true);
        } finally {
            clearTimeout(timer);
        }
    };

    /** One host tool at a time; a failure is said and can be tried again. */
    const hostDo = async (what: string, run: () => Promise<void>) => {
        if (hostBusy) return;
        setHostBusy(true);
        setHostFailed(null);
        try {
            await run();
        } catch (err) {
            console.error(`Couldn't ${what}:`, err);
            setHostFailed(`Couldn't ${what} just now. Check your connection and try again.`);
        }
        setHostBusy(false);
    };
    const endNight = () => hostDo("end the party night", async () => {
        await closeNight(night.code);
        setHostAction(null);
    });
    const startOver = () => hostDo("start over", async () => {
        freshNight.current ??= await createNight(night.title, identity.guestId, identity.name);
        const next = freshNight.current;
        await moveNight(night.code, next);
        saveNightIdentity(next, { guestId: identity.guestId, name: identity.name });
        navigate(`/n/${next}`);
    });
    const cancelHostAction = () => {
        setHostAction(null);
        setHostFailed(null);
        setTimeout(() => hostButton.current?.focus());
    };

    return (
        <CalmPage
            title={night.title}
            subtitle={`You're ${identity.name}`}
            footer={isHost ? <CalmLink onClick={() => window.open(screenUrl(night.code), "_blank", "noopener")}>Open the TV screen</CalmLink> : undefined}
            actions={(
                <>
                    {leaveFailed && <CalmNote role="alert">You couldn&apos;t leave just now. Check your connection and try again.</CalmNote>}
                    {askingLeave ? (
                        <ConfirmLeave
                            prompt={isHost ? HOST_LEAVE_PROMPT : GUEST_LEAVE_PROMPT}
                            stayLabel="Stay at the party"
                            leaveLabel={leavingNow ? "Leaving…" : "Leave the party"}
                            onLeave={() => !leavingNow && void leave()}
                            onStay={() => {
                                // A leave on its way can't be called back: it
                                // would still land and send the guest Home.
                                if (leavingNow) return;
                                setAskingLeave(false);
                                setLeaveFailed(false);
                                setTimeout(() => leaveButton.current?.focus());
                            }}
                        />
                    ) : (
                        <Ground>
                            <Pane>
                                <Control ref={leaveButton} onClick={() => { setHostAction(null); setAskingLeave(true); }}>Leave the party</Control>
                            </Pane>
                        </Ground>
                    )}
                </>
            )}
        >
            <CodeRow>
                <Badge label="Party night code" value={night.code} spell selectable />
                <Control ref={qrButton} onClick={() => setShowingQr(true)}>Show QR code</Control>
            </CodeRow>
            {showingQr && (
                <QrFullScreen
                    code={night.code}
                    link={nightLink(night.code)}
                    onClose={() => { setShowingQr(false); setTimeout(() => qrButton.current?.focus()); }}
                />
            )}
            {error && <NightError error={error} onRetry={retry} />}
            {night.closed && <CalmNote role="status">This party night is over.</CalmNote>}

            {isHost && !night.closed && (
                <>
                    <h2 className="esc-section">Start something</h2>
                    <Ground>
                        <Pane>
                            <Control onClick={() => navigate("/multiplayer", { state: { step: "host", nightCode: night.code } })}>Start a quiz</Control>
                            <Control onClick={() => navigate("/party/new", { state: { nightCode: night.code } })}>Start a scoreboard</Control>
                        </Pane>
                    </Ground>
                </>
            )}

            <NightActivities activities={night.activities} me={identity} />

            <h2 className="esc-section">Who&apos;s here</h2>
            <Ground>
                {guests === undefined ? (
                    <Pane><Row>Counting the guests…</Row></Pane>
                ) : (
                    <Pane as="ul" aria-label="Who's here">
                        {roster.map(guest => (
                            <GuestRow key={guest.id} guest={guest} night={night} me={identity.guestId} />
                        ))}
                    </Pane>
                )}
            </Ground>

            {isHost && !night.closed && (
                <>
                    <h2 className="esc-section">Host</h2>
                    {hostAction ? (
                        <ConfirmLeave
                            prompt={hostAction === "end" ? END_PROMPT : START_OVER_PROMPT}
                            stayLabel="Keep the party going"
                            leaveLabel={hostAction === "end" ? (hostBusy ? "Ending…" : "End the party night") : (hostBusy ? "Starting over…" : "Start over")}
                            onLeave={() => void (hostAction === "end" ? endNight() : startOver())}
                            onStay={cancelHostAction}
                        />
                    ) : (
                        <Ground>
                            <Pane>
                                <Control ref={hostButton} onClick={() => { setAskingLeave(false); setHostAction("end"); }}>End the party night</Control>
                                <Control onClick={() => { setAskingLeave(false); setHostAction("restart"); }}>Start over with a new code</Control>
                            </Pane>
                        </Ground>
                    )}
                    {hostFailed && <CalmNote role="alert">{hostFailed}</CalmNote>}
                </>
            )}
        </CalmPage>
    );
};

const CodeRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--esc-space-3);
`;

/** One guest on the roster: your own row stands proud, and the host is marked. */
const GuestRow = ({ guest, night, me }: { guest: NightGuest; night: Night; me: string }) => {
    const mine = guest.id === me;
    const marks = [mine && "you", guest.id === night.hostId && "host"].filter(Boolean).join(" · ");
    return (
        <Row as="li" elevation={mine ? "high" : undefined}>
            <span className="calm-row">
                <span>{guest.name}</span>
                {marks && <span className="calm-sub">{marks}</span>}
            </span>
        </Row>
    );
};

/**
 * Join a night: the name reel (names already on the roster are off it) and
 * the black Join button. The join is retried with the same guest id and name
 * while it is unconfirmed, even after a reload, so a write that landed late
 * is found rather than left as a second guest (as at a scoreboard party).
 */
const NightJoin = ({ night, guests, error, onRetry, onJoin, footer }: {
    night: Night;
    /** Everyone already in the night, whose names are taken; undefined until they arrive. */
    guests: NightGuest[] | undefined;
    /** A listener errored: nobody joins until the taken names can be read. */
    error: string | null;
    onRetry: () => void;
    onJoin: (identity: NightIdentity) => void;
    footer: ReactNode;
}) => {
    const [name, setName] = useState<string | null>(null);
    const [spinning, setSpinning] = useState(false);
    const [joining, setJoining] = useState(false);
    const [pending, setPending] = useState(() => readPendingNightJoin(night.code));
    // Whether the pending join failed on this visit, or was only found from an earlier one.
    const [pendingFailed, setPendingFailed] = useState(false);
    const [failed, setFailed] = useState(false);
    const [freshId] = useState(() => uuidv4());
    const guestId = pending?.guestId ?? freshId;
    // Names other guests claimed first when this guest pressed Join, kept off
    // the reel even before the roster shows them; the last one is said aloud.
    const [refused, setRefused] = useState<string[]>([]);
    const [refusedNow, setRefusedNow] = useState<string | null>(null);
    const checking = guests === undefined && !error;
    // The names nobody has yet (a guest of this device's own, from a join that landed late, doesn't count).
    const names = useMemo(() => {
        const others = (guests ?? []).filter(guest => guest.id !== guestId);
        return availablePartyNames([...others.map(guest => guest.name), ...refused]);
    }, [guests, refused, guestId]);
    // Any listener error stops joining, even with a roster on screen: it may be stale.
    const blocked = !!error;
    // A pending join keeps its name. Otherwise a landed name that the roster
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
        savePendingNightJoin(night.code, attempt);
        setJoining(true);
        setFailed(false);
        try {
            const joined = await joinNight(night.code, attempt.guestId, attempt.name);
            clearPendingNightJoin(night.code);
            if (joined) {
                onJoin({ guestId: attempt.guestId, name: attempt.name });
                return;
            }
            setPending(null);
            setName(null);
            setRefused(current => [...current, attempt.name]);
            setRefusedNow(attempt.name);
        } catch (joinError) {
            console.error("Couldn't join the party night:", joinError);
            const code = (joinError as { code?: string }).code;
            if (code === "deadline-exceeded" || code === "unavailable") {
                // It may still land: keep the name and id for the retry.
                setPending(attempt);
                setPendingFailed(true);
            } else {
                // Refused for another reason: nothing landed, so any name may be tried.
                clearPendingNightJoin(night.code);
                setPending(null);
                setFailed(true);
            }
        }
        setJoining(false);
    };
    return (
        <CalmPage title={night.title} subtitle={`Join party night ${night.code} and play along all evening.`} footer={footer}>
            {blocked && error !== null ? <NightError error={error} onRetry={onRetry} /> : (
                <>
                    <CalmNote>Spin the reel for a Eurovision legend to be tonight. You can&apos;t type your own.</CalmNote>
                    <NamePicker value={landed} onChange={land} onSpinningChange={setSpinning} names={pending ? [pending.name] : names} disabled={checking || joining || !!pending} />
                </>
            )}
            {checking && <CalmNote role="status">Checking which names are taken…</CalmNote>}
            {justTaken !== null && <CalmNote role="status">{justTaken} was just taken. Spin again.</CalmNote>}
            {pending && !joining && (pendingFailed
                ? <CalmNote role="alert">Couldn&apos;t reach the party, try again. You&apos;re joining as {pending.name}.</CalmNote>
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
        </CalmPage>
    );
};

export default NightHome;
