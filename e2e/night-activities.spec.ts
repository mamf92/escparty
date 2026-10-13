import { expect, test, type Page } from "@playwright/test";
import { answerOptions, buildQuickQuiz, hostNight, joinNightAs, rateActs } from "./helpers";

/*
 * Activities in a party night end to end (#235, #236, #237): one code for the
 * whole evening. A host and two guests are in one night; the host starts a
 * scoreboard and both guests rate from its card without typing a code or
 * picking a name; the host starts a quiz and both guests join from its card
 * and play it to the results; the TV follows the newest activity; one guest
 * leaves (taking their ratings and name with them) and comes back with the
 * code. The quiz is a one-question one the host saves first, so it runs in a
 * single 15-second slot.
 */

const roster = (page: Page) => page.getByRole("list", { name: "Who's here" }).getByRole("listitem");
const cards = (page: Page) => page.getByRole("list", { name: "Now on" }).getByRole("listitem");

test("a host starts a scoreboard and a quiz, guests join both from their cards, one leaves and returns", async ({ browser }) => {
    test.setTimeout(480_000);
    const [host, netta, lordi] = await Promise.all(
        [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
    );
    const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

    await buildQuickQuiz(host, "Quick one");
    const code = await hostNight(host, "Loreen", "Semi night");
    await tv.goto(`/#/n/${code}/screen`);
    await expect(tv.getByText("Nothing on yet. The host will start a quiz or a scoreboard soon.")).toBeVisible();

    await netta.goto(`/#/n/${code}`);
    await joinNightAs(netta, "Netta");
    await lordi.goto(`/#/n/${code}`);
    await joinNightAs(lordi, "Lordi");
    await expect(roster(host)).toHaveCount(3);
    // Guests have no tools to start anything.
    await expect(netta.getByRole("button", { name: "Start a quiz" })).toHaveCount(0);

    // The host starts a scoreboard: no name step, the night's name is used.
    await host.getByRole("button", { name: "Start a scoreboard" }).click();
    await expect(host).toHaveURL(/#\/party\/new$/);
    await host.getByRole("radio", { name: /Semi-final 1/ }).click();
    await host.getByRole("radio", { name: /Jury/ }).click();
    await host.getByRole("button", { name: "Continue" }).click();
    await expect(host.getByText("Step 4 of 4")).toBeVisible();
    await expect(host.getByRole("list", { name: "Your party" })).toContainText("Loreen");
    await host.getByRole("button", { name: "Start the party" }).click();
    await expect(host).toHaveURL(/#\/party\/[A-Z]{4}$/);
    const party = host.url().split("/").pop()!;
    await expect(host.getByText(`Party ${party} · you're Loreen`)).toBeVisible();

    // The card shows up on both guests' phones; "Rate" opens the party as them.
    for (const [guest, name] of [[netta, "Netta"], [lordi, "Lordi"]] as const) {
        const card = cards(guest).filter({ hasText: "Scoreboard" });
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "Rate" }).click();
        await expect(guest).toHaveURL(new RegExp(`#/party/${party}$`));
        await expect(guest.getByText(`Party ${party} · you're ${name}`)).toBeVisible();
        await expect(guest.getByRole("spinbutton", { name: "Your name" })).toHaveCount(0);
    }
    await rateActs(netta, [12, 8]);
    await rateActs(lordi, [4, 10]);

    // Every ballot reached Firestore: three guests, two acts rated twice, seen from the host's phone.
    await host.getByRole("tab", { name: "Room" }).click();
    await expect(host.getByText("3 guests at the party.")).toBeVisible();
    await expect(host.getByRole("list", { name: "The room's standings" }).getByRole("listitem").filter({ hasText: "2 ratings" })).toHaveCount(2);

    // The TV shows the scoreboard's standings under the QR code.
    await expect(tv.getByRole("heading", { level: 3, name: "The room's standings" })).toBeVisible();
    await expect(tv.getByRole("list", { name: "The room's standings" }).getByRole("listitem").first()).toBeVisible();

    // Back to the night, from the party room's own link.
    for (const page of [host, netta, lordi]) {
        await page.getByRole("button", { name: "Back to the party night" }).click();
        await expect(page).toHaveURL(new RegExp(`#/n/${code}$`));
    }

    // The host starts a quiz in the night, as themselves.
    await host.getByRole("button", { name: "Start a quiz" }).click();
    await host.getByRole("button", { name: /^Host and play/ }).click();
    await expect(host.getByRole("heading", { name: "The green room" })).toBeVisible();
    await expect(host.getByText("You are Loreen")).toBeVisible();
    await host.getByRole("radio", { name: /Quick one/ }).click();

    // The newest card is the quiz; both guests join it from there, as themselves.
    for (const [guest, name] of [[netta, "Netta"], [lordi, "Lordi"]] as const) {
        await expect(cards(guest).first()).toContainText("Quiz");
        await cards(guest).first().getByRole("button", { name: "Join the quiz" }).click();
        await expect(guest.getByRole("heading", { name: "The green room" })).toBeVisible();
        await expect(guest.getByText(`You are ${name}`)).toBeVisible();
        await guest.getByRole("button", { name: "I'm ready" }).click();
    }
    // The TV names who is waiting.
    await expect(tv.getByRole("list", { name: "Waiting for players" }).getByRole("listitem")).toHaveText(["Loreen", "Netta", "Lordi"]);

    await host.getByRole("button", { name: "Start the show" }).click();
    for (const page of [host, netta, lordi]) {
        await expect(page.getByRole("timer")).toBeVisible({ timeout: 30_000 });
        await answerOptions(page).first().click();
    }
    for (const page of [host, netta, lordi]) {
        await expect(page.getByRole("heading", { name: "The results are in" })).toBeVisible({ timeout: 60_000 });
    }

    // The host reveals the standings once the late answers' grace is over.
    await expect(host.getByRole("button", { name: "Start the reveal" })).toBeEnabled({ timeout: 45_000 });
    await host.getByRole("button", { name: "Show everything" }).click();
    for (const page of [host, netta, lordi]) {
        await expect(page.getByRole("list", { name: "Final standings" }).getByRole("listitem")).toHaveCount(3);
        // No next round in a night: the way back to it instead.
        await expect(page.getByRole("button", { name: "Play again with everyone" })).toHaveCount(0);
    }
    await expect(tv.getByRole("heading", { level: 3, name: "Final standings" })).toBeVisible();

    for (const page of [host, netta, lordi]) {
        await page.getByRole("button", { name: "Back to the party night" }).click();
        await expect(page).toHaveURL(new RegExp(`#/n/${code}$`));
        await expect(cards(page)).toHaveCount(2);
        await expect(cards(page).first()).toContainText("Finished");
    }
    // The results can be seen again from the card.
    await cards(netta).first().getByRole("button", { name: "See the results" }).click();
    await expect(netta.getByRole("list", { name: "Final standings" }).getByRole("listitem")).toHaveCount(3);
    await netta.getByRole("button", { name: "Back to the party night" }).click();

    // Lordi leaves: name freed, ratings gone from the party, and the night shows two.
    await lordi.getByRole("button", { name: "Leave the party" }).click();
    await lordi.getByRole("button", { name: "Leave the party" }).click();
    await expect(lordi).toHaveURL(/#\/$/);
    await expect(roster(host)).toHaveCount(2);
    await host.goto(`/#/party/${party}`);
    await host.getByRole("tab", { name: "Room" }).click();
    await expect(host.getByText("2 guests at the party.")).toBeVisible();

    // He comes back with the code, as the same legend, and finds both cards.
    await lordi.getByRole("button", { name: "Join a party" }).click();
    await lordi.getByLabel("Party code").pressSequentially(code);
    await expect(lordi).toHaveURL(new RegExp(`#/n/${code}$`));
    await joinNightAs(lordi, "Lordi");
    await expect(cards(lordi)).toHaveCount(2);
    await expect(roster(netta)).toHaveCount(3);

    await Promise.all([host, netta, lordi, tv].map(page => page.context().close()));
});

test("the host ends a night, and starts another with a new code", async ({ browser }) => {
    const [host, netta] = await Promise.all(
        [0, 1].map(async () => (await browser.newContext()).newPage()),
    );
    const code = await hostNight(host, "Loreen", "Semi night");
    await netta.goto(`/#/n/${code}`);
    await joinNightAs(netta, "Netta");

    // Start over: the guests are told where the party went, and join it again.
    await host.getByRole("button", { name: "Start over with a new code" }).click();
    await host.getByRole("button", { name: "Start over" }).click();
    // Still the old address until the new night has been made and moved to.
    await expect(host).toHaveURL(new RegExp(`#/n/(?!${code}$)[A-Z]{4}$`));
    const fresh = host.url().split("/").pop()!;
    await expect(host.getByRole("heading", { level: 1, name: "Semi night" })).toBeVisible();
    await expect(host.getByRole("button", { name: "Start a quiz" })).toBeVisible();
    await expect(netta.getByText(`The party moved to ${fresh}.`)).toBeVisible();
    await netta.getByRole("button", { name: `Join ${fresh}` }).click();
    await joinNightAs(netta, "Netta");
    await expect(roster(host)).toHaveCount(2);

    // End it: the guest sees that it is over, and nobody can add to it.
    await host.getByRole("button", { name: "End the party night" }).click();
    await host.getByRole("button", { name: "End the party night" }).click();
    await expect(netta.getByText("This party night is over.")).toBeVisible();
    await expect(host.getByText("This party night is over.")).toBeVisible();
    await expect(host.getByRole("button", { name: "Start a quiz" })).toHaveCount(0);

    await Promise.all([host, netta].map(page => page.context().close()));
});
