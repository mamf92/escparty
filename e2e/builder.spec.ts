import { expect, test } from "@playwright/test";
import { answerOptions } from "./helpers";

/*
 * The quiz creator end to end (#78): build a quiz from three bank questions
 * and one of your own with a scoreboard break after question 3, save it to
 * the emulator's `quizzes/`, then host a room with it and play it through
 * alone, break included.
 */
test("build a quiz, save it, host it and play it through", async ({ page }) => {
    await page.goto("/#/quizzes/new");
    await page.getByLabel("Name").fill("Jedward's Revenge");
    await page.getByLabel("Scoreboard break").selectOption("3");

    await page.getByRole("button", { name: "Add from the bank" }).click();
    const bank = page.getByRole("group", { name: "Bank questions" });
    for (let index = 0; index < 3; index++) await bank.getByRole("button").nth(index).click();
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByRole("button", { name: "Write a question" }).click();
    await page.getByLabel("Question", { exact: true }).fill("Who sang 'Lipstick' for Ireland in 2011?");
    await page.getByLabel("Answer 1").fill("Bros");
    await page.getByLabel("Answer 2").fill("Jedward");
    await page.getByRole("radio", { name: "Jedward" }).click();
    await page.getByRole("button", { name: "Add to the quiz" }).click();
    await expect(page.getByRole("radiogroup", { name: "Questions in this quiz" }).getByRole("radio")).toHaveCount(4);

    await page.getByRole("button", { name: "Save quiz" }).click();
    await expect(page).toHaveURL(/#\/quizzes$/);

    // Host it: the saved quiz is offered in the green room.
    await page.goto("/#/multiplayer");
    await page.getByText("Create game").click();
    await page.getByText("Host & Play").click();
    await expect(page.getByRole("heading", { name: "The green room" })).toBeVisible();
    await page.getByRole("button", { name: "Jedward's Revenge" }).click();
    await expect(page.getByText("Quiz: Jedward's Revenge")).toBeVisible();
    await page.getByRole("button", { name: "Start anyway" }).click();

    const answer = async (pick?: string) => {
        const submit = page.getByRole("button", { name: "Submit Answer" });
        await expect(submit).toBeVisible({ timeout: 30_000 });
        if (pick) await answerOptions(page).getByText(pick, { exact: true }).click();
        else await answerOptions(page).first().click();
        await submit.click();
    };

    for (let question = 1; question <= 3; question++) await answer();
    await expect(page.getByRole("heading", { name: "Scoreboard break" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Continue the quiz" }).click();

    // The last question is the one written here.
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Who sang 'Lipstick' for Ireland in 2011?", { timeout: 30_000 });
    await answer("Jedward");
    await expect(page.getByRole("heading", { name: "The results are in" })).toBeVisible({ timeout: 60_000 });
});
