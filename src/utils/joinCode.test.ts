import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanCode, codeFromScan, findGame, joinLink, nightLink } from "./joinCode";
import { getRoom, type Room } from "./roomsFirestore";
import { partyExists } from "./partyFirestore";
import { nightExists } from "./nightsFirestore";

vi.mock("./roomsFirestore", () => ({ getRoom: vi.fn() }));
vi.mock("./partyFirestore", () => ({ partyExists: vi.fn() }));
vi.mock("./nightsFirestore", () => ({ nightExists: vi.fn() }));

const room = (phase: Room["phase"]) => ({ id: "ABBA", phase, players: [{ id: "p-me", name: "Lordi", score: 0 }] } as Room);
const playIn = (code: string) => {
  localStorage.setItem("gameCode", code);
  localStorage.setItem("playerId", "p-me");
};

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
    ["https://escparty-murex.vercel.app/#/n/Dana", "DANA"],
    ["https://escparty-murex.vercel.app/#/n/lena/screen", "LENA"],
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
    vi.mocked(nightExists).mockResolvedValue(false);
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

  it("finds a party night", async () => {
    vi.mocked(getRoom).mockResolvedValue(null);
    vi.mocked(partyExists).mockResolvedValue(false);
    vi.mocked(nightExists).mockResolvedValue(true);
    expect(await findGame("ABBA")).toBe("night");
  });

  it("prefers a night to a party or a running quiz room, but not to a lobby or this device's room", async () => {
    vi.mocked(nightExists).mockResolvedValue(true);
    vi.mocked(partyExists).mockResolvedValue(true);
    vi.mocked(getRoom).mockResolvedValue(room("question"));
    expect(await findGame("ABBA")).toBe("night");
    vi.mocked(getRoom).mockResolvedValue(room("lobby"));
    expect(await findGame("ABBA")).toBe("quiz");
    vi.mocked(getRoom).mockResolvedValue(room("question"));
    playIn("ABBA");
    expect(await findGame("ABBA")).toBe("quiz");
  });

  it("doesn't take a reused code's room for this device's, when its player isn't in it (#248)", async () => {
    vi.mocked(nightExists).mockResolvedValue(true);
    vi.mocked(getRoom).mockResolvedValue({ ...room("question"), players: [{ id: "someone-else", name: "Nemo", score: 0 }] });
    playIn("ABBA");
    expect(await findGame("ABBA")).toBe("night");
  });

  it("keeps a running quiz room that nothing else shares", async () => {
    vi.mocked(getRoom).mockResolvedValue(room("question"));
    vi.mocked(partyExists).mockResolvedValue(false);
    expect(await findGame("ABBA")).toBe("quiz");
  });

  it("prefers a room still taking players when both share the code", async () => {
    vi.mocked(partyExists).mockResolvedValue(true);
    vi.mocked(getRoom).mockResolvedValue(room("lobby"));
    expect(await findGame("ABBA")).toBe("quiz");
    vi.mocked(getRoom).mockResolvedValue(room("question"));
    expect(await findGame("ABBA")).toBe("party");
    playIn("ABBA");
    expect(await findGame("ABBA")).toBe("quiz");
  });
});

describe("nightLink", () => {
  it("is this site's hash route for the night, and scans back to it", () => {
    const link = nightLink("ABBA");
    expect(link).toBe(`${window.location.origin}${window.location.pathname}#/n/ABBA`);
    expect(codeFromScan(link)).toBe("ABBA");
  });
});

describe("joinLink", () => {
  it("is this site's hash route for the code, and scans back to it", () => {
    const link = joinLink("ABBA");
    expect(link).toBe(`${window.location.origin}${window.location.pathname}#/join/ABBA`);
    expect(codeFromScan(link)).toBe("ABBA");
  });
});
