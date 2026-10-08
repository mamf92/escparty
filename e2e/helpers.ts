import { expect, type Page } from "@playwright/test";

/** The current question's answer buttons (not the way out). Tapping one is the answer. */
export const answerOptions = (page: Page) =>
    page.getByRole("group", { name: "Answers" }).getByRole("button");

/** Host a scoreboard party for Semi-final 1 with the given sheet; returns its code. */
export const hostParty = async (page: Page, name: string, sheet?: RegExp) => {
    await page.goto("/#/party/new");
    await page.getByRole("radio", { name: /Semi-final 1/ }).click();
    if (sheet) await page.getByRole("radio", { name: sheet }).click();
    await page.getByLabel("Your name at the party").fill(name);
    await page.getByRole("button", { name: "Start the party" }).click();
    await expect(page).toHaveURL(/#\/party\/[A-Z]{4}$/);
    return page.url().split("/").pop()!;
};

/** Join a party by its link, as `name`. */
export const joinParty = async (page: Page, code: string, name: string) => {
    await page.goto(`/#/party/${code}`);
    await page.getByLabel("Your name at the party").fill(name);
    await page.getByRole("button", { name: "Join the party" }).click();
    await expect(page.getByText(`Party ${code} · you're ${name}`)).toBeVisible();
};

/**
 * Rate the first acts in order, one value per act, in every category of
 * the sheet. Whether it reached Firestore is checked on another phone:
 * the "saved" note already shows before the first save starts.
 */
export const rateActs = async (page: Page, values: readonly number[]) => {
    for (const [index, value] of values.entries()) {
        for (const picker of await page.getByRole("spinbutton").all()) {
            // Home is the lowest value, then up to the wanted one (or the most this category allows).
            const max = Number(await picker.getAttribute("aria-valuemax"));
            await picker.focus();
            await picker.press("Home");
            for (let step = 1; step < Math.min(value, max); step++) await picker.press("ArrowUp");
        }
        await expect(page.getByText(/^Your score for /)).toBeVisible();
        if (index < values.length - 1) await page.getByRole("button", { name: "Next act" }).click();
    }
};
