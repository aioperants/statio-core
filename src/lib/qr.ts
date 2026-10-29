import QRCode from "qrcode";

/** The QR's dark squares, with the white margin (quiet zone) of 4 modules around them. */
export function qrMatrix(url: string) {
  const q = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = q.modules.size;
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.modules.data[r * n + c]) cells.push([c + 4, r + 4]);
  return { count: n + 8, cells };
}

/** A plain QR with its quiet zone, as SVG (to download and print). */
export function qrSvg(url: string) {
  const m = qrMatrix(url);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.count} ${m.count}"><rect width="${m.count}" height="${m.count}" fill="#ffffff"/><path fill="#111111" shape-rendering="crispEdges" d="${m.cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("")}"/></svg>`;
}
