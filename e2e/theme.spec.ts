import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { answerOptions, hostParty, joinParty, rateActs } from "./helpers";

/*
 * Theme compliance for the scoreboard party screens (#90), Home (#169),
 * the single-player entry (#170), the scoreboard break and the host's view
 * (#173), multiplayer create and join (#172), the solo scoreboard (#174),
 * the green room and the results (#176), the quiz library and builder
 * (#177) and the quiz screen (#171), judged against the rules in
 * docs/design/design-system.md as the browser actually renders
 * them, in Calm with reduced motion:
 *
 *   - no frames: nothing on the surface draws a border; the ground is
 *     layout only, and a pane is either layout only or, when it holds a
 *     field, a white card;
 *   - an action at rest is a white button (a blush one on a card) lifted by
 *     a shadow, a choice at rest is a dark tile, and a chosen one is the
 *     hot pink accent;
 *   - at most four text sizes on a surface;
 *   - nothing moves with reduced motion;
 *   - the check and cross colours stay a small share of the surface.
 *
 * Sparkle dresses the same surfaces and only changes the stage behind
 * them; its contrast is checked from the tokens (src/design/contrast.test.ts),
 * and the last tests here check the switch and the stage.
 */

// The check and cross colours, on a tile and on a card, at any alpha.
const MARKS = /rgba?\((107, 227, 154|255, 138, 149|15, 106, 54|179, 18, 42)[,)]/.source;

// The surface's materials, as the browser reports them.
const WHITE = "rgb(255, 255, 255)";
const BLUSH = "rgb(246, 226, 238)";
const TILE = "rgba(58, 10, 38, 0.9)";
const ACCENT = "rgb(224, 23, 126)";

const measure = (page: Page) => page.evaluate((marksSource) => {
    const marks = new RegExp(marksSource);
    const grounds = [...document.querySelectorAll<HTMLElement>(".calm-ground")];
    const inGround = (el: Element) => grounds.some(ground => ground.contains(el));
    const layers = (shadow: string) => shadow === "none" ? [] : shadow.split(/,(?![^(]*\))/).map(layer => layer.trim());

    // Anything on the surface that draws an edge.
    const framed: string[] = [];
    const describe = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`;
    for (const ground of grounds) {
        for (const el of [ground, ...ground.querySelectorAll<HTMLElement>("*")]) {
            const style = getComputedStyle(el);
            const edge = ["Top", "Right", "Bottom", "Left"].some(side =>
                parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0
                && style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none");
            if (edge) framed.push(describe(el));
        }
        // The ground draws nothing; a pane draws nothing unless it is a card.
        const groundStyle = getComputedStyle(ground);
        if (groundStyle.backgroundColor !== "rgba(0, 0, 0, 0)" || groundStyle.backgroundImage !== "none" || groundStyle.boxShadow !== "none") {
            framed.push(`${describe(ground)} (filled)`);
        }
        for (const el of ground.querySelectorAll<HTMLElement>(".lycra-pane")) {
            const style = getComputedStyle(el);
            const filled = style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none" || style.boxShadow !== "none";
            const card = el.matches(".is-card, :has(.lycra-field)");
            if (filled && !(card && style.backgroundColor === "rgb(255, 255, 255)")) framed.push(`${describe(el)} (filled)`);
            if (card && style.backgroundColor !== "rgb(255, 255, 255)") framed.push(`${describe(el)} (a card that isn't white)`);
        }
    }

    // Every size a piece of visible text is set in.
    const sizes = new Set<number>();
    for (const ground of grounds) {
        const walker = document.createTreeWalker(ground, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const parent = node.parentElement;
            if (!parent || !node.textContent?.trim() || parent.closest("option")) continue;
            if (parent.getClientRects().length === 0) continue;
            sizes.add(Math.round(parseFloat(getComputedStyle(parent).fontSize)));
        }
    }

    // An action and a choice at rest, and a chosen one if the screen has one.
    const choice = "[aria-pressed], [role='radio'], [role='tab'], [role='option'], [role='checkbox']";
    const atRest = [...document.querySelectorAll<HTMLElement>("button.lycra")]
        .filter(el => inGround(el) && !el.matches(".is-chosen, .is-selected, .is-high, .is-low, .is-marked, :disabled, :hover"));
    const action = atRest.find(el => !el.matches(choice));
    const pick = atRest.find(el => el.matches(choice) && !el.closest(".is-card, .lycra-pane:has(.lycra-field)"));
    const chosen = [...document.querySelectorAll<HTMLElement>(".lycra.is-chosen")].find(inGround);

    const controls = [...document.querySelectorAll<HTMLElement>(".lycra")].filter(inGround);

    // Green and red, as a share of the surface.
    let markArea = 0;
    let surfaceArea = 0;
    for (const ground of grounds) {
        const box = ground.getBoundingClientRect();
        surfaceArea += box.width * box.height;
        for (const el of ground.querySelectorAll<HTMLElement>("*")) {
            const style = getComputedStyle(el);
            if ([style.backgroundColor, style.color, style.fill, style.stroke].some(value => marks.test(value))) {
                const r = el.getBoundingClientRect();
                markArea += r.width * r.height;
            }
        }
    }

    return {
        framed,
        sizes: [...sizes],
        action: action ? {
            background: getComputedStyle(action).backgroundColor,
            lifted: layers(getComputedStyle(action).boxShadow).some(layer => !layer.includes("inset")),
        } : undefined,
        pick: pick ? getComputedStyle(pick).backgroundColor : undefined,
        chosen: chosen ? getComputedStyle(chosen).backgroundColor : undefined,
        transforms: controls.map(el => getComputedStyle(el).transform),
        markPct: surfaceArea ? (markArea / surfaceArea) * 100 : 0,
    };
}, MARKS);

const judge = async (page: Page, name: string) => {
    await expect(page.locator(".calm-ground").first()).toBeVisible();
    const m = await measure(page);
    const file = test.info().outputPath(`${name}.json`);
    writeFileSync(file, JSON.stringify(m, null, 2));
    await test.info().attach(name, { path: file, contentType: "application/json" });

    expect(m.framed, `${name}: nothing on the surface has a frame`).toEqual([]);
    expect(m.sizes.length, `${name}: at most four text sizes (${m.sizes})`).toBeLessThanOrEqual(4);
    if (m.action) {
        expect([WHITE, BLUSH], `${name}: an action is a white button, or blush on a card`).toContain(m.action.background);
        expect(m.action.lifted, `${name}: an action stands off its surface`).toBe(true);
    }
    if (m.pick) expect(m.pick, `${name}: a choice on the stage is a dark tile`).toBe(TILE);
    if (m.chosen) expect(m.chosen, `${name}: a chosen control is the pink accent`).toBe(ACCENT);
    expect(m.transforms.filter(t => t !== "none"), `${name}: nothing moves with reduced motion`).toEqual([]);
    expect(m.markPct, `${name}: check and cross stay a small share`).toBeLessThan(2);
};

test("the scoreboard party screens follow the surface rules", async ({ browser }) => {
    const host = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    const guest = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    await host.goto("/#/party");
    await expect(host.getByRole("button", { name: "Host a party" })).toBeVisible();
    await judge(host, "party-home");

    // Setup is one question per screen: measure each kind (a list of shows,
    // the extras' yes/no pairs, the name reel) and the summary.
    await host.goto("/#/party/new");
    await expect(host.getByRole("heading", { name: "Which show?" })).toBeVisible();
    await judge(host, "party-setup-show");
    await host.getByRole("radio", { name: /Semi-final 1/ }).click();
    await host.getByRole("radio", { name: /Jury/ }).click();
    await expect(host.getByRole("heading", { name: "Any extras?" })).toBeVisible();
    await judge(host, "party-setup-extras");
    await host.getByRole("radio", { name: "Yes" }).first().click();
    await host.getByRole("radio", { name: "Yes" }).nth(1).click();
    await host.getByRole("button", { name: "Continue" }).click();
    await expect(host.getByRole("spinbutton", { name: "Your name" })).toBeVisible();
    await judge(host, "party-setup-name");
    await host.getByRole("button", { name: "Next name" }).click();
    await host.getByRole("button", { name: "Continue" }).click();
    await expect(host.getByRole("button", { name: "Start the party" })).toBeVisible();
    await judge(host, "party-setup-start");
    const code = await hostParty(host, "Loreen");

    await guest.goto(`/#/party/${code}`);
    await expect(guest.getByRole("button", { name: "Join the party" })).toBeVisible();
    await judge(guest, "party-join");
    await joinParty(guest, code, "John");

    // Rate three acts on each phone, so every screen has something to show.
    await rateActs(host, [10, 6, 2]);
    await rateActs(guest, [9, 5, 3]);
    await judge(guest, "party-rate");

    await guest.getByRole("tab", { name: "My ranking" }).click();
    await expect(guest.getByRole("list", { name: "Your ranking" })).toBeVisible();
    await judge(guest, "party-my-ranking");
    await guest.getByRole("tab", { name: "The room" }).click();
    const standings = guest.getByRole("list", { name: "The room's standings" }).getByRole("listitem");
    await expect(standings.filter({ hasText: "2 ratings" })).toHaveCount(3);
    await judge(guest, "party-the-room");

    await host.getByRole("tab", { name: "Host" }).click();
    await host.getByLabel("Who goes through").getByRole("button").first().click();
    await expect(host.getByText(/tick who goes through \(1 of 10\)/)).toBeVisible();
    await judge(host, "party-host-tools");
    await host.getByRole("button", { name: "Open the awards for everyone" }).click();

    await guest.getByRole("tab", { name: "Rate" }).click();
    await guest.getByRole("button", { name: "See the awards" }).click();
    await expect(guest.getByText("The Jedward Twins")).toBeVisible();
    await judge(guest, "party-awards");

    await guest.goto(`/#/party/${code}/screen`);
    await expect(guest.getByText("Scan the code with your phone to rate along")).toBeVisible();
    await judge(guest, "party-big-screen");

    await Promise.all([host, guest].map(page => page.context().close()));
});

test("the green room and the results follow the surface rules", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    // The host's green room, before and after picking a quiz.
    await page.goto("/#/multiplayer");
    await page.getByRole("button", { name: /^Host a game/ }).click();
    await page.getByRole("button", { name: /^Host and play/ }).click();
    await expect(page.getByRole("heading", { name: "The green room" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Players" }).getByRole("listitem")).toHaveCount(1);
    await judge(page, "lobby-pick-quiz");
    await page.getByRole("button", { name: "Nul Points" }).click();
    await expect(page.getByRole("button", { name: "Start anyway" })).toBeVisible();
    await judge(page, "lobby-host");
    const { code, playerId } = await page.evaluate(() => ({ code: localStorage.getItem("gameCode"), playerId: localStorage.getItem("playerId") }));

    // The same room's standings (one player on nought), fully revealed.
    await page.evaluate(game => sessionStorage.setItem("multiplayerGame", JSON.stringify(game)), { multiplayer: true, roomCode: code, playerId });
    await page.goto("/#/results");
    await expect(page.getByRole("heading", { name: "The results are in" })).toBeVisible();
    await page.getByRole("button", { name: "Show everything" }).click();
    await expect(page.getByRole("list", { name: "Final standings" }).getByRole("listitem")).toHaveCount(1);
    await judge(page, "results-standings");

    // A solo finish with a past score.
    await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.setItem("quizScores", JSON.stringify([{ score: 7, total: 10, date: "2026-05-16T00:00:00Z" }]));
    });
    await page.goto("/#/");
    await page.goto("/#/results");
    await expect(page.getByRole("heading", { name: "Quiz complete" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your past scores" })).toBeVisible();
    await judge(page, "results-solo");

    await page.context().close();
});

test("the quiz library and builder follow the surface rules", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    await page.goto("/#/quizzes");
    await page.getByRole("radio", { name: /Quick Fire/ }).click();
    await expect(page.getByRole("button", { name: "Make my own version" })).toBeVisible();
    await judge(page, "quiz-library");

    // The builder, from a premade quiz, with a question picked.
    await page.getByRole("button", { name: "Make my own version" }).click();
    const questions = page.getByRole("radiogroup", { name: "Questions in this quiz" }).getByRole("radio");
    await expect(questions).toHaveCount(10);
    await questions.nth(1).click();
    await expect(page.getByRole("button", { name: "Edit this question" })).toBeVisible();
    await judge(page, "quiz-builder");

    await page.getByRole("button", { name: "Add from the bank" }).click();
    await expect(page.getByRole("group", { name: "Bank questions" })).toBeVisible();
    await judge(page, "quiz-builder-bank");
    await page.getByRole("button", { name: "Use these questions" }).click();

    // The question editor, with its notes beside the fields.
    await page.getByRole("button", { name: "Write a question" }).click();
    await page.getByRole("button", { name: "Add to the quiz" }).click();
    await expect(page.getByText("Write the question.", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("things to fix");
    await judge(page, "quiz-builder-write");
    await page.context().close();
});

test("the home screen follows the surface rules, and re-skins in Sparkle", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Join a party" })).toBeVisible();
    await judge(page, "home");

    // Home re-skins with the switch like every other screen: no photo, no own colours.
    await page.getByRole("switch", { name: "Sparkle mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sparkle");
    // Sparkle only changes the stage: the sequin floor appears behind the
    // ball, and the two ways in stay the same buttons.
    await expect(page.locator(".esc-stage .esc-stage-sequins")).toHaveCount(1);
    await judge(page, "home-sparkle");
    const controls = page.locator(".calm-ground button.lycra");
    await expect(controls).toHaveCount(2);
    await expect(controls.first()).toHaveCSS("background-color", "rgb(20, 8, 16)");
    await expect(controls.nth(1)).toHaveCSS("background-color", "rgb(255, 255, 255)");

    // Home floats the big ball, and the title still clears it.
    const ball = await page.locator(".esc-stage-ball").boundingBox();
    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    expect(ball && title && ball.width).toBeGreaterThan(140);
    expect(ball && title && title.y).toBeGreaterThanOrEqual((ball?.y ?? 0) + (ball?.width ?? 0));
    await page.context().close();
});

test("the host and join screens follow the surface rules", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Host a party" }).click();
    await expect(page.getByRole("button", { name: /^Host a scoreboard/ })).toBeVisible();
    await judge(page, "host");
    await page.getByRole("button", { name: "Back to ESCParty" }).click();
    await page.getByRole("button", { name: "Join a party" }).click();
    await expect(page.getByLabel("Party code")).toBeVisible();
    await judge(page, "join");
    await page.context().close();
});

test("the solo scoreboard follows the surface rules", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("quizScores", JSON.stringify([
        { score: 900, total: 10, difficulty: "easy", date: "2026-05-10T00:00:00Z" },
        { score: 1300, total: 10, difficulty: "hard", date: "2026-05-01T00:00:00Z" },
        { score: 400, total: 10, difficulty: "medium", date: "2026-05-16T00:00:00Z" },
    ])));
    await page.goto("/#/scoreboard");
    await expect(page.getByText("3 runs. Your best stands highest.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Score" })).toHaveAttribute("aria-selected", "true");
    await judge(page, "solo-scoreboard");

    // The best run stands proud, a white row among dark tiles, in both themes.
    const best = page.getByRole("list", { name: "Your runs" }).getByRole("listitem").first();
    await expect(best).toHaveClass(/is-high/);
    await expect(best).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await page.getByRole("switch", { name: "Sparkle mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sparkle");
    await expect(best).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.context().close();
});

test("the scoreboard break and the host's view follow the surface rules", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    // Opened without a game, the break is a single player's (#173).
    await page.goto("/#/mid-quiz-scoreboard");
    await expect(page.getByRole("button", { name: "Continue the quiz" })).toBeVisible();
    await judge(page, "scoreboard-break");

    // The host's view with no room to watch: its error state and way out.
    await page.goto("/#/host-observer");
    await expect(page.getByRole("button", { name: "Back to multiplayer" })).toBeVisible();
    await judge(page, "host-view-no-room");

    await page.context().close();
});

test("the single-player entry screens follow the surface rules", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    await page.goto("/#/select-difficulty");
    await expect(page.getByRole("heading", { level: 1, name: "Pick a difficulty" })).toBeVisible();
    await judge(page, "select-difficulty");

    await page.goto("/#/quiz");
    await expect(page.getByRole("button", { name: "Open the quiz library" })).toBeVisible();
    await judge(page, "quiz-moved");
    await page.getByRole("button", { name: "Open the quiz library" }).click();
    await expect(page).toHaveURL(/#\/quizzes$/);

    await page.context().close();
});

test("Sparkle mode switches every screen, is remembered, and keeps still with reduced motion", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    await page.goto("/#/quizzes");
    const toggle = page.getByRole("switch", { name: "Sparkle mode" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "calm");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sparkle");
    // Sparkle swaps the stage only: the sequin floor appears behind the ball.
    await expect(page.locator(".esc-stage .esc-stage-sequins")).toHaveCount(1);

    // Remembered across a reload, with no flash of Calm first.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sparkle");
    await expect(page.getByRole("switch", { name: "Sparkle mode" })).toHaveAttribute("aria-checked", "true");

    // Reduced motion: the ball and sequins are there, but nothing animates.
    await expect(page.locator(".esc-stage canvas")).toHaveCount(2);
    const running = await page.evaluate(() => document.getAnimations().length);
    expect(running).toBe(0);

    await page.context().close();
});

test("the quiz screen follows the surface rules, open, chosen and settled", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    // Solo questions run on a 10s clock, longer than the judges below can
    // take on a loaded runner: stop the page's clock once the question is
    // up, so it stays open until it's answered and settled after that (the
    // verdict's moment before the next question is on that clock too).
    await page.clock.install();
    await page.goto("/#/quiz/easy");
    await expect(page.getByRole("timer")).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    await judge(page, "quiz-open");

    // Tapping is the answer: the question settles at once.
    await answerOptions(page).nth(1).click();
    await expect(answerOptions(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".calm-marker").first()).toBeVisible();
    await judge(page, "quiz-settled");

    await page.context().close();
});

test("the multiplayer create and join screen follows the surface rules (#172)", async ({ browser }) => {
    const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    await page.goto("/#/multiplayer");
    await expect(page.getByRole("button", { name: /^Host a game/ })).toBeVisible();
    await judge(page, "multiplayer-choose");

    await page.getByRole("button", { name: /^Host a game/ }).click();
    await expect(page.getByRole("button", { name: /^Host and play/ })).toBeVisible();
    await judge(page, "multiplayer-host");

    await page.getByRole("button", { name: "Back to host or join" }).click();
    await page.getByRole("button", { name: /^Join a game/ }).click();
    await page.getByRole("button", { name: "Join the game" }).click();
    await expect(page.getByText("A game code is four letters, like ABBA.")).toBeVisible();
    await judge(page, "multiplayer-join");

    await page.context().close();
});
