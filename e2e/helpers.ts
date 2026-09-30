import type { Page } from "@playwright/test";

/** The current question's answer buttons (everything but Submit and the home button). */
export const answerOptions = (page: Page) =>
    page.getByRole("heading", { level: 2 }).locator("xpath=following-sibling::div[1]").getByRole("button");
