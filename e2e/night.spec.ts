import { expect, test } from "@playwright/test";
import { hostNight, joinNightAs } from "./helpers";

/*
 * A party night end to end (#233): a host starts one, a guest joins by
 * typing its code on Join and another by opening its QR link, both show up
 * in "Who's here", and one leaves (freeing the name) and comes back with the
 * code. Activities come in a later step.
 */

test("a host starts a party night, guests join by code and by link, and one leaves and returns", async ({ browser }) => {
    const [host, netta, lordi] = await Promise.all(
        [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
    );

    const code = await hostNight(host, "Loreen", "Semi night");
    await expect(host.getByRole("heading", { level: 1, name: "Semi night" })).toBeVisible();
    await expect(host.getByText(`Party night code ${code.split("").join(" ")}`)).toBeVisible();
    await expect(host.getByText("Nothing on yet. The host will start a quiz or a scoreboard soon.")).toBeVisible();

    // A guest types the code on Join; it opens the night's home.
    await netta.goto("/#/join");
    await netta.getByLabel("Party code").pressSequentially(code.toLowerCase());
    await expect(netta).toHaveURL(new RegExp(`#/n/${code}$`));
    await joinNightAs(netta, "Netta");

    // Another opens the link the QR code carries.
    await lordi.goto(`/#/n/${code}`);
    await joinNightAs(lordi, "Lordi");

    for (const page of [host, netta, lordi]) {
        const roster = page.getByRole("list", { name: "Who's here" }).getByRole("listitem");
        await expect(roster).toHaveCount(3);
        await expect(roster.filter({ hasText: "Loreen" })).toContainText("host");
        await expect(roster.filter({ hasText: "Netta" })).toBeVisible();
        await expect(roster.filter({ hasText: "Lordi" })).toBeVisible();
    }
    await expect(netta.getByRole("list", { name: "Who's here" }).getByRole("listitem").filter({ hasText: "Netta" })).toContainText("you");

    // The TV screen counts them, with the host's link to it.
    await expect(host.getByRole("button", { name: "Open the TV screen" })).toBeVisible();
    await expect(netta.getByRole("button", { name: "Open the TV screen" })).toHaveCount(0);
    const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await tv.goto(`/#/n/${code}/screen`);
    await expect(tv.getByRole("heading", { level: 1, name: "Semi night" })).toBeVisible();
    await expect(tv.getByText("3 guests at the party.")).toBeVisible();
    await expect(tv.getByRole("img", { name: `QR code to join party night ${code}` })).toBeVisible();

    // Netta leaves: back at Home, her name is free, and the others see her go.
    await netta.getByRole("button", { name: "Leave the party" }).click();
    await netta.getByRole("button", { name: "Leave the party" }).click();
    await expect(netta).toHaveURL(/#\/$/);
    await expect(host.getByRole("list", { name: "Who's here" }).getByRole("listitem")).toHaveCount(2);
    await expect(tv.getByText("2 guests at the party.")).toBeVisible();

    // She comes back with the code, as the same legend again.
    await netta.getByRole("button", { name: "Join a party" }).click();
    await netta.getByLabel("Party code").pressSequentially(code);
    await expect(netta).toHaveURL(new RegExp(`#/n/${code}$`));
    await joinNightAs(netta, "Netta");
    await expect(host.getByRole("list", { name: "Who's here" }).getByRole("listitem")).toHaveCount(3);

    // Home offers the way back to the night to someone who is in one.
    await lordi.goto("/#/");
    await lordi.getByRole("button", { name: "Back to your party night" }).click();
    await expect(lordi).toHaveURL(new RegExp(`#/n/${code}$`));
    await expect(lordi.getByText("You're Lordi")).toBeVisible();

    await Promise.all([host, netta, lordi, tv].map(page => page.context().close()));
});
