/**
 * Fixture receipts that have a real photograph in the repo, so the detail page shows an
 * image on the demo path. The files live with the analysis samples and are read only.
 */
const SAMPLE_FILE_BY_STORAGE_KEY: Record<string, string> = {
  "receipts/fixture/clean-lunch.jpg": "union-hall-coffee.jpg",
  "receipts/fixture/chicago-lunch.jpg": "lou-malnatis.jpg",
  "receipts/fixture/parking.jpg": "pittsburgh-parking.jpg",
  "receipts/fixture/remote-lunch.jpg": "lou-malnatis.jpg",
};

export function sampleReceiptFileName(storageKey: string): string | null {
  return SAMPLE_FILE_BY_STORAGE_KEY[storageKey] ?? null;
}
