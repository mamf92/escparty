import { expect, test } from "@playwright/test";
import { answerOptions } from "./helpers";

// Single player, end to end (#55): Home, solo play, the quiz library, a whole quiz,
// the results and the scoreboard. No Firestore involved: solo scores stay on
// the device.
test("a solo quiz from the home screen to the scoreboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Play a quiz solo" }).click();
    await page.getByRole("button", { name: /^Browse the quiz library/ }).click();
    await page.getByRole("radio", { name: /Quick Fire/ }).click();
    await page.getByRole("button", { name: "Play Quick Fire solo" }).click();

    // Ten questions: tap the first option of each and move on.
    for (let question = 1; question <= 10; question++) {
        await expect(page.getByRole("timer")).toBeVisible();
        await expect(page.getByText(`Question ${question} of 10`)).toBeVisible();
        const text = await page.getByRole("heading", { level: 2 }).textContent();
        // Tapping is the answer; the verdict shows a moment, then the next question.
        await answerOptions(page).first().click();
        if (question < 10) await expect(page.getByRole("heading", { level: 2 })).not.toHaveText(text ?? "");
    }

    await expect(page.getByRole("heading", { name: "Quiz complete" })).toBeVisible();
    // Saved once (it used to be saved twice in development).
    await expect(page.getByRole("list", { name: "Your past scores" }).getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "See the scoreboard" }).click();
    await expect(page.getByText("1 run. Your best stands highest.")).toBeVisible();
});
