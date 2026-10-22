import { Timestamp } from "firebase/firestore";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a document written now can be deleted by the Firestore TTL policy on
 * `expireAt`: `days` from now, on this device's clock. firestore.rules
 * accepts 1-60 days (isExpiryInWindow), so every lifetime stays inside that.
 */
export const expiryFromNow = (days: number): Timestamp => Timestamp.fromMillis(Date.now() + days * DAY_MS);
