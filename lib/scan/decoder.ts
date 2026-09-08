import { BrowserQRCodeReader } from "@zxing/browser";

export interface ScannerControls {
  stop: () => void;
}

export interface DecoderOptions {
  onDetect: (text: string) => void;
  /** Ignore repeat reads of the same code within this window (§4.3 req 3) —
   * a card lingering in frame shouldn't double-register. */
  dedupeWindowMs?: number;
}

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

/**
 * Starts a continuous QR scan against `videoElement`: native `BarcodeDetector`
 * where available (Chrome/Android — fast, low-power), `@zxing/browser`
 * fallback elsewhere (iOS Safari has no BarcodeDetector). Both paths keep
 * the camera stream alive between reads rather than reinitialising per
 * scan — that reinit is the dominant cost (1–2s) in naive implementations
 * (§4.3 req 1). Call `stop()` to release the camera.
 */
export async function startBarcodeScan(
  videoElement: HTMLVideoElement,
  { onDetect, dedupeWindowMs = 1500 }: DecoderOptions,
): Promise<ScannerControls> {
  let lastText: string | null = null;
  let lastAt = 0;

  function emit(text: string) {
    const now = Date.now();
    if (text === lastText && now - lastAt < dedupeWindowMs) return;
    lastText = text;
    lastAt = now;
    onDetect(text);
  }

  if (isBarcodeDetectorSupported()) {
    return startNativeScan(videoElement, emit);
  }
  return startZXingScan(videoElement, emit);
}

async function startNativeScan(
  videoElement: HTMLVideoElement,
  emit: (text: string) => void,
): Promise<ScannerControls> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  videoElement.srcObject = stream;
  await videoElement.play();

  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  let stopped = false;
  let frame: number;

  async function tick() {
    if (stopped) return;
    try {
      const codes = await detector.detect(videoElement);
      if (codes.length > 0) emit(codes[0].rawValue);
    } catch {
      // Transient decode errors (e.g. video not yet ready) — keep scanning.
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    },
  };
}

async function startZXingScan(
  videoElement: HTMLVideoElement,
  emit: (text: string) => void,
): Promise<ScannerControls> {
  const reader = new BrowserQRCodeReader();
  // deviceId left undefined: zxing picks a device, preferring the
  // environment-facing camera when available.
  const controls = await reader.decodeFromVideoDevice(
    undefined,
    videoElement,
    (result) => {
      if (result) emit(result.getText());
    },
  );

  return {
    stop() {
      controls.stop();
    },
  };
}
