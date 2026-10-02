import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import UnderDevelopment from "./UnderDevelopment";

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/quiz" element={<UnderDevelopment />} />
      <Route path="/quizzes" element={<p>quiz library</p>} />
      <Route path="/" element={<p>home</p>} />
    </Routes>,
    { initialEntries: ["/quiz"] },
  );

describe("UnderDevelopment", () => {
  it("says the page moved and opens the quiz library", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page moved");
    expect(screen.getByText(/lives in the quiz library now/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Open the quiz library" }));
    expect(screen.getByText("quiz library")).toBeInTheDocument();
  });

  it("has a way back home", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Back to ESCParty" }));
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
