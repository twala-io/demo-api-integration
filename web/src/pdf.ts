// Where each signer's fields go on page 1 of the uploaded PDF.
export const slot = (index: number) => ({ xPercent: 10, yPercent: 30 + index * 14, dateXPercent: 55 });

export async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
