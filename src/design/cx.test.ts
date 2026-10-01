import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins the classes that are on", () => {
    expect(cx("lycra", false, undefined, null, "is-chosen")).toBe("lycra is-chosen");
    expect(cx()).toBe("");
  });
});
