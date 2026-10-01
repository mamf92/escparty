import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalmLink, CalmPage } from "../components/CalmPage";
import { Control, Ground, Pane, Row } from "../design";
import { quizTitle } from "../utils/quizCatalog";

interface ScoreEntry {
    score: number;
    total: number;
    difficulty: string;
    date: string;
}

type SortKey = "date" | "difficulty" | "score";

/** The three elevation steps the Calm surface has. */
type Level = "high" | "rest" | "low";

/*
  Score leads, because the ladder has to read on arrival.

  The ranked ladder has to be ordered by whatever elevation encodes. A
  surface's lift is a relative signal: plain when the proud row sits beside
  its peers, easy to miss when it is scattered somewhere down a list of six.
  Sorted by score, the ladder descends and the eye reads a slope; the
  other two sorts are still honest (the best and worst stay marked) but they
  are a history, not a ranking.
*/
const SORTS: { key: SortKey; label: string }[] = [
    { key: "score", label: "Score" },
    { key: "date", label: "Date" },
    { key: "difficulty", label: "Difficulty" },
];

/** Rank by the points each row shows, so the ladder matches its numbers. */
function pointsOf(entry: ScoreEntry): number {
    return entry.score;
}

/**
 * Elevation encodes the score, never the row's place in the list.
 *
 * The ranked-ladder archetype exists so the ranking reads before any number
 * does. If height tracked list position, sorting by date would put the newest
 * run highest and the elevation would be telling a lie the numbers underneath
 * it contradict. Keyed to the score instead, sorting rearranges the rows
 * without ever relabelling them: a personal best stands proud whichever way
 * the list is ordered.
 *
 * Calm has exactly three steps, so this is best / middle / worst rather than a
 * continuous ramp. When every run scored the same there is no ranking to show
 * and the whole list sits at rest — a ladder with one rung is not a ladder.
 */
function levelsFor(entries: ScoreEntry[]): Map<ScoreEntry, Level> {
    const levels = new Map<ScoreEntry, Level>();
    if (entries.length === 0) return levels;

    const points = entries.map(pointsOf);
    const best = Math.max(...points);
    const worst = Math.min(...points);

    for (const entry of entries) {
        if (best === worst) {
            levels.set(entry, "rest");
            continue;
        }
        const r = pointsOf(entry);
        levels.set(entry, r === best ? "high" : r === worst ? "low" : "rest");
    }
    return levels;
}

/** Classic quizzes easiest first, then every other quiz by its title. */
const CLASSIC_ORDER = ["easy", "medium", "hard"];
function difficultyRank(entry: ScoreEntry): number {
    const rank = CLASSIC_ORDER.indexOf(entry.difficulty);
    return rank === -1 ? CLASSIC_ORDER.length : rank;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "Unknown date"
        : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const Scoreboard = () => {
    const navigate = useNavigate();
    const [scoreHistory] = useState<ScoreEntry[]>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("quizScores") || "[]");
            return Array.isArray(stored) ? stored : [];
        } catch {
            return [];
        }
    });
    const [sortKey, setSortKey] = useState<SortKey>("score");

    // Levels are computed from the unsorted history, so re-sorting moves rows
    // without changing how high any of them sits.
    const levels = useMemo(() => levelsFor(scoreHistory), [scoreHistory]);

    const sortedScores = useMemo(() => {
        const rows = [...scoreHistory];
        if (sortKey === "date") {
            return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        if (sortKey === "difficulty") {
            return rows.sort((a, b) => difficultyRank(a) - difficultyRank(b) || quizTitle(a.difficulty).localeCompare(quizTitle(b.difficulty)));
        }
        return rows.sort((a, b) => pointsOf(b) - pointsOf(a));
    }, [scoreHistory, sortKey]);

    const tabsId = useId();
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const tabId = (key: SortKey) => `${tabsId}-tab-${key}`;
    const panelId = `${tabsId}-panel`;

    /** Arrow keys, Home and End move between the sort tabs (WAI-ARIA tabs). */
    const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = SORTS.length - 1;
        const next =
            event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
            : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
            : event.key === "Home" ? 0
            : event.key === "End" ? last
            : undefined;
        if (next === undefined) return;
        event.preventDefault();
        setSortKey(SORTS[next].key);
        tabRefs.current[next]?.focus();
    };

    // One run has nothing to sort, so the tabs only appear from two runs up.
    const sortable = scoreHistory.length > 1;

    const runs = (
        <Ground>
            <Pane as="ol" aria-label="Your runs">
                {sortedScores.length === 0 ? (
                    <Row as="li">
                        <span className="calm-row">
                            <span>No runs yet</span>
                        </span>
                        <span className="calm-sub">Play a quiz and your scores land here.</span>
                    </Row>
                ) : (
                    sortedScores.map((entry, index) => (
                        <Row
                            as="li"
                            key={`${entry.date}-${index}`}
                            elevation={levels.get(entry) ?? "rest"}
                        >
                            <span className="calm-row">
                                <span>{entry.score} points</span>
                                <span className="calm-sub">{quizTitle(entry.difficulty)}</span>
                            </span>
                            <span className="calm-sub">
                                {entry.total} {entry.total === 1 ? "question" : "questions"} · {formatDate(entry.date)}
                            </span>
                        </Row>
                    ))
                )}
            </Pane>
        </Ground>
    );

    return (
        <CalmPage
            title="Scoreboard"
            subtitle={
                scoreHistory.length === 0
                    ? "No runs recorded yet."
                    : `${scoreHistory.length} ${scoreHistory.length === 1 ? "run" : "runs"}. Your best stands highest.`
            }
            footer={<CalmLink onClick={() => navigate("/")}>Back to ESCParty</CalmLink>}
        >
            {sortable ? (
                <>
                    <Ground>
                        <Pane layout="split" role="tablist" aria-label="Sort scores by">
                            {SORTS.map(({ key, label }, index) => {
                                const selected = sortKey === key;
                                // A tab states its choice with aria-selected; Control
                                // leaves aria-pressed off any control given a role.
                                return (
                                    <Control
                                        key={key}
                                        ref={el => { tabRefs.current[index] = el; }}
                                        id={tabId(key)}
                                        role="tab"
                                        aria-selected={selected}
                                        aria-controls={panelId}
                                        tabIndex={selected ? 0 : -1}
                                        chosen={selected}
                                        onClick={() => setSortKey(key)}
                                        onKeyDown={event => onTabKey(event, index)}
                                    >
                                        {label}
                                    </Control>
                                );
                            })}
                        </Pane>
                    </Ground>
                    <div role="tabpanel" id={panelId} aria-labelledby={tabId(sortKey)}>
                        {runs}
                    </div>
                </>
            ) : runs}
        </CalmPage>
    );
};

export default Scoreboard;
