import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QrFullScreen } from "./QrFullScreen";

const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock("qrcode", () => ({ toDataURL: qr.toDataURL }));

describe("QrFullScreen", () => {
  it("is a labelled modal dialog with the code, focus on Close", async () => {
    qr.toDataURL.mockResolvedValue("data:image/png;base64,AAAA");
    render(<QrFullScreen code="ABBA" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Scan to join" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Game code A B B A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(await screen.findByRole("img", { name: /ABBA/ })).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(qr.toDataURL).toHaveBeenCalledWith(expect.stringMatching(/#\/join\/ABBA$/), expect.objectContaining({ width: 600 }));
  });

  it("closes on the button and on Escape", async () => {
    qr.toDataURL.mockResolvedValue("data:image/png;base64,AAAA");
    const onClose = vi.fn();
    render(<QrFullScreen code="ABBA" onClose={onClose} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.setup().keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("makes the page content inert while open and restores it", async () => {
    qr.toDataURL.mockResolvedValue("x");
    document.body.innerHTML = '<div class="esc-app"><div class="esc-content"></div></div>';
    const { unmount } = render(<QrFullScreen code="ABBA" onClose={() => {}} />);
    const content = document.querySelector(".esc-content")!;
    expect(content).toHaveAttribute("inert");
    unmount();
    expect(content).not.toHaveAttribute("inert");
  });

  it("copes with a failed drawing", async () => {
    qr.toDataURL.mockRejectedValue(new Error("no"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<QrFullScreen code="ABBA" onClose={() => {}} />);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.queryByRole("img")).toBeNull();
  });
});
