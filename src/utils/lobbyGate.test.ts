import { describe, expect, it } from "vitest";
import { startGate } from "./lobbyGate";

const host = { id: "host", name: "Martin", score: 0 };
const guest = (id: string, name: string) => ({ id, name, score: 0 });

describe("startGate", () => {
  it("lets a playing host start alone only on purpose", () => {
    expect(startGate({ hostId: "host", players: [host] })).toEqual({
      canStart: "anyway",
      message: "Nobody has joined yet. Share the code, or start anyway to play alone.",
    });
  });

  it("won't let an observer host start an empty room", () => {
    expect(startGate({ hostId: "host", hostIsObserver: true, players: [host] }).canStart).toBe("no");
  });

  it("names who isn't ready yet", () => {
    const room = { hostId: "host", players: [host, guest("a", "Loreen"), guest("b", "Lordi")], readyPlayers: ["host"] };
    expect(startGate(room)).toEqual({ canStart: "anyway", message: "Waiting for Loreen and Lordi to be ready." });
    expect(startGate({ ...room, readyPlayers: ["a"] }).message).toBe("Waiting for Lordi to be ready.");
    const crowd = { ...room, players: [...room.players, guest("c", "Käärijä")] };
    expect(startGate(crowd).message).toBe("Waiting for 3 guests to be ready.");
  });

  it("is ready when every guest is", () => {
    expect(startGate({ hostId: "host", players: [host, guest("a", "Loreen")], readyPlayers: ["a"] })).toEqual({
      canStart: "yes",
      message: "Your guest is ready.",
    });
    expect(startGate({ hostId: "host", players: [host, guest("a", "Loreen"), guest("b", "Lordi")], readyPlayers: ["b", "a"] }).message)
      .toBe("All 2 guests are ready.");
  });
});
