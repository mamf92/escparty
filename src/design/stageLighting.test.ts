import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIGHTING_STORAGE_KEY, isStageLighting, readStageLighting } from "./stageLighting";

const visit = (search: string) => window.history.replaceState(null, "", `/${search}#/`);

describe("stage lighting", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => visit(""));

  it("is front by default", () => {
    visit("");
    expect(readStageLighting()).toBe("front");
  });

  it("reads ?lights= and remembers it", () => {
    visit("?lights=back");
    expect(readStageLighting()).toBe("back");
    expect(window.localStorage.getItem(LIGHTING_STORAGE_KEY)).toBe("back");
    visit("");
    expect(readStageLighting()).toBe("back");
    visit("?lights=both");
    expect(readStageLighting()).toBe("both");
  });

  it("falls back to front for a value it does not know", () => {
    window.localStorage.setItem(LIGHTING_STORAGE_KEY, "back");
    visit("?lights=disco");
    expect(readStageLighting()).toBe("front");
  });

  it("ignores a bad stored value", () => {
    window.localStorage.setItem(LIGHTING_STORAGE_KEY, "sideways");
    visit("");
    expect(readStageLighting()).toBe("front");
  });

  it("names the three modes", () => {
    expect(["front", "back", "both"].every(isStageLighting)).toBe(true);
    expect(isStageLighting("rear")).toBe(false);
  });
});
