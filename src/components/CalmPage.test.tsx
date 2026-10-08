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

  it("puts the actions after the content and before the footer, in the bottom-sticking area", () => {
    const { container } = renderWithProviders(
      <CalmPage title="Home" actions={<button>Host a party</button>} footer={<span>footer</span>}>
        <p>content</p>
      </CalmPage>,
    );
    const actions = container.querySelector(".calm-actions")!;
    expect(actions).toContainElement(screen.getByRole("button", { name: "Host a party" }));
    expect(getComputedStyle(actions).marginTop).toBe("auto");
    const order = [screen.getByText("content"), actions, container.querySelector("footer")!];
    order.slice(1).forEach((node, i) => {
      expect(order[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it("works with only actions, and renders no actions area without them", () => {
    const { container, rerender } = renderWithProviders(<CalmPage title="Only" actions={<b>go</b>} />);
    expect(screen.getByText("go")).toBeInTheDocument();
    rerender(<CalmPage title="Only" />);
    expect(container.querySelector(".calm-actions")).toBeNull();
  });

  it("CalmLink is a button and CalmNote a paragraph", async () => {
    const onClick = vi.fn();
    renderWithProviders(<><CalmLink onClick={onClick}>Back</CalmLink><CalmNote>Saved</CalmNote></>);
    await userEvent.setup().click(screen.getByRole("button", { name: "Back" }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText("Saved").tagName).toBe("P");
  });
});
