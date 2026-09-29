import { useEffect, useMemo, useState } from "react";
import { fetchQuizTitle, quizTitle } from "../utils/quizCatalog";
import { customQuizId, isCustomQuizKey, knownCustomTitle } from "../utils/customQuizzes";

/**
 * A quiz key's title. Classic and premade titles are known at once, and so
 * is a custom quiz this device saved; one someone else saved is read from
 * Firestore, showing "Custom quiz" until it arrives.
 */
export const useQuizTitle = (key: string | undefined | null): string => {
    const [fetched, setFetched] = useState<{ key: string; title: string } | null>(null);
    // Worked out once per key, not on every render (the lobby re-renders on
    // every room snapshot).
    const { local, needsRead } = useMemo(() => ({
        local: quizTitle(key),
        needsRead: !!key && isCustomQuizKey(key) && knownCustomTitle(customQuizId(key)) === undefined,
    }), [key]);

    useEffect(() => {
        if (!key || !needsRead) return;
        let current = true;
        fetchQuizTitle(key).then(title => {
            if (current) setFetched({ key, title });
        });
        return () => {
            current = false;
        };
    }, [key, needsRead]);

    return fetched && fetched.key === key ? fetched.title : local;
};
