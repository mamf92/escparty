import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toDataURL } from "qrcode";
import { Badge, Control, Ground, Pane } from "../design";
import { joinLink } from "../utils/joinCode";

/** The page content the app frame makes inert while the dialog is up (MobileFrame.tsx). */
const CONTENT = ".esc-content";

/**
 * The join QR code across the whole phone screen, so it can be scanned
 * from another phone held up beside it. A modal dialog over `.esc-app`
 * (or the window where there is none): the page beneath is inert, focus
 * lands on Close, Escape closes it, and whoever opened it gets focus back.
 */
export const QrFullScreen = ({ code, onClose }: { code: string; onClose: () => void }) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [screen] = useState<Element>(() => document.querySelector(".esc-app") ?? document.body);

  useLayoutEffect(() => {
    const content = document.querySelector(".esc-app")?.querySelector(CONTENT);
    content?.setAttribute("inert", "");
    return () => content?.removeAttribute("inert");
  }, []);

  useEffect(() => {
    // Drawn large and scaled down by CSS, so it stays sharp at any width.
    let current = true;
    toDataURL(joinLink(code), { margin: 1, width: 600 })
      .then(url => { if (current) setQr(url); })
      .catch(err => console.error("Couldn't draw the QR code:", err));
    return () => { current = false; };
  }, [code]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className={`esc-qr${screen === document.body ? " is-window" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <h2 className="esc-qr-title" id={titleId}>Scan to join</h2>
      <Pane className="is-card esc-qr-card">
        {qr
          ? <img className="esc-qr-image" src={qr} alt={`QR code to join game ${code}`} />
          : <div className="esc-qr-image" role="status" aria-label="Drawing the QR code" />}
      </Pane>
      <Badge label="Game code" value={code} spell selectable />
      <Ground className="esc-qr-actions">
        <Pane>
          <Control ref={closeRef} onClick={onClose}>Close</Control>
        </Pane>
      </Ground>
    </div>,
    screen,
  );
};

export default QrFullScreen;
