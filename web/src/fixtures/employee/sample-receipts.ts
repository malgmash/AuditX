import type { ExpenseExtraction } from "@/contracts/employee";

export const SAMPLE_RECEIPT_EXTRACTIONS: Record<string, ExpenseExtraction> = {
  "7e1ffcca9fde40d5d57984ead4886a9dbbbd795bfe33fd27369bb0197ac646f4": {
    merchantName: { value: "Union Hall Coffee", confidence: 0.97 },
    transactionDate: { value: "2026-09-09", confidence: 0.96 },
    totalCents: { value: 1280, confidence: 0.98 },
    merchantCity: { value: "Pittsburgh", confidence: 0.9 },
    transactionTime: { value: "16:30", confidence: 0.9 },
    legibility: 0.95,
    correctedFields: [],
  },
  "1b6565296bc96b8f817d7ead7e983afaa7383864eca72b3b632df4725e6d9751": {
    merchantName: { value: "Lou Malnati's", confidence: 0.97 },
    transactionDate: { value: "2026-09-08", confidence: 0.96 },
    totalCents: { value: 1840, confidence: 0.98 },
    merchantCity: { value: "Chicago", confidence: 0.9 },
    transactionTime: { value: "12:40", confidence: 0.9 },
    legibility: 0.95,
    correctedFields: [],
  },
  "7ec1f67c1f1d368a6dedd8d0afac1f1475911f42e514bbad4c62ed1e96b9ea87": {
    merchantName: { value: "Pittsburgh Parking Authority", confidence: 0.97 },
    transactionDate: { value: "2026-09-02", confidence: 0.96 },
    totalCents: { value: 450, confidence: 0.98 },
    merchantCity: { value: "Pittsburgh", confidence: 0.9 },
    transactionTime: { value: "12:00", confidence: 0.9 },
    legibility: 0.95,
    correctedFields: [],
  },
};
