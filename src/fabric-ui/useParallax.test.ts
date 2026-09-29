import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useParallax } from "./useParallax";

const pointer = (x: number, y: number) => {
  const event = new Event("pointermove") as PointerEvent;
  Object.assign(event, { clientX: x, clientY: y });
  window.dispatchEvent(event);
};

describe("useParallax", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the pointer while enabled, clamped to the strength", () => {
    const { result } = renderHook(() => useParallax(true, 10));
    act(() => pointer(window.innerWidth, 0));
    expect(result.current.offset.current).toEqual({ yaw: 10, tilt: 10 });
    act(() => pointer(window.innerWidth / 2, window.innerHeight / 2));
    expect(result.current.offset.current.yaw).toBeCloseTo(0);
    expect(result.current.needsPermission).toBe(false);
  });

  it("rests and ignores the pointer when disabled", () => {
    const { result, rerender } = renderHook(({ on }) => useParallax(on, 10), { initialProps: { on: true } });
    act(() => pointer(0, 0));
    rerender({ on: false });
    expect(result.current.offset.current).toEqual({ tilt: 0, yaw: 0 });
    act(() => pointer(window.innerWidth, 0));
    expect(result.current.offset.current).toEqual({ tilt: 0, yaw: 0 });
  });

  it("follows the device's tilt where it can", () => {
    class FakeOrientation extends Event {}
    vi.stubGlobal("DeviceOrientationEvent", FakeOrientation);
    const { result } = renderHook(() => useParallax(true, 20));
    act(() => {
      const event = new Event("deviceorientation");
      Object.assign(event, { gamma: 15, beta: 75 });
      window.dispatchEvent(event);
    });
    expect(result.current.offset.current).toEqual({ yaw: 10, tilt: 20 });
    act(() => {
      const event = new Event("deviceorientation");
      Object.assign(event, { gamma: null, beta: null });
      window.dispatchEvent(event);
    });
    expect(result.current.offset.current).toEqual({ yaw: 10, tilt: 20 });
  });

  it("asks iOS for motion access, and uses it once granted", async () => {
    const requestPermission = vi.fn().mockResolvedValueOnce("denied").mockRejectedValueOnce(new Error("no gesture")).mockResolvedValueOnce("granted");
    vi.stubGlobal("DeviceOrientationEvent", Object.assign(class extends Event {}, { requestPermission }));
    const { result } = renderHook(() => useParallax(true, 20));
    expect(result.current.needsPermission).toBe(true);
    await act(() => result.current.requestMotion());
    expect(result.current.needsPermission).toBe(true);
    await act(() => result.current.requestMotion());
    expect(result.current.needsPermission).toBe(true);
    await act(() => result.current.requestMotion());
    expect(result.current.needsPermission).toBe(false);
  });

  it("does nothing to ask for where no permission is needed", async () => {
    const { result } = renderHook(() => useParallax(true, 20));
    await act(() => result.current.requestMotion());
    expect(result.current.needsPermission).toBe(false);
  });
});
