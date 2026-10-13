/**
 * Telling a rules refusal apart from other failures (#232). Without sign-in
 * a refused write is often one that already landed: a leave, a close or an
 * add retried after its answer was lost changes nothing, or deletes what is
 * gone, and the rules refuse that. These let a caller read the state again
 * and count the write as done, without ever hiding the refusal behind a
 * failed read.
 */

/** Whether a Firestore error is the rules refusing the write. */
export const isDenied = (error: unknown): boolean =>
    (error as { code?: string } | null)?.code === "permission-denied";

/**
 * After a write failed with `error`: resolve when it was refused and
 * `alreadyDone()` finds the state it would have made, otherwise reject with
 * the original error, also when `alreadyDone` itself fails.
 */
export const settleRefusal = async (error: unknown, alreadyDone: () => Promise<boolean>): Promise<void> => {
    if (isDenied(error) && await alreadyDone().catch(() => false)) return;
    throw error;
};
