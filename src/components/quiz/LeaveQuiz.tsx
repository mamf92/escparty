import { useEffect, useRef, useState } from "react";
import { Control, Ground, Pane } from "../../design";
import { CalmLink, CalmNote } from "../CalmPage";

/**
 * The way out of a quiz in progress, which asks first
 * (docs/design/design-system.md, "Navigation"): a quiet link, then a note
 * saying what leaving means and a choice between staying and going.
 */
export const LeaveQuiz = ({ multiplayer, onLeave }: { multiplayer: boolean; onLeave: () => void }) => {
  const [asking, setAsking] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  // Focus follows the question: onto "Keep playing" when it opens, back to
  // the link when it closes.
  useEffect(() => {
    if (asking) stayRef.current?.focus();
    else if (wasAsking.current) linkRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return <CalmLink ref={linkRef} onClick={() => setAsking(true)}>Leave the quiz</CalmLink>;
  }
  return (
    <div className="quiz-leave">
      <CalmNote role="alert">
        {multiplayer
          ? "Leave the quiz? The game carries on without you."
          : "Leave the quiz? This run won't be saved."}
      </CalmNote>
      <Ground>
        <Pane layout="split">
          <Control ref={stayRef} onClick={() => setAsking(false)}>Keep playing</Control>
          <Control onClick={onLeave}>Leave the quiz</Control>
        </Pane>
      </Ground>
    </div>
  );
};
