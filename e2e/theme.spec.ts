import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { hostParty, joinParty, rateActs } from "./helpers";

/*
 * Theme compliance for the scoreboard party screens (#90). Each screen is
 * measured in the browser and judged by the Calm skill's own self-check,
 * `.claude/skills/escparty-calm/tools/check.py`, so the rules live in one
 * place. Measured inside the surface (`.calm-ground`); the page title and
 * the notes around the ground are chrome, as dna.json says.
 *
 * Sparkle is the same anatomy re-skinned (docs/design/design-system.md):
 * its contrast is checked from the tokens (src/design/contrast.test.ts), and
 * the last test here checks the switch itself.
 */

const CHECK = ".claude/skills/escparty-calm/tools/check.py";
// The check and cross colours (--esc-correct, --esc-wrong, and the cross's
// earlier #dc3545 so a leftover is still counted), at any alpha.
const ACCENT = /rgba?\((40, 167, 69|255, 107, 120|220, 53, 69)[,)]/.source;

const measure = (page: Page) => page.evaluate((accentSource) => {
    const accent = new RegExp(accentSource);
    const grounds = [...document.querySelectorAll<HTMLElement>(".calm-ground")];
    const inGround = (el: Element) => grounds.some(ground => ground.contains(el));

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

    // A control at rest: the blurs of its outer ink shadows (the lit,
    // white counterparts at the top left aren't counted, per dna.json).
    const rest = [...document.querySelectorAll<HTMLElement>("button.lycra")]
        .find(el => inGround(el) && !el.matches(".is-chosen, .is-selected, :disabled, :hover"));
    const blurs = rest
        ? getComputedStyle(rest).boxShadow.split(/,(?![^(]*\))/)
            .filter((layer: string) => !layer.includes("inset") && !layer.includes("255, 255, 255"))
            .map((layer: string) => parseFloat(layer.replace(/rgba?\([^)]*\)/, "").trim().split(/\s+/)[2]))
        : undefined;

    // A chosen control may sink, never lighten.
    const tinted: string[] = [];
    const chosen = [...document.querySelectorAll<HTMLElement>(".lycra.is-chosen")].find(inGround);
    if (rest && chosen) {
        const alpha = (el: HTMLElement) => {
            const match = getComputedStyle(el).backgroundImage.match(/rgba\(255, 255, 255, ([\d.]+)\)/)
                ?? getComputedStyle(el).backgroundColor.match(/rgba\(255, 255, 255, ([\d.]+)\)/);
            return match ? parseFloat(match[1]) : 0;
        };
        if (alpha(chosen) > alpha(rest)) tinted.push("chosen");
    }

    // Controls must be direct children of their pane.
    const controls = [...document.querySelectorAll<HTMLElement>(".lycra")].filter(inGround);
    const wrapped = controls.filter(el => !el.parentElement?.classList.contains("lycra-pane")).length;

    // Green and red, as a share of the surface.
    let accentArea = 0;
    let surfaceArea = 0;
    for (const ground of grounds) {
        const box = ground.getBoundingClientRect();
        surfaceArea += box.width * box.height;
        for (const el of ground.querySelectorAll<HTMLElement>("*")) {
            const style = getComputedStyle(el);
            const painted = [style.backgroundColor, style.color, style.borderTopColor, style.fill, style.stroke];
            if (painted.some(value => accent.test(value))) {
                const r = el.getBoundingClientRect();
                accentArea += r.width * r.height;
            }
        }
    }

    // Only what was actually measured: check.py skips a missing key, and
    // an empty one would pass without checking anything.
    return {
        ...(sizes.size ? { type_sizes_px: [...sizes] } : {}),
        ...(blurs ? { outer_shadow_blurs_px: blurs } : {}),
        ...(rest && chosen ? { tinted_control_states: tinted } : {}),
        ...(controls.length ? {
            controls_not_direct_children: wrapped,
            reduced_motion_transforms: controls.map(el => getComputedStyle(el).transform),
        } : {}),
        ...(surfaceArea ? { accent_coverage_pct: Math.round((accentArea / surfaceArea) * 10000) / 100 } : {}),
    };
}, ACCENT);

const judge = async (page: Page, name: string) => {
    await expect(page.locator(".calm-ground").first()).toBeVisible();
    const measurements = await measure(page);
    const file = test.info().outputPath(`${name}.json`);
    writeFileSync(file, JSON.stringify(measurements, null, 2));
    await test.info().attach(name, { path: file, contentType: "application/json" });

    const run = spawnSync("python3", [CHECK, file], { encoding: "utf8" });
    if (run.error || (run.status !== 0 && run.status !== 1)) {
        // Not a verdict on the page: python3 is missing or check.py broke.
        throw new Error(`Couldn't run ${CHECK} on ${name}: ${run.error ?? `exit ${run.status}`}\n${run.stderr}${run.stdout}`);
    }
    if (run.status === 1) throw new Error(`${name} isn't Calm:\n${run.stdout}`);
    test.info().annotations.push({ type: name, description: run.stdout.split("\n").filter(line => line.startsWith("[")).join("; ") });
};

test("the scoreboard party screens pass Calm's self-check", async ({ browser }) => {
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
