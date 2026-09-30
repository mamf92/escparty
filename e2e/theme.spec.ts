import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/*
 * Theme compliance for the scoreboard party screens (#90). Each screen is
 * measured in the browser and judged by the Calm skill's own self-check,
 * `.claude/skills/escparty-calm/tools/check.py`, so the rules live in one
 * place. Measured inside the surface (`.calm-ground`); the page title and
 * the notes around the ground are chrome, as dna.json says.
 *
 * Sparkle isn't measured: it is the opt-in WebGL demo behind /fabric-ui,
 * and live pages take Calm's CSS directly (docs/agent/theming.md).
 */

const CHECK = ".claude/skills/escparty-calm/tools/check.py";
const ACCENTS = ["rgb(40, 167, 69)", "rgb(220, 53, 69)"];

const measure = (page: Page) => page.evaluate((accents) => {
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
    const controls = [...document.querySelectorAll<HTMLElement>(".lycra:not(.lycra-pane):not(.lycra-field)")].filter(inGround);
    const wrapped = controls.filter(el => !el.parentElement?.classList.contains("lycra-pane")).length;

    // Green and red, as a share of the surface.
    let accentArea = 0;
    let surfaceArea = 0;
    for (const ground of grounds) {
        const box = ground.getBoundingClientRect();
        surfaceArea += box.width * box.height;
        for (const el of ground.querySelectorAll<HTMLElement>("*")) {
            const style = getComputedStyle(el);
            if (accents.includes(style.backgroundColor)) {
                const r = el.getBoundingClientRect();
                accentArea += r.width * r.height;
            }
        }
    }

    return {
        type_sizes_px: [...sizes],
        ...(blurs ? { outer_shadow_blurs_px: blurs } : {}),
        tinted_control_states: tinted,
        controls_not_direct_children: wrapped,
        accent_coverage_pct: surfaceArea ? Math.round((accentArea / surfaceArea) * 10000) / 100 : 0,
        reduced_motion_transforms: controls.map(el => getComputedStyle(el).transform),
    };
}, ACCENTS);

const judge = async (page: Page, name: string) => {
    await expect(page.locator(".calm-ground").first()).toBeVisible();
    const measurements = await measure(page);
    mkdirSync("test-results/theme", { recursive: true });
    const file = `test-results/theme/${name}.json`;
    writeFileSync(file, JSON.stringify(measurements, null, 2));
    let report: string;
    try {
        report = execFileSync("python3", [CHECK, file], { encoding: "utf8" });
    } catch (error) {
        const failed = error as { stdout?: string };
        throw new Error(`${name} isn't Calm:\n${failed.stdout ?? String(error)}`);
    }
    test.info().annotations.push({ type: name, description: report.split("\n").filter(line => line.startsWith("[")).join("; ") });
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
    await host.getByRole("radio", { name: /Semi-final 1/ }).click();
    await host.getByLabel("Your name at the party").fill("Loreen");
    await host.getByRole("button", { name: "Start the party" }).click();
    await expect(host).toHaveURL(/#\/party\/[A-Z]{4}$/);
    const code = host.url().split("/").pop()!;

    await guest.goto(`/#/party/${code}`);
    await expect(guest.getByRole("button", { name: "Join the party" })).toBeVisible();
    await judge(guest, "party-join");
    await guest.getByLabel("Your name at the party").fill("John");
    await guest.getByRole("button", { name: "Join the party" }).click();

    // Rate three acts on each phone, so every screen has something to show.
    for (const [page, values] of [[host, [10, 6, 2]], [guest, [9, 5, 3]]] as const) {
        for (const [index, value] of values.entries()) {
            for (const group of await page.getByRole("radiogroup").all()) {
                await group.getByRole("radio", { name: String(value), exact: true }).click();
            }
            if (index < values.length - 1) await page.getByRole("button", { name: "Next act" }).click();
        }
        await expect(page.getByText("Your ratings are saved.")).toBeVisible();
    }
    await judge(guest, "party-rate");

    await guest.getByRole("tab", { name: "My ranking" }).click();
    await expect(guest.getByRole("list", { name: "Your ranking" })).toBeVisible();
    await judge(guest, "party-my-ranking");
    await guest.getByRole("tab", { name: "The room" }).click();
    await expect(guest.getByRole("list", { name: "The room's standings" })).toBeVisible();
    await judge(guest, "party-the-room");

    await host.getByRole("tab", { name: "Host" }).click();
    await host.getByLabel("Who goes through").getByRole("button").first().click();
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
