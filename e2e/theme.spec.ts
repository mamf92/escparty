import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { hostParty, joinParty, rateActs } from "./helpers";

/*
 * Theme compliance for the scoreboard party screens (#90), judged against
 * the rules in docs/design/design-system.md as the browser actually renders
 * them, in Calm with reduced motion:
 *
 *   - no frames: nothing on the surface draws a border, and the ground and
 *     pane are layout only (no fill, no shadow);
 *   - a control at rest is the background colour, raised by a pair of soft
 *     shadows (one light, one dark), and a chosen one is pressed in;
 *   - at most four text sizes on a surface;
 *   - nothing moves with reduced motion;
 *   - the check and cross colours stay a small share of the surface.
 *
 * Sparkle dresses the same shapes: its contrast is checked from the tokens
 * (src/design/contrast.test.ts), and the last test here checks the switch.
 */

// The check and cross colours (--esc-correct, --esc-wrong), at any alpha.
const MARKS = /rgba?\((90, 212, 138|255, 123, 134)[,)]/.source;

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
        for (const el of [ground, ...ground.querySelectorAll<HTMLElement>(".lycra-pane")]) {
            const style = getComputedStyle(el);
            const filled = style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none";
            if (filled || style.boxShadow !== "none") framed.push(`${describe(el)} (filled)`);
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

    // A control at rest, and a chosen one if the screen has one.
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--esc-bg").trim();
    const probe = document.createElement("i");
    probe.style.color = bg;
    document.body.append(probe);
    const bgColour = getComputedStyle(probe).color;
    probe.remove();

    const rest = [...document.querySelectorAll<HTMLElement>("button.lycra")]
        .find(el => inGround(el) && !el.matches(".is-chosen, .is-selected, .is-low, :disabled, :hover"));
    const restShadow = rest ? layers(getComputedStyle(rest).boxShadow) : [];
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
        rest: rest ? {
            background: getComputedStyle(rest).backgroundColor,
            image: getComputedStyle(rest).backgroundImage,
            bg: bgColour,
            outer: restShadow.filter(layer => !layer.includes("inset")),
        } : undefined,
        chosenShadow: chosen ? getComputedStyle(chosen).boxShadow : undefined,
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
    if (m.rest) {
        expect(m.rest.background, `${name}: a control is the background colour`).toBe(m.rest.bg);
        expect(m.rest.image, `${name}: a Calm control has a flat face`).toBe("none");
        expect(m.rest.outer.length, `${name}: raised by a pair of shadows`).toBe(2);
        expect(m.rest.outer.some(layer => /rgba\(255, 255, 255/.test(layer)), `${name}: one light`).toBe(true);
        expect(m.rest.outer.some(layer => !/rgba\(255, 255, 255/.test(layer)), `${name}: one dark`).toBe(true);
    }
    if (m.chosenShadow) expect(m.chosenShadow, `${name}: a chosen control is pressed in`).toContain("inset");
    expect(m.transforms.filter(t => t !== "none"), `${name}: nothing moves with reduced motion`).toEqual([]);
    expect(m.markPct, `${name}: check and cross stay a small share`).toBeLessThan(2);
};

test("the scoreboard party screens follow the surface rules", async ({ browser }) => {
    const host = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
    const guest = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();

    await host.goto("/#/party");
    await expect(host.getByRole("button", { name: "Host a party" })).toBeVisible();
    await judge(host, "party-home");

    await host.goto("/#/party/new");
    await expect(host.getByRole("button", { name: "Start the party" })).toBeVisible();
    await judge(host, "party-setup");
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
    // The sequin skin (its magenta sheet, #760c52) reaches a control on the surface.
    const control = page.locator(".calm-ground button.lycra").first();
    await expect(control).toHaveCSS("background-image", /rgb\(118, 12, 82\)/);

    // Remembered across a reload, with no flash of Calm first.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sparkle");
    await expect(page.getByRole("switch", { name: "Sparkle mode" })).toHaveAttribute("aria-checked", "true");

    // Reduced motion: the stars are there, but nothing animates.
    await expect(page.locator(".esc-sparkles > i").first()).toBeVisible();
    const running = await page.evaluate(() => document.getAnimations().length);
    expect(running).toBe(0);

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
