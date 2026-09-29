import { useEffect, useState } from "react";
import { fetchQuizTitle, quizTitle } from "../utils/quizCatalog";
import { isCustomQuizKey } from "../utils/customQuizzes";

/**
 * A quiz key's title. Classic and premade titles are known at once; a
 * custom quiz someone else saved is read from Firestore, showing "Custom
 * quiz" until it arrives.
 */
export const useQuizTitle = (key: string | undefined | null): string => {
    const [fetched, setFetched] = useState<{ key: string; title: string } | null>(null);

    useEffect(() => {
        if (!key || !isCustomQuizKey(key)) return;
        let current = true;
        fetchQuizTitle(key).then(title => {
            if (current) setFetched({ key, title });
        });
        return () => {
            current = false;
        };
    }, [key]);

    return fetched && fetched.key === key ? fetched.title : quizTitle(key);
};
