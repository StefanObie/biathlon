// `BarcodeDetector` isn't in TypeScript's DOM lib yet. Minimal ambient
// declaration for the subset used here (Chrome/Android only — see
// decoder.ts for the @zxing/browser fallback on other browsers).
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface Window {
  webkitAudioContext?: typeof AudioContext;
}
