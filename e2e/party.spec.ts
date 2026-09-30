import { expect, test, type Page } from "@playwright/test";

/*
 * A small scoreboard party end to end (#91): a host and two guests rate the
 * first four acts of a semi-final, the host ticks a real qualifier and opens
 * the awards, and the guests see them. The host and the first guest rate
 * alike and the second guest the other way round, so the Jedward Twins
 * award has a known answer.
 */

const rateFirstActs = async (page: Page, points: number[]) => {
    for (const [index, value] of points.entries()) {
        await page.getByRole("radiogroup").getByRole("radio", { name: String(value), exact: true }).click();
        await expect(page.getByText(/^Your score for /)).toBeVisible();
        if (index < points.length - 1) await page.getByRole("button", { name: "Next act" }).click();
    }
    await expect(page.getByText("Your ratings are saved.")).toBeVisible();
};

const join = async (page: Page, code: string, name: string) => {
    await page.goto(`/#/party/${code}`);
    await page.getByLabel("Your name at the party").fill(name);
    await page.getByRole("button", { name: "Join the party" }).click();
    await expect(page.getByText(`Party ${code} · you're ${name}`)).toBeVisible();
};

test("a host and two guests rate a semi and get their awards", async ({ browser }) => {
    const [host, john, lordi] = await Promise.all(
        [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
    );

    await host.goto("/#/party/new");
    await host.getByRole("radio", { name: /Semi-final 1/ }).click();
    await host.getByRole("radio", { name: /Douze Points/ }).click();
    await host.getByLabel("Your name at the party").fill("Loreen");
    await host.getByRole("button", { name: "Start the party" }).click();
    await expect(host).toHaveURL(/#\/party\/[A-Z]{4}$/);
    const code = host.url().split("/").pop()!;

    await join(john, code, "John");
    await join(lordi, code, "Lordi");

    await rateFirstActs(host, [12, 8, 4, 1]);
    await rateFirstActs(john, [12, 8, 4, 1]);
    await rateFirstActs(lordi, [1, 4, 8, 12]);

    // Everyone sees the room's standings from all three ballots.
    await john.getByRole("tab", { name: "The room" }).click();
    await expect(john.getByText("3 guests are rating.")).toBeVisible();
    await expect(john.getByRole("list", { name: "The room's standings" }).getByRole("listitem")).toHaveCount(4);

    // The host ticks the first act through and opens the awards.
    await host.getByRole("tab", { name: "Host" }).click();
    await host.getByLabel("Who goes through").getByRole("button").first().click();
    await expect(host.getByText(/tick who goes through \(1 of 10\)/)).toBeVisible();
    await host.getByRole("button", { name: "Open the awards for everyone" }).click();
    await expect(host.getByRole("button", { name: "Hide the awards again" })).toBeVisible();

    await john.getByRole("button", { name: "See the awards" }).click();
    await expect(john.getByText("The Jedward Twins")).toBeVisible();
    await expect(john.getByText(/^(Loreen & John|John & Loreen) \(that's you!\)$/)).toBeVisible();

    // The last page is the closeness table: everyone called the qualifier.
    const next = lordi.getByRole("button", { name: "Next" });
    await lordi.getByRole("button", { name: "See the awards" }).click();
    await expect(lordi.getByText("The Jedward Twins")).toBeVisible();
    while (await next.isEnabled()) await next.click();
    await expect(lordi.getByRole("list", { name: "Closest to the real result" }).getByRole("listitem")).toHaveCount(3);

    await Promise.all([host, john, lordi].map(page => page.context().close()));
});
