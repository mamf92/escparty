import type { Night } from "../utils/nightsFirestore";

/** An open party night with no activities yet, for the night tests. */
export const makeNight = (change: Partial<Night> = {}): Night => ({
    code: "ABBA",
    hostId: "host-1",
    title: "Party night",
    activities: [],
    closed: false,
    ...change,
});
