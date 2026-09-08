"use client";

import { useEffect, useRef, useState } from "react";

import { startBarcodeScan, type ScannerControls } from "@/lib/scan/decoder";

/** Short beep via WebAudio — decode confirmation (§4.3 req 2) without
 * shipping an audio asset. */
function playBeep() {
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.12);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Audio isn't essential — vibration still confirms the scan.
  }
}

/**
 * Continuous camera QR scanner (§4.3). Keeps decoding once the camera
 * starts; each accepted decode triggers a sound + vibration and calls
 * `onDetect`, with no tap-to-confirm step. `paused` stops dispatching new
 * detections (e.g. while a confirmation dialog is open) without tearing
 * down the camera stream, since restarting it is the dominant latency cost.
 */
export function QrScanner({
  onDetect,
  paused = false,
}: {
  onDetect: (text: string) => void;
  paused?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [status, setStatus] = useState<"starting" | "active" | "error">(
    "starting",
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let controls: ScannerControls | null = null;
    let cancelled = false;

    startBarcodeScan(video, {
      isCancelled: () => cancelled,
      onDetect: (text) => {
        if (pausedRef.current) return;
        playBeep();
        if (navigator.vibrate) navigator.vibrate(80);
        onDetectRef.current(text);
      },
    })
      .then((c) => {
        if (cancelled) {
          c.stop();
          return;
        }
        controls = c;
        setStatus("active");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Camera scan failed to start", err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-md border border-input bg-black">
      <video
        ref={videoRef}
        className="aspect-square w-full object-cover"
        muted
        playsInline
      />
      {status === "error" && (
        <p className="bg-destructive/10 p-2 text-center text-sm text-destructive">
          Camera unavailable — use manual entry below.
        </p>
      )}
    </div>
  );
}
