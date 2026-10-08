import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { CalmNote } from "./CalmPage";

/** How often a frame is read for a QR code. */
const SCAN_EVERY_MS = 250;

type Detect = (video: HTMLVideoElement) => Promise<string | null>;

// The browser's own detector where there is one (Chrome on Android), else
// jsQR, loaded only when someone scans.
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorClass = new (options: { formats: string[] }) => BarcodeDetectorLike;

const makeDetector = async (): Promise<Detect> => {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (Native) {
    const detector = new Native({ formats: ["qr_code"] });
    return async video => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async video => {
    const { videoWidth: width, videoHeight: height } = video;
    if (!ctx || !width || !height) return null;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    return jsQR(ctx.getImageData(0, 0, width, height).data, width, height)?.data ?? null;
  };
};

const cameraProblem = (error: unknown): string => {
  const name = (error as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "The camera is blocked. Allow it for this site, or type the code instead.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "This device has no camera we can use. Type the code instead.";
  }
  return "We couldn't start the camera. Type the code instead.";
};

/**
 * The back camera, read for a QR code until one is found. Hands every QR
 * code it reads to `onScan`, which says whether it was one it can use (a
 * stray code keeps the camera going). Stops the camera when it unmounts.
 */
export const QrScanner = ({ onScan }: { onScan: (text: string) => boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [stray, setStray] = useState(false);
  // The latest onScan, without restarting the camera when it changes.
  const scanned = useRef(onScan);
  useEffect(() => {
    scanned.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("This browser can't use the camera here. Type the code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!live) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const detect = await makeDetector();
        const look = async () => {
          if (!live) return;
          const text = await detect(video).catch(() => null);
          if (!live) return;
          if (text !== null) {
            if (scanned.current(text)) return;
            setStray(true);
          }
          timer = setTimeout(look, SCAN_EVERY_MS);
        };
        void look();
      } catch (error) {
        if (live) setProblem(cameraProblem(error));
      }
    };
    void start();

    return () => {
      live = false;
      clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  if (problem) return <CalmNote role="alert">{problem}</CalmNote>;
  return (
    <>
      <Viewfinder ref={videoRef} muted playsInline aria-label="Camera view for the QR code" />
      <CalmNote role="status">
        {stray ? "That QR code isn't an ESCParty code. Point at the one on the host's screen." : "Point the camera at the QR code on the host's screen."}
      </CalmNote>
    </>
  );
};

// Layout only: a square window onto the camera, rounded like the card.
const Viewfinder = styled.video`
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--esc-radius-field);
`;

export default QrScanner;
