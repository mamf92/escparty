import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InitialEntry } from "react-router-dom";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import QuizLibrary from "./QuizLibrary";

const ShowLocation = () => {
  const location = useLocation();
  return <p>at {location.pathname} with {JSON.stringify(location.state)}</p>;
};

const renderLibrary = (entry: InitialEntry = "/quizzes") =>
  renderWithProviders(
    <Routes>
      <Route path="/quizzes" element={<QuizLibrary />} />
      <Route path="*" element={<ShowLocation />} />
    </Routes>,
    { initialEntries: [entry] },
  );

const ID = "AbCdEfGhIjKlMnOpQrSt";
const saveOne = () =>
  localStorage.setItem("escparty.myQuizzes", JSON.stringify([{ id: ID, title: "Jedward's Revenge", questionCount: 7, savedAt: 1 }]));

describe("QuizLibrary", () => {
  beforeEach(() => localStorage.clear());

  it("lists the classic sets and the premade quizzes, none picked", () => {
    renderLibrary();
    expect(screen.getByRole("radio", { name: /Classic: Easy/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Nordic Nights/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").every(radio => radio.getAttribute("aria-checked") === "false")).toBe(true);
    expect(screen.getByText("Pick a quiz above to play or host it.")).toBeInTheDocument();
  });

  it("plays the picked quiz solo", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Nordic Nights/ }));
    expect(screen.getByRole("radio", { name: /Nordic Nights/ })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Play Nordic Nights solo" }));
    expect(screen.getByText('at /quiz/t-nordic-nights with {"multiplayer":false}')).toBeInTheDocument();
  });

  it("hosts the picked quiz through the multiplayer lobby", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Classic: Hard/ }));
    await user.click(screen.getByRole("button", { name: "Host Classic: Hard for a room" }));
    expect(screen.getByText('at /multiplayer with {"quizKey":"hard"}')).toBeInTheDocument();
  });

  it("opens the builder, empty or from a premade quiz", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("button", { name: "Build your own quiz" }));
    expect(screen.getByText("at /quizzes/new with null")).toBeInTheDocument();
  });

  it("copies a premade quiz into the builder", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Nul Points/ }));
    expect(screen.queryByRole("button", { name: /Remove from this device/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make my own version" }));
    expect(screen.getByText('at /quizzes/new with {"fromKey":"t-nul-points"}')).toBeInTheDocument();
  });

  it("lists your saved quizzes first, picked when you come back from saving", () => {
    saveOne();
    renderLibrary({ pathname: "/quizzes", state: { picked: `c-${ID}` } });
    const first = screen.getAllByRole("radio")[0];
    expect(first).toHaveTextContent("Jedward's Revenge7 questionsYour quiz");
    expect(first).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/listed on this device only/)).toBeInTheDocument();
  });

  it("edits or forgets a saved quiz", async () => {
    const user = userEvent.setup();
    saveOne();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Jedward's Revenge/ }));
    expect(screen.getByRole("group", { name: "What to do with Jedward's Revenge" })).toBeInTheDocument();
    // Removing asks first, lands on the safe answer, and keeping changes nothing.
    await user.click(screen.getByRole("button", { name: "Remove from this device" }));
    expect(screen.getByRole("button", { name: "Yes, remove it" })).toHaveAccessibleDescription(/Take Jedward's Revenge off this device's list\?/);
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByRole("radio", { name: /Jedward's Revenge/ })).toBeInTheDocument();
    expect(localStorage.getItem("escparty.myQuizzes")).not.toBe("[]");

    await user.click(screen.getByRole("button", { name: "Remove from this device" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));
    expect(screen.queryByRole("radio", { name: /Jedward's Revenge/ })).not.toBeInTheDocument();
    expect(localStorage.getItem("escparty.myQuizzes")).toBe("[]");
    // Focus goes back to the list's tab stop, the first quiz.
    await vi.waitFor(() => expect(screen.getAllByRole("radio")[0]).toHaveFocus());
    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("tabindex", "0");
  });

  it("lists a just-saved quiz even when this browser couldn't store the list", async () => {
    const user = userEvent.setup();
    renderLibrary({
      pathname: "/quizzes",
      state: { picked: `c-${ID}`, saved: { id: ID, title: "Private mode quiz", questionCount: 3 } },
    });
    expect(screen.getByRole("radio", { name: /Private mode quiz/ })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Remove from this device" }));
    await user.click(screen.getByRole("button", { name: "Yes, remove it" }));
    expect(screen.queryByRole("radio", { name: /Private mode quiz/ })).not.toBeInTheDocument();
  });

  it("moves the pick with the arrow keys, one tab stop for the list", async () => {
    const user = userEvent.setup();
    renderLibrary();
    const radios = screen.getAllByRole("radio");
    expect(radios.filter(radio => radio.tabIndex === 0)).toEqual([radios[0]]);
    radios[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(radios[1]).toHaveFocus();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(radios[radios.length - 1]).toHaveFocus();
  });

  it("opens a saved quiz in the builder to edit", async () => {
    const user = userEvent.setup();
    saveOne();
    renderLibrary();
    await user.click(screen.getByRole("radio", { name: /Jedward's Revenge/ }));
    await user.click(screen.getByRole("button", { name: "Edit Jedward's Revenge" }));
    expect(screen.getByText(`at /quizzes/edit/${ID} with null`)).toBeInTheDocument();
  });
});
