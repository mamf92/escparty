import { useEffect, useState } from "react";
import { listenToRoom, type Room } from "../utils/roomsFirestore";

/**
 * Follow a quiz room, live (#235): a party night's cards and TV each follow
 * the rooms listed on it. Undefined while loading, null when there's no such
 * room (listenToRoom also says null for a listener that failed). Tagged with
 * the code it belongs to, so a new code reads as loading rather than showing
 * the last room.
 */
export const useRoom = (code: string | undefined): Room | null | undefined => {
    const [room, setRoom] = useState<{ code: string; value: Room | null } | null>(null);
    useEffect(() => {
        if (!code) return;
        return listenToRoom(code, next => setRoom({ code, value: next }));
    }, [code]);
    if (!code) return null;
    return room?.code === code ? room.value : undefined;
};
