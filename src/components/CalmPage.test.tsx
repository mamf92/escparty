import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/test-utils";
import { CalmLink, CalmNote, CalmPage } from "./CalmPage";

describe("CalmPage", () => {
  it("renders the title, subtitle, content and footer, with the content on the Calm page", () => {
    renderWithProviders(
      <CalmPage title="Quiz library" subtitle="Pick one" footer={<span>footer</span>}>
        <div className="calm-ground"><div className="lycra-pane"><button className="lycra">Play</button></div></div>
      </CalmPage>,
    );

    expect(screen.getByRole("heading", { name: "Quiz library" })).toBeInTheDocument();
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" }).closest(".calm-page")).not.toBeNull();
  });

  it("leaves out the subtitle and footer when there are none", () => {
    const { container } = renderWithProviders(<CalmPage title="Bare">content</CalmPage>);
    expect(container.querySelector("footer")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("CalmLink is a button and CalmNote a paragraph", async () => {
    const onClick = vi.fn();
    renderWithProviders(<><CalmLink onClick={onClick}>Back</CalmLink><CalmNote>Saved</CalmNote></>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Back" }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText("Saved").tagName).toBe("P");
  });
});
