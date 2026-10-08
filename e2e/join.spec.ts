import { expect, test } from "@playwright/test";
import { hostParty } from "./helpers";

/*
 * Home's two ways in, end to end: one code field opens whatever the host
 * runs. A scoreboard party's code goes to the party, a quiz room's code
 * joins the room, each as soon as the fourth letter is typed.
 */

test("Join a party opens a scoreboard party from its code", async ({ browser }) => {
    const [host, guest] = await Promise.all([0, 1].map(async () => (await browser.newContext()).newPage()));
    const code = await hostParty(host, "Loreen");

    await guest.goto("/");
    await guest.getByRole("button", { name: "Join a party" }).click();
    await guest.getByLabel("Party code").pressSequentially(code.toLowerCase());
    await expect(guest).toHaveURL(new RegExp(`#/party/${code}$`));
    await expect(guest.getByLabel("Your name at the party")).toBeVisible();
});

test("Join a party joins a quiz room from its code", async ({ browser }) => {
    const [host, guest] = await Promise.all([0, 1].map(async () => (await browser.newContext()).newPage()));
    await host.goto("/");
    await host.getByRole("button", { name: "Host a party" }).click();
    await host.getByRole("button", { name: /^Host a quiz/ }).click();
    await host.getByRole("button", { name: /^Host and play/ }).click();
    await expect(host).toHaveURL(/#\/lobby$/);
    const code = await host.evaluate(() => localStorage.getItem("gameCode"));

    await guest.goto("/#/join");
    await guest.getByLabel("Party code").pressSequentially(code!);
    await expect(guest).toHaveURL(/#\/lobby$/);
    await expect(guest.getByRole("button", { name: "I'm ready" })).toBeVisible();
});
