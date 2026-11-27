export interface CertificateStat {
  label: string;
  value: string;
}

export interface CertificateData {
  rank: number;
  total: number;
  journalName: string;
  owner: string;
  edgeScore: number;
  stats: CertificateStat[];
  issuedAt: string;
}

/** Landscape A4 ranking certificate generated on the server with pdf-lib. */
export async function buildRankingCertificate(
  data: CertificateData,
  fontBytes: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const [{ PDFDocument, rgb, StandardFonts }, { default: fontkit }] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const fallback = await pdf.embedFont(StandardFonts.Helvetica);
  const safe = (text: string) =>
    font.getCharacterSet().includes(text.codePointAt(0) ?? 0) ? font : fallback;

  pdf.setTitle(`Ranking Certificate - ${data.journalName}`);
  pdf.setCreator("Trade Jurnal by Artian Capital Group");
  pdf.setSubject(`Rank ${data.rank} of ${data.total} - edge score ${data.edgeScore.toFixed(1)}`);

  const page = pdf.addPage([842, 595]);
  const ink = rgb(0.12, 0.16, 0.22);
  const muted = rgb(0.42, 0.47, 0.54);
  const brand = rgb(0.13, 0.45, 0.32);
  const gold = rgb(0.72, 0.52, 0.16);

  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.98, 0.98, 0.97) });
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 12, color: brand });
  page.drawRectangle({
    x: 36,
    y: 36,
    width: 770,
    height: 523,
    borderColor: rgb(0.78, 0.82, 0.78),
    borderWidth: 1.5,
  });
  page.drawRectangle({ x: 36, y: 36, width: 770, height: 8, color: gold });

  const draw = (text: string, x: number, y: number, size: number, color = ink) =>
    page.drawText(text, { x, y, size, font: safe(text), color });

  const centered = (text: string, y: number, size: number, color = ink) => {
    const chosen = safe(text);
    const width = chosen.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (842 - width) / 2, y, size, font: chosen, color });
  };

  centered("CERTIFICATE OF RANKING", 492, 26, brand);
  centered("Trade Jurnal by Artian Capital Group", 458, 11, muted);
  centered(`Rank ${data.rank} dari ${data.total} jurnal`, 410, 20, gold);
  centered(data.journalName, 366, 24, ink);
  centered(`Milik: ${data.owner}`, 334, 13, muted);

  draw("EDGE SCORE", 96, 288, 10, muted);
  draw(data.edgeScore.toFixed(1), 96, 256, 34, brand);

  const startX = 330;
  data.stats.slice(0, 8).forEach((stat, index) => {
    const y = 292 - index * 27;
    draw(stat.label, startX, y, 11, muted);
    draw(stat.value, 560, y, 11, ink);
  });

  const issued = new Date(data.issuedAt);
  const stamp = Number.isNaN(issued.getTime())
    ? data.issuedAt
    : issued.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
  draw(`Diterbitkan: ${stamp} UTC`, 96, 92, 10, muted);
  draw(
    `Sertifikat ini merefleksikan peringkat pada saat unduhan. Peringkat dapat berubah.`,
    96,
    72,
    9,
    muted,
  );
  centered("Artian Capital Group", 54, 9, brand);

  return new Uint8Array(await pdf.save());
}
