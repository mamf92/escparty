import { expect, type Page } from "@playwright/test";

/** The current question's answer buttons (not the way out). Tapping one is the answer. */
export const answerOptions = (page: Page) =>
    page.getByRole("group", { name: "Answers" }).getByRole("button");

/**
 * Host a scoreboard party for Semi-final 1 with the given sheet (the jury's
 * by default), switching the wind machine bonus on; returns its code. Setup is one
 * question per screen and the name is picked from the reel, so it steps the
 * reel to `name`.
 */
export const hostParty = async (page: Page, name: string, sheet: RegExp = /Jury/) => {
    // Leave /party/new first: a hash-only goto to the URL the page is already
    // on doesn't reload or remount, so a setup left on its last step would stay.
    await page.goto("/#/party");
    await page.goto("/#/party/new");
    await page.getByRole("radio", { name: /Semi-final 1/ }).click();
    await page.getByRole("radio", { name: sheet }).click();
    await page.getByRole("switch", { name: /Wind machine/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    for (let tries = 0; tries < 60; tries++) {
        await page.getByRole("button", { name: "Next name" }).click();
        if (await page.getByText(`You're ${name}.`).isVisible()) break;
    }
    await expect(page.getByText(`You're ${name}.`)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Start the party" }).click();
    await expect(page).toHaveURL(/#\/party\/[A-Z]{4}$/);
    return page.url().split("/").pop()!;
};

/**
 * Join a party by its link, as `name`: a participant name from the reel,
 * which is stepped to until it lands there (a name someone has taken is not
 * on it, so `name` must be free).
 */
export const joinParty = async (page: Page, code: string, name: string) => {
    await page.goto(`/#/party/${code}`);
    await expect(page.getByRole("spinbutton", { name: "Your name" })).toBeVisible();
    for (let tries = 0; tries < 60; tries++) {
        await page.getByRole("button", { name: "Next name" }).click();
        if (await page.getByText(`You're ${name}.`).isVisible()) break;
    }
    await expect(page.getByText(`You're ${name}.`)).toBeVisible();
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

/** Step the name reel to `name` (a free participant name), as the setup and join screens show it. */
const landOnName = async (page: Page, name: string) => {
    for (let tries = 0; tries < 60; tries++) {
        await page.getByRole("button", { name: "Next name" }).click();
        if (await page.getByText(`You're ${name}.`).isVisible()) break;
    }
    await expect(page.getByText(`You're ${name}.`)).toBeVisible();
};

/**
 * Host a party night from the Host screen, titled `title`, as `name` from
 * the reel; returns its code. The night's home is where it lands.
 */
export const hostNight = async (page: Page, name: string, title = "Party night") => {
    await page.goto("/#/host");
    await page.getByRole("button", { name: /^Host a party night/ }).click();
    await expect(page).toHaveURL(/#\/n\/new$/);
    await page.getByLabel("Name of the night").fill(title);
    await landOnName(page, name);
    await page.getByRole("button", { name: "Start the party night" }).click();
    await expect(page).toHaveURL(/#\/n\/[A-Z]{4}$/);
    await expect(page.getByText(`You're ${name}`, { exact: true })).toBeVisible();
    return page.url().split("/").pop()!;
};

/**
 * Join a party night as `name` from the reel, from wherever the page is
 * (the night's link, or the Join screen with the code typed): the join view
 * is what it finds at `/n/CODE`.
 */
export const joinNightAs = async (page: Page, name: string) => {
    await expect(page.getByRole("spinbutton", { name: "Your name" })).toBeVisible();
    await landOnName(page, name);
    await page.getByRole("button", { name: "Join the party" }).click();
    // Exact: the reel's own "You're Netta." would match before the join lands.
    await expect(page.getByText(`You're ${name}`, { exact: true })).toBeVisible();
};
