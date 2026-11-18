// Where each signer's fields go on page 1, matching the sample PDF's labels.
export const slot = (index: number) => ({ xPercent: 10, yPercent: 30 + index * 14, dateXPercent: 55 });

export async function samplePdf(title: string, signers: string[]) {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const top = (percent: number) => height - (percent / 100) * height;
  page.drawText(title, { x: 60, y: height - 90, size: 22, font: bold });
  page.drawText('Sample document made by the Twala API showcase.', { x: 60, y: height - 120, size: 11, font, color: rgb(0.4, 0.4, 0.45) });
  signers.forEach((name, i) => {
    const { yPercent } = slot(i);
    page.drawText(`${name}`, { x: 60, y: top(yPercent) + 6, size: 10, font: bold });
    page.drawLine({ start: { x: 60, y: top(yPercent) - 46 }, end: { x: 260, y: top(yPercent) - 46 }, thickness: 0.6, color: rgb(0.6, 0.6, 0.65) });
    page.drawText('Signature', { x: 60, y: top(yPercent) - 58, size: 8, font, color: rgb(0.5, 0.5, 0.55) });
    page.drawText('Date', { x: 330, y: top(yPercent) - 58, size: 8, font, color: rgb(0.5, 0.5, 0.55) });
  });
  return toBase64(await doc.save());
}

export async function fileToBase64(file: File) {
  return toBase64(new Uint8Array(await file.arrayBuffer()));
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
