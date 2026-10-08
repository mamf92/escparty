import { useEffect, useRef, useState } from "react";
import { CalmLink } from "../CalmPage";
import { ConfirmLeave } from "../ConfirmLeave";

/**
 * The way out of a quiz in progress, which asks first
 * (docs/design/design-system.md, "Navigation"): a quiet link, then a note
 * saying what leaving means and a choice between staying and going.
 */
export const LeaveQuiz = ({ multiplayer, onLeave }: { multiplayer: boolean; onLeave: () => void }) => {
  const [asking, setAsking] = useState(false);
  const linkRef = useRef<HTMLButtonElement>(null);
  // Set when the player chose to keep playing: focus goes back to the link.
  const stayed = useRef(false);

  useEffect(() => {
    if (!asking && stayed.current) linkRef.current?.focus();
    stayed.current = false;
  }, [asking]);

  if (!asking) {
    return <CalmLink ref={linkRef} onClick={() => setAsking(true)}>Leave the quiz</CalmLink>;
  }
  return (
    <ConfirmLeave
      className="quiz-leave"
      prompt={multiplayer
        ? "Leave the quiz? The game carries on without you."
        : "Leave the quiz? This run won't be saved."}
      stayLabel="Keep playing"
      leaveLabel="Leave the quiz"
      onLeave={onLeave}
      onStay={() => { stayed.current = true; setAsking(false); }}
    />
  );
};
