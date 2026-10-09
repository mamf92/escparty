import { expect, test } from "@playwright/test";
import { hostParty, joinParty, rateActs } from "./helpers";

/*
 * A small scoreboard party end to end (#91): a host and two guests rate the
 * first four acts of a semi-final, the host ticks a real qualifier and opens
 * the awards, and the guests see them. The host and the first guest rate
 * alike and the second guest the other way round, so the Jedward Twins
 * award has a known answer.
 */

test("a host and two guests rate a semi and get their awards", async ({ browser }) => {
    const [host, john, lordi] = await Promise.all(
        [0, 1, 2].map(async () => (await browser.newContext()).newPage()),
    );

    const code = await hostParty(host, "Loreen", /Douze Points/);

    await joinParty(john, code, "John");
    await joinParty(lordi, code, "Lordi");

    await rateActs(host, [12, 8, 4, 1]);
    await rateActs(john, [12, 8, 4, 1]);
    await rateActs(lordi, [1, 4, 8, 12]);

    // Every rating reached Firestore: all four acts have three on another phone.
    await john.getByRole("tab", { name: "Room" }).click();
    await expect(john.getByText("3 guests are rating.")).toBeVisible();
    const standings = john.getByRole("list", { name: "The room's standings" }).getByRole("listitem");
    await expect(standings).toHaveCount(4);
    await expect(standings.filter({ hasText: "3 ratings" })).toHaveCount(4);

    // The host ticks the first act through and opens the awards.
    await host.getByRole("tab", { name: "Host" }).click();
    await host.getByLabel("Who goes through").getByRole("button").first().click();
    await expect(host.getByText(/Tick who goes through \(1 of 10\)/)).toBeVisible();
    await host.getByRole("button", { name: "Open the awards for everyone" }).click();
    await expect(host.getByRole("button", { name: "Hide the awards again" })).toBeVisible();

    await john.getByRole("button", { name: "See the awards" }).click();
    await expect(john.getByText("The Jedward Twins")).toBeVisible();
    await expect(john.getByText(/^(Loreen & John|John & Loreen) \(that's you!\)$/)).toBeVisible();

    // The last page is the closeness table: everyone called the qualifier.
    // The last award's Next is named for the table it goes to.
    const next = lordi.getByRole("button", { name: /^(Next award|Closest to the result)$/ });
    await lordi.getByRole("button", { name: "See the awards" }).click();
    await expect(lordi.getByText("The Jedward Twins")).toBeVisible();
    while (await next.isEnabled()) await next.click();
    await expect(lordi.getByRole("list", { name: "Closest to the real result" }).getByRole("listitem")).toHaveCount(3);

    await Promise.all([host, john, lordi].map(page => page.context().close()));
});

test("the stepper rates by tapping minus and plus and by dragging the value", async ({ browser }) => {
    // 320px is the narrowest phone the sheet has to fit.
    const page = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
    await hostParty(page, "Loreen");

    const picker = page.getByRole("spinbutton").first();
    const label = (await picker.getAttribute("aria-label"))!;
    const raise = page.getByRole("button", { name: `Raise ${label}` });
    const lower = page.getByRole("button", { name: `Lower ${label}` });

    await expect(picker).toHaveAttribute("aria-valuetext", "Not rated");
    await expect(lower).toBeDisabled();
    await raise.click();
    await expect(picker).toHaveAttribute("aria-valuenow", "1");
    await raise.click();
    await expect(picker).toHaveAttribute("aria-valuenow", "2");
    await lower.click();
    await expect(picker).toHaveAttribute("aria-valuenow", "1");
    // Focus stays on the value, even as the minus disables itself at the lowest.
    await expect(picker).toBeFocused();
    await expect(lower).toBeDisabled();

    // A drag of two steps (24px each) to the right.
    const box = (await picker.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 24, y, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2 + 48, y, { steps: 4 });
    await page.mouse.up();
    await expect(picker).toHaveAttribute("aria-valuenow", "3");

    // The sheet fits the phone: nothing scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // No axe in this suite (@axe-core/playwright is not a dependency), so no automated a11y scan here.
});
