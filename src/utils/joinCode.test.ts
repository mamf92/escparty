import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanCode, codeFromScan, findGame } from "./joinCode";
import { getRoom, type Room } from "./roomsFirestore";
import { partyExists } from "./partyFirestore";

vi.mock("./roomsFirestore", () => ({ getRoom: vi.fn() }));
vi.mock("./partyFirestore", () => ({ partyExists: vi.fn() }));

const room = (phase: Room["phase"]) => ({ id: "ABBA", phase } as Room);

describe("cleanCode", () => {
  it("keeps four letters, upper case", () => {
    expect(cleanCode("ab-ba!x")).toBe("ABBA");
    expect(cleanCode("1a2")).toBe("A");
  });
});

describe("codeFromScan", () => {
  it.each([
    ["https://escparty-murex.vercel.app/#/party/ABBA", "ABBA"],
    ["https://escparty-murex.vercel.app/#/party/lena/screen", "LENA"],
    ["https://escparty-murex.vercel.app/#/join/Dana", "DANA"],
    ["  abba ", "ABBA"],
  ])("reads %s as %s", (text, code) => {
    expect(codeFromScan(text)).toBe(code);
  });

  it.each(["https://example.com/", "#/party/ABBAS", "ABC", "a party"])("ignores %s", text => {
    expect(codeFromScan(text)).toBeNull();
  });
});

describe("findGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("finds a quiz room", async () => {
    vi.mocked(getRoom).mockResolvedValue(room("lobby"));
    vi.mocked(partyExists).mockResolvedValue(false);
    expect(await findGame("ABBA")).toBe("quiz");
  });

  it("finds a party", async () => {
    vi.mocked(getRoom).mockResolvedValue(null);
    vi.mocked(partyExists).mockResolvedValue(true);
    expect(await findGame("ABBA")).toBe("party");
  });

  it("finds nothing", async () => {
    vi.mocked(getRoom).mockResolvedValue(null);
    vi.mocked(partyExists).mockResolvedValue(false);
    expect(await findGame("ABBA")).toBeNull();
  });

  it("prefers a room still taking players when both share the code", async () => {
    vi.mocked(partyExists).mockResolvedValue(true);
    vi.mocked(getRoom).mockResolvedValue(room("lobby"));
    expect(await findGame("ABBA")).toBe("quiz");
    vi.mocked(getRoom).mockResolvedValue(room("question"));
    expect(await findGame("ABBA")).toBe("party");
    localStorage.setItem("gameCode", "ABBA");
    expect(await findGame("ABBA")).toBe("quiz");
  });
});
