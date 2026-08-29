import QRCode from "qrcode";

export interface QrPath {
  path: string;
  size: number;
}

/**
 * Builds a single combined SVG path for a QR code's dark modules, so it can
 * render as one vector <Path fill="black"> instead of a raster image —
 * crisp module edges at any print size (spec §5.6). ECC level Q per the
 * SA Biathlon bib spec (§4.1): enough error correction to survive a
 * scratched/creased bib without ballooning module count.
 */
export function buildQrPath(data: string): QrPath {
  const qr = QRCode.create(data, { errorCorrectionLevel: "Q" });
  const { modules } = qr;
  const size = modules.size;

  let path = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules.get(row, col)) {
        path += `M${col},${row}h1v1h-1z`;
      }
    }
  }

  return { path, size };
}
