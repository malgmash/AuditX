/** Browser-safe receipt checks. Server hashing lives in receipt-file.ts. */
const IMAGE_NAME = /\.(png|jpe?g|webp|gif|heic|heif)$/i;

export function isReceiptImage(file: { type: string; name: string }): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_NAME.test(file.name);
}
