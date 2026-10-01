import { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import "./scoreboard-calm.css";
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

function rowClass(level: Level): string {
    const out = ["lycra", "is-block", "is-static", "is-rank"];
    // `is-high` is the proud lift (src/design/surface.css).
    if (level === "high") out.push("is-high");
    if (level === "low") out.push("is-low");
    return out.join(" ");
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

    return (
        <Page className="calm-page scoreboard-calm">
            <Header>
                <Title>Scoreboard</Title>
                <Subtitle>
                    {scoreHistory.length === 0
                        ? "No runs recorded yet."
                        : `${scoreHistory.length} ${scoreHistory.length === 1 ? "run" : "runs"}. Your best stands highest.`}
                </Subtitle>
            </Header>

            {scoreHistory.length > 1 && (
                <Toolbar>
                    <SortTabs role="tablist" aria-label="Sort scores by">
                        {SORTS.map(({ key, label }) => (
                            <Tab
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={sortKey === key}
                                $active={sortKey === key}
                                onClick={() => setSortKey(key)}
                            >
                                {label}
                            </Tab>
                        ))}
                    </SortTabs>
                </Toolbar>
            )}

            <div className="calm-ground">
                <ol className="lycra-pane">
                    {sortedScores.length === 0 ? (
                        <li className="lycra is-block is-static is-rank">
                            <span className="rank-line">
                                <span>No runs yet</span>
                            </span>
                            <span className="calm-sub">
                                Play a quiz and your scores land here.
                            </span>
                        </li>
                    ) : (
                        sortedScores.map((entry, index) => (
                            <li
                                key={`${entry.date}-${index}`}
                                className={rowClass(levels.get(entry) ?? "rest")}
                            >
                                <span className="rank-line">
                                    <span>
                                        {entry.score} points
                                    </span>
                                    <span className="calm-sub">{quizTitle(entry.difficulty)}</span>
                                </span>
                                <span className="calm-sub">
                                    {entry.total} {entry.total === 1 ? "question" : "questions"} · {formatDate(entry.date)}
                                </span>
                            </li>
                        ))
                    )}
                </ol>
            </div>

            <Footer>
                <BackButton type="button" onClick={() => navigate("/")}>
                    Back to ESCParty
                </BackButton>
            </Footer>
        </Page>
    );
};

export default Scoreboard;

/*
  Page chrome. Everything below sits OUTSIDE the surface on purpose.

  The fabric-ui demo draws the same line: the screen tabs and the back link are
  ordinary styled-components, and only the content itself is .lycra. Keeping
  navigation out of the pane is also what lets the score rows stay direct
  siblings — the fabric tension rule keys off `.lycra:active + .lycra`, and a
  wrapper element around any control kills it silently.
*/

const Page = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0.5rem 0 1.5rem;
`;

const Header = styled.header`
    text-align: center;
`;

const Title = styled.h1`
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 1.5rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.pinkLavender};
    margin: 0;
`;

const Subtitle = styled.p`
    margin-top: 0.5rem;
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.85rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.magnolia};
    opacity: 0.75;
`;

const Toolbar = styled.div`
    display: flex;
    justify-content: center;
`;

const SortTabs = styled.div`
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 999px;
    background: rgba(213, 184, 230, 0.12);
`;

const Tab = styled.button<{ $active: boolean }>`
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 0.35rem 0.85rem;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    background: ${({ $active, theme }) => ($active ? theme.colors.amethyst : "transparent")};
    color: ${({ $active, theme }) => ($active ? theme.colors.nightblue : theme.colors.pinkLavender)};
`;

const Footer = styled.footer`
    display: flex;
    justify-content: center;
`;

const BackButton = styled.button`
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 0.85rem;
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    text-decoration: underline;
    color: ${({ theme }) => theme.colors.pinkLavender};
`;
