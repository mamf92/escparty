import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderWithProviders, screen } from "../test/test-utils";
import { QrScanner } from "./QrScanner";

const stop = vi.fn();
const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
let detected: string[] = [];

const setCamera = (getUserMedia: (() => Promise<MediaStream>) | undefined) => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: getUserMedia ? { getUserMedia: vi.fn(getUserMedia) } : undefined,
  });
};

describe("QrScanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stop.mockClear();
    detected = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        const next = detected.shift();
        return next === undefined ? [] : [{ rawValue: next }];
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it("reads QR codes until one is used, then stops the camera when closed", async () => {
    setCamera(async () => stream);
    detected = ["https://example.com/", "#/party/ABBA"];
    const onScan = vi.fn((text: string) => text.includes("ABBA"));
    const view = renderWithProviders(<QrScanner onScan={onScan} />);
    expect(screen.getByLabelText("Camera view for the QR code")).toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(onScan).toHaveBeenCalledWith("https://example.com/");
    expect(screen.getByRole("status")).toHaveTextContent("isn't an ESCParty code");

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(onScan).toHaveBeenLastCalledWith("#/party/ABBA");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(onScan).toHaveBeenCalledTimes(2);

    view.unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("says when the camera is blocked", async () => {
    setCamera(async () => { throw Object.assign(new Error("no"), { name: "NotAllowedError" }); });
    renderWithProviders(<QrScanner onScan={() => true} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("alert")).toHaveTextContent("The camera is blocked");
  });

  it("says when there is no camera", async () => {
    setCamera(async () => { throw Object.assign(new Error("no"), { name: "NotFoundError" }); });
    renderWithProviders(<QrScanner onScan={() => true} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("alert")).toHaveTextContent("no camera");
  });

  it("says when the browser can't use a camera at all", async () => {
    setCamera(undefined);
    renderWithProviders(<QrScanner onScan={() => true} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("alert")).toHaveTextContent("can't use the camera");
  });
});
