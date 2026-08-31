import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import "../fabric-ui/lycra-surface.css";
import "../fabric-ui/calm.css";
import "./scoreboard-calm.css";

interface ScoreEntry {
    score: number;
    total: number;
    difficulty: string;
    date: string;
}

type SortKey = "date" | "difficulty" | "score";

/** The three elevation steps the Calm surface has. */
type Level = "high" | "rest" | "low";

const SORTS: { key: SortKey; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "difficulty", label: "Difficulty" },
    { key: "score", label: "Score" },
];

function ratioOf(entry: ScoreEntry): number {
    return entry.total > 0 ? entry.score / entry.total : 0;
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

    const ratios = entries.map(ratioOf);
    const best = Math.max(...ratios);
    const worst = Math.min(...ratios);

    for (const entry of entries) {
        if (best === worst) {
            levels.set(entry, "rest");
            continue;
        }
        const r = ratioOf(entry);
        levels.set(entry, r === best ? "high" : r === worst ? "low" : "rest");
    }
    return levels;
}

function rowClass(level: Level): string {
    const out = ["lycra", "is-block", "is-static", "is-rank"];
    // `is-selected` carries the taller shadow; `is-high` is what calm.css keys
    // the settled-result overrides off. The membrane renderer reads the same
    // pair, so the two modes agree on what "proud" means.
    if (level === "high") out.push("is-selected", "is-high");
    if (level === "low") out.push("is-low");
    return out.join(" ");
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "Unknown date"
        : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const Scoreboard = () => {
    const navigate = useNavigate();
    const [scoreHistory, setScoreHistory] = useState<ScoreEntry[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>("date");

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("quizScores") || "[]");
            setScoreHistory(Array.isArray(stored) ? stored : []);
        } catch {
            setScoreHistory([]);
        }
    }, []);

    // Levels are computed from the unsorted history, so re-sorting moves rows
    // without changing how high any of them sits.
    const levels = useMemo(() => levelsFor(scoreHistory), [scoreHistory]);

    const sortedScores = useMemo(() => {
        const rows = [...scoreHistory];
        if (sortKey === "date") {
            return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        if (sortKey === "difficulty") {
            return rows.sort((a, b) => a.difficulty.localeCompare(b.difficulty));
        }
        return rows.sort((a, b) => ratioOf(b) - ratioOf(a));
    }, [scoreHistory, sortKey]);

    return (
        <Page className="scoreboard-calm">
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
                                        {entry.score} / {entry.total}
                                    </span>
                                    <span className="calm-sub">{entry.difficulty}</span>
                                </span>
                                <span className="calm-sub">{formatDate(entry.date)}</span>
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
