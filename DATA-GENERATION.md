# Data generation

Python plus Faker. Generate a believable company, then inject fraud on purpose so you know the ground truth and can measure precision and recall.

```bash
python -m generator.seed --employees 45 --months 6 --inject-fraud --seed 42
```

Always pass `--seed`. A reproducible dataset means a reproducible demo, and it means a failing detector test is a real failure rather than yesterday's random draw.

## What gets generated

| Entity | Count at 45 employees, 6 months | Notes |
|---|---|---|
| Employees | 45 | Across 5 departments with realistic title ladders |
| Merchants | ~120 | Weighted so the top 20 carry most volume |
| Expenses | ~2,700 | Roughly 10 per employee per month, Poisson distributed |
| Receipt images | ~2,700 | Rendered, not stock photos. See below. |
| Timesheets | ~1,170 | One per employee per week |
| Invoices | ~180 | Vendor invoices, secondary detectors only |

## Realism rules that matter

A generator that produces uniform noise makes every detector look brilliant and teaches you nothing. Four things are worth getting right:

**Per-person spending personalities.** Each employee draws a persistent profile at creation: a category mix, a typical amount distribution, a submission punctuality, a weekend-activity rate. The salesperson expenses travel and client dinners. The engineer expenses equipment and the occasional lunch. Without this, `EXP_AMOUNT_OUTLIER_SELF` has nothing to work against.

**Legitimate outliers.** Sprinkle genuine large expenses that are not fraud: a conference ticket, a laptop replacement, a team offsite. About 3% of expenses. These are what your false-positive rate is measured against, and a demo where you dismiss one live is far more convincing than one where every flag is real.

**Seasonality and drift.** Travel spend rises in Q1 and Q3. Meals spike in December. Two vendors raise prices at renewal. Timesheet hours dip around holidays.

**Recurring identical charges.** The same $4.50 parking fee every weekday, the same $12 monthly subscription. These exist to make sure `DUP_RECEIPT_FIELDS` has to be smarter than "same merchant, same amount".

## Receipt images

Do not use stock photos. Render receipts yourself with Pillow so you control exactly what is on them and can generate duplicates deliberately.

```
render_receipt(merchant, date, line_items, total, style) -> PIL.Image
```

Three or four visual styles, a monospaced font, plausible line items for the category. Then apply degradation so the vision model has real work to do:

- slight rotation, 0 to 4 degrees
- JPEG compression at quality 60 to 85
- brightness and contrast jitter
- occasional partial crop
- a paper texture overlay

For a perceptual-hash duplicate, render the same receipt once and apply two *different* degradation passes. That is exactly what a re-photographed receipt looks like, and it is what separates `DUP_RECEIPT_IMAGE` from `DUP_RECEIPT_EXACT`.

## Fraud injection

Every injected case writes a row to `ground_truth.jsonl` with the scenario name, the affected record ids, and the expected `rule_id`. Your evaluation script reads that file.

### Targets the three MVP detectors

| Scenario | Count | Should fire |
|---|---|---|
| Same receipt file resubmitted by the same person weeks later | 6 | `DUP_RECEIPT_EXACT` |
| Receipt re-photographed and resubmitted | 8 | `DUP_RECEIPT_IMAGE` |
| Different photo of the same meal, resubmitted | 5 | `DUP_RECEIPT_FIELDS` |
| Two employees submit the same dinner receipt | 4 | `DUP_RECEIPT_CROSS_USER` |
| One employee's meal claims drift to 4x their own median over two months | 3 | `EXP_AMOUNT_OUTLIER_SELF` |
| Employee whose travel spend is 3x their department's median | 2 | `EXP_AMOUNT_OUTLIER_PEER` |
| Burst of 14 small claims in three days before a policy change | 2 | `EXP_VELOCITY` |
| Electronics store expensed as "Meals" | 5 | `EXP_CATEGORY_MISMATCH` |
| Timesheet entries overlapping by two hours | 6 | `TS_OVERLAP` |
| A week copy-pasted verbatim four times | 3 | `TS_COPY_PASTE` |
| 19 hours logged in one day | 2 | `TS_IMPOSSIBLE_HOURS` |
| Exactly 8.0 hours every day for 7 straight weeks | 3 | `TS_ROUND_HOURS` |
| **Office hours logged while a receipt places them in another city** | **4** | **`TS_LOCATION_CONFLICT`** |

That last row is the demo. Make at least one of the four unambiguous: eight hours logged at the Pittsburgh office on a Tuesday, a lunch receipt from Chicago timestamped 12:40 the same day, same employee, both submitted innocently-looking a week apart.

### Near-misses, deliberately

Six to eight cases that look like fraud and are not. Each one goes in `ground_truth.jsonl` marked `expected: null`.

- a legitimately split dinner where two people each submit their own half, different amounts, same merchant, same night
- a genuine $3,200 conference ticket from someone who normally spends $40
- a real 14-hour day before a product launch, with a corresponding late-night meal receipt that corroborates it
- a duplicate-looking parking fee that is the actual daily recurring charge
- a legitimate remote work day in another city, with the timesheet location correctly set to that city

The last one is the important one. It is the same shape as `TS_LOCATION_CONFLICT` except the employee filled the location field in honestly, which is exactly the check your detector must make.

## Evaluation

```bash
python -m generator.evaluate --run-id <id>
```

Reads `ground_truth.jsonl`, reads the findings the detectors produced, and prints per-rule precision, recall and F1, plus the confusion matrix on the near-miss set.

Target for the MVP: precision above 0.85 on everything that can trigger an `IMMEDIATE_HOLD`, recall above 0.70 overall. Precision matters more. A missed finding costs money that was already being lost. A false accusation against a named employee is a different category of harm, and it is the one that would get this product thrown out of a real company.

Run this before you tune anything. Tuning thresholds by eye against a demo dataset is how you end up with a system that works only on the demo dataset.

## Module layout

```
analysis/generator/
  __init__.py
  profiles.py       employee spending personalities
  merchants.py      merchant catalogue with category weights
  expenses.py       expense stream generation
  timesheets.py     weekly timesheet generation
  receipts.py       Pillow rendering and degradation
  invoices.py       vendor invoices, secondary
  fraud.py          the injection scenarios above
  near_miss.py      the innocent lookalikes
  seed.py           CLI entry point, writes DB + ground_truth.jsonl
  evaluate.py       precision and recall against ground truth
```

Keep `fraud.py` and `near_miss.py` separate from the honest generators. When someone asks whether your detectors are just finding data you planted for them, being able to open two clearly separated files is a better answer than a paragraph.
