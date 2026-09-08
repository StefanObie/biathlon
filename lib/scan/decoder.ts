import { BrowserQRCodeReader } from "@zxing/browser";

export interface ScannerControls {
  stop: () => void;
}

export interface DecoderOptions {
  onDetect: (text: string) => void;
  /** Ignore repeat reads of the same code within this window (§4.3 req 3) —
   * a card lingering in frame shouldn't double-register. */
  dedupeWindowMs?: number;
  /** Checked right after the camera stream is acquired — if true by then,
   * the stream is stopped immediately instead of being attached to the
   * video element. Guards against React Strict Mode's double-invoked
   * effects racing two overlapping `getUserMedia` calls onto one element. */
  isCancelled?: () => boolean;
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
  { onDetect, dedupeWindowMs = 1500, isCancelled }: DecoderOptions,
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
    return startNativeScan(videoElement, emit, isCancelled);
  }
  return startZXingScan(videoElement, emit);
}

async function startNativeScan(
  videoElement: HTMLVideoElement,
  emit: (text: string) => void,
  isCancelled?: () => boolean,
): Promise<ScannerControls> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });

  function abortStream(): never {
    stream.getTracks().forEach((track) => track.stop());
    throw new DOMException(
      "Scan cancelled before camera attached",
      "AbortError",
    );
  }

  if (isCancelled?.()) abortStream();

  videoElement.srcObject = stream;
  try {
    await videoElement.play();
  } catch (err) {
    // A cancellation racing this play() call (e.g. Strict Mode's
    // double-invoked effect tearing down mid-play) surfaces here as
    // AbortError — treat it the same as the pre-attach cancellation
    // check above rather than letting it become an unhandled rejection.
    if (isCancelled?.()) abortStream();
    throw err;
  }
  if (isCancelled?.()) abortStream();

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

/** In-flight or active zxing scan per video element. `decodeFromVideoDevice`
 * attaches the stream and calls play() internally before it resolves, so
 * there is no seam to cancel it partway; overlapping starts on one element
 * (React Strict Mode's double-invoked effect) leave the second load
 * interrupting the first's play(), and the loser's teardown clears the
 * srcObject the winner is using — a permanently black preview. Serializing
 * on the element keeps a single scan attached at a time. */
const zxingScans = new WeakMap<HTMLVideoElement, Promise<ScannerControls>>();

async function startZXingScan(
  videoElement: HTMLVideoElement,
  emit: (text: string) => void,
): Promise<ScannerControls> {
  const previous = zxingScans.get(videoElement);
  if (previous) {
    await previous.then(
      (controls) => controls.stop(),
      () => {},
    );
  }

  const reader = new BrowserQRCodeReader();
  // deviceId left undefined: zxing picks a device, preferring the
  // environment-facing camera when available.
  const started = reader
    .decodeFromVideoDevice(undefined, videoElement, (result) => {
      if (result) emit(result.getText());
    })
    .then((controls) => ({
      stop() {
        if (zxingScans.get(videoElement) === started) {
          zxingScans.delete(videoElement);
        }
        controls.stop();
      },
    }));

  zxingScans.set(videoElement, started);
  return started;
}
