import { expect, test, type Page } from "@playwright/test";
import { answerOptions } from "./helpers";

/*
 * Two players stay in lockstep (#68, #55), against the Firestore emulator.
 *
 * The regression case is #23: on a slow Android phone the guest missed the
 * host's "continue" at the mid-quiz scoreboard and was left behind, because
 * the signal was a flag set for three seconds. Since #62 and #63 every client
 * follows the room's phase and question index instead, so a slow client
 * can't miss anything. Here the guest's network is throttled, and both
 * phones must show the same question before and after the break.
 */

const question = (page: Page) => page.getByRole("heading", { level: 2 });

const answer = async (page: Page) => {
    await answerOptions(page).first().click();
    await page.getByRole("button", { name: "Lock in my answer" }).click();
};

test("host and a throttled guest see the same questions through a break", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    // The guest is on a slow phone network (#23's Android phone).
    const cdp = await guestContext.newCDPSession(guest);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 400,
        downloadThroughput: 200 * 1024,
        uploadThroughput: 100 * 1024,
    });

    // The host makes a room and picks Nul Points, with a break after question 4.
    await host.goto("/#/multiplayer");
    await host.getByRole("button", { name: /^Host a game/ }).click();
    await host.getByRole("button", { name: /^Host and play/ }).click();
    await expect(host.getByRole("heading", { name: "The green room" })).toBeVisible();
    const code = (await host.locator("strong").first().textContent())!.trim();
    expect(code).toMatch(/^[A-Z]{4}$/);
    await host.getByRole("button", { name: "Nul Points" }).click();

    // The guest joins with the code and says they're ready.
    await guest.goto("/#/multiplayer");
    await guest.getByRole("button", { name: /^Join a game/ }).click();
    await guest.getByLabel("Game code").fill(code);
    await guest.getByRole("button", { name: "Join the game" }).click();
    await expect(guest.getByRole("heading", { name: "The green room" })).toBeVisible();
    await guest.getByRole("button", { name: "I'm ready" }).click();

    await host.getByRole("button", { name: "Start the show" }).click();

    // Questions 1 to 4, the same on both phones.
    for (let index = 0; index < 4; index++) {
        await expect(question(guest)).toHaveText((await question(host).textContent())!);
        const shown = await question(host).textContent();
        await Promise.all([answer(host), answer(guest)]);
        if (index < 3) {
            await expect(question(host)).not.toHaveText(shown!, { timeout: 30_000 });
        }
    }

    // Both reach the break; only the host can continue.
    await expect(host.getByRole("heading", { name: "Scoreboard break" })).toBeVisible({ timeout: 30_000 });
    await expect(guest.getByRole("heading", { name: "Scoreboard break" })).toBeVisible({ timeout: 30_000 });
    await expect(guest.getByText("Waiting for the host to continue…")).toBeVisible();
    await host.getByRole("button", { name: "Continue the quiz" }).click();

    // Both come back on question 5, and move on to question 6 together. (Wait
    // until the break is gone, so the question read is the quiz's.)
    await expect(host.getByRole("heading", { name: "Scoreboard break" })).toBeHidden({ timeout: 30_000 });
    await expect(host.getByRole("button", { name: "Lock in my answer" })).toBeVisible();
    await expect(question(guest)).toHaveText((await question(host).textContent())!);
    const fifth = await question(host).textContent();
    await Promise.all([answer(host), answer(guest)]);
    await expect(question(host)).not.toHaveText(fifth!, { timeout: 30_000 });
    await expect(question(guest)).toHaveText((await question(host).textContent())!);

    await hostContext.close();
    await guestContext.close();
});
