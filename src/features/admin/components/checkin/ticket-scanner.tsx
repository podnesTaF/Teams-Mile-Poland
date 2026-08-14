"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";

/**
 * The volunteer's in-app QR scanner: camera → jsQR → the scanned ticket page,
 * where the admin check-in panel (check in, bib) is waiting.
 *
 * jsQR rather than `BarcodeDetector` because volunteers bring their own phones
 * and the native detector still isn't everywhere; one code path beats two.
 * Decoding happens ~4×/second off a hidden canvas — plenty for a code held up
 * to a phone, cheap enough to leave running.
 *
 * The signature is not (and cannot be) verified here — the secret is
 * server-side. The ticket page and the check-in actions verify it; this
 * component only refuses QR codes that don't even look like our ticket URLs.
 */

/** Extract { registrationId, sig } from a ticket URL — the desk's parse, client-side. */
function parseScannedTicket(value: string): { registrationId: string; sig: string } | null {
  const idMatch = value.match(/\/tickets\/([^/?#]+)/);
  const sigMatch = value.match(/[?&]s=([^&#]+)/);
  if (!idMatch || !sigMatch) return null;
  return {
    registrationId: decodeURIComponent(idMatch[1]),
    sig: decodeURIComponent(sigMatch[1]),
  };
}

const SCAN_INTERVAL_MS = 250;
/** How long the "that's not a ticket" notice blocks re-reporting the same code. */
const REJECT_COOLDOWN_MS = 2500;

type ScannerState =
  | { phase: "starting" }
  | { phase: "scanning"; notice?: string }
  | { phase: "found" }
  | { phase: "error"; message: string };

export function TicketScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const foundRef = useRef(false);
  const rejectedRef = useRef<{ text: string; at: number } | null>(null);
  const [state, setState] = useState<ScannerState>({ phase: "starting" });

  const onDecoded = useCallback(
    (text: string) => {
      if (foundRef.current) return;

      const ticket = parseScannedTicket(text);
      if (!ticket) {
        const last = rejectedRef.current;
        if (last && last.text === text && Date.now() - last.at < REJECT_COOLDOWN_MS) return;
        rejectedRef.current = { text, at: Date.now() };
        setState({
          phase: "scanning",
          notice: "That QR code is not a race ticket — keep the ticket's code in the frame.",
        });
        return;
      }

      foundRef.current = true;
      setState({ phase: "found" });
      router.push(
        `/tickets/${encodeURIComponent(ticket.registrationId)}?s=${encodeURIComponent(ticket.sig)}#admin`,
      );
    },
    [router],
  );

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const tick = () => {
      if (foundRef.current || video.readyState < video.HAVE_ENOUGH_DATA) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) onDecoded(code.data);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({
          phase: "error",
          message:
            "This browser can't open the camera here. Use the phone's own camera app instead — the ticket QR opens the same check-in page.",
        });
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        setState({
          phase: "error",
          message:
            "Camera access was refused. Allow the camera for this site and reload — or scan with the phone's own camera app, the ticket QR opens the same check-in page.",
        });
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setState({ phase: "scanning" });
      timer = setInterval(tick, SCAN_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDecoded]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-admin-lg border border-admin-line bg-black">
        {/* The camera preview; jsQR reads frames from the hidden canvas copy. */}
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover sm:aspect-video"
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        {state.phase !== "scanning" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6">
            <p className="max-w-md text-center text-[14px] leading-relaxed text-white">
              {state.phase === "starting" ? "Starting the camera…" : null}
              {state.phase === "found" ? "Ticket found — opening check-in…" : null}
              {state.phase === "error" ? state.message : null}
            </p>
          </div>
        ) : null}
      </div>

      <p className="text-[13px] leading-relaxed text-admin-ink-2" role="status">
        {state.phase === "scanning" && state.notice
          ? state.notice
          : "Point the camera at the QR code on the runner's ticket. It opens their check-in page with the bib assignment."}
      </p>
    </div>
  );
}
