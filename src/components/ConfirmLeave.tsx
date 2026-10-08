import { useEffect, useId, useRef } from "react";
import { Control, Ground, Pane } from "../design";
import { CalmNote } from "./CalmPage";

/**
 * The "are you sure?" before leaving something in progress
 * (docs/design/design-system.md, "Navigation"): a note saying what leaving
 * means and a choice between staying and going. Focus lands on the stay
 * button when it opens, and the question is that button's description, so
 * it's read once with the focus rather than as an alert over it. Whoever
 * closes it on "stay" puts focus back where the question came from.
 */
export const ConfirmLeave = ({ prompt, stayLabel, leaveLabel, onLeave, onStay, className }: {
  prompt: string;
  stayLabel: string;
  leaveLabel: string;
  onLeave: () => void;
  onStay: () => void;
  className?: string;
}) => {
  const stayRef = useRef<HTMLButtonElement>(null);
  const promptId = useId();
  useEffect(() => stayRef.current?.focus(), []);
  return (
    <div className={className}>
      <CalmNote id={promptId}>{prompt}</CalmNote>
      <Ground>
        <Pane layout="split">
          <Control ref={stayRef} aria-describedby={promptId} onClick={onStay}>{stayLabel}</Control>
          <Control onClick={onLeave}>{leaveLabel}</Control>
        </Pane>
      </Ground>
    </div>
  );
};
