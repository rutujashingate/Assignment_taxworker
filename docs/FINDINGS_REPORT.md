# Errors found and uncertainties requiring review

Client **CL-20417**, 2025 · original **v3** · source clock **2026-06-23T06:05:00Z**.

Packet SHA-256: `ee01f8508bd2fd9854754b82fd9c4a055bdc55e2778a132002a25381c412ad19`.

Deterministic supplied-packet facts only. Printed evidence, extraction, original engine output and human decisions are separate. No tax engine rerun or tax-law adjudication.

**4 confirmed source/calculation mismatches, 2 unresolved candidates or ambiguities, and 1 passing negative control.** These are not six proven tax-law errors. Source-only resolution labels do not replace live triage. All screenshots use a staff identity without sensitive-data clearance.

## BROKER_PAGE_UNEXTRACTED — Printed lot M18 has no extracted fields

- Finding ID: `BROKER_PAGE_UNEXTRACTED:D31:M18`; rule/check version: `v3`; engine rules: No exact computed lot rule exists.
- Outcome: **confirmed_mismatch**; certainty: **certain**; severity: **warning**.
- Affected tax line(s): No extracted M18 lot or exact computed tax-line relationship exists. This is a Schedule D / Form 8949 completeness gap, not an invented return line..
- Resolution: **not_corrected_in_original_v3**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Inspect missing lot page. Source/calculation fact only; no tax-law conclusion or engine rerun.
- [Open workpaper route](/engagements/CL-20417/2025/review?issue=BROKER_PAGE_UNEXTRACTED%3AD31%3AM18&ref=doc%3AD31%23page32) · [Actual UI screenshot](screenshots/findings/BROKER_PAGE_UNEXTRACTED.png)

A used brokerage document contains a printed sales lot on a page with no extracted fields. The superseded report is linked as corroboration, not a second missing-lot finding. No lot, basis correction or tax effect has been created.

### Observed versus reconciliation target

```json
{
  "observed": {
    "activeDocument": "D31",
    "page": 32,
    "lot": "M18",
    "proceeds": 250,
    "basis": 310,
    "extractedFields": 0
  },
  "expected": {
    "recordedExtractionOrDocumentedDisposition": 1
  }
}
```

### Original engine references

```json
[]
```

### Separate pipeline readings

```json
[]
```

### Printed evidence, with identifiers masked

**doc:D30#page32**

> Supplemental page (page 32, 'Additional transactions'): M18 Ironwood REIT (fractional share cash in lieu) 6.8 sh acquired 2025-01-14 sold 2025-12-15 proceeds 250.00 basis 310.00 short-term noncovered.

**doc:D31#page32**

> Supplemental page (page 32, 'Additional transactions'): M18 Ironwood REIT (fractional share cash in lieu) 6.8 sh acquired 2025-01-14 sold 2025-12-15 proceeds 250.00 basis 310.00 short-term noncovered.

### Verifiable input references

`doc:D30#page32` · `doc:D31#page32`

## CA_PAYMENT_YEAR — California payment was designated to a different tax year

- Finding ID: `CA_PAYMENT_YEAR:D68`; rule/check version: `v3`; engine rules: `R-CA-ESTIMATED-PAYMENTS`.
- Outcome: **confirmed_mismatch**; certainty: **certain**; severity: **blocking**.
- Affected tax line(s): `F540NR.72` (2025 California estimated tax payments: 14000).
- Resolution: **not_corrected_in_original_v3**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Inspect payment designation. Source/calculation fact only; no tax-law conclusion or engine rerun.
- [Open workpaper route](/engagements/CL-20417/2025/review?issue=CA_PAYMENT_YEAR%3AD68&ref=ev-1076) · [Actual UI screenshot](screenshots/findings/CA_PAYMENT_YEAR.png)

The return's claimed payments differ from the available 2025 FTB account total. Used payment 2025-09-15 is explicitly designated to a different tax year in the printed confirmation. Compare the linked agency records. Calendar date alone does not determine the designated tax year; no transfer is assumed.

### Observed versus reconciliation target

```json
{
  "observed": {
    "returnClaimed": 14000,
    "wrongYearPaymentsUsed": [
      {
        "date": "2025-09-15",
        "amount": 3500,
        "designatedTaxYear": 2024
      }
    ]
  },
  "expected": {
    "agency2025Payments": 10500,
    "printed2025Payments": 10500,
    "difference": 3500
  }
}
```

### Original engine references

```json
[
  {
    "key": "F540NR.72",
    "label": "2025 California estimated tax payments",
    "value": 14000,
    "rule": "R-CA-ESTIMATED-PAYMENTS",
    "inputs": [],
    "sources": [
      "ev-1069",
      "ev-1068",
      "ev-1070",
      "ev-1072",
      "ev-1071",
      "ev-1073",
      "ev-1075",
      "ev-1074",
      "ev-1076",
      "ev-1078",
      "ev-1077",
      "ev-1079"
    ]
  }
]
```

### Separate pipeline readings

```json
[
  {
    "id": "ev-1074",
    "documentId": "D68",
    "page": 1,
    "field": "pay5_date",
    "value": "2025-09-15",
    "textAsRead": "09/15/2025",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-1075",
    "documentId": "D68",
    "page": 1,
    "field": "pay5_amount",
    "value": 3500,
    "textAsRead": "3,500.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-1076",
    "documentId": "D68",
    "page": 1,
    "field": "pay5_year",
    "value": "2024",
    "textAsRead": "2024",
    "confidence": 0.98,
    "humanVerification": "Not recorded by the immutable packet"
  }
]
```

### Printed evidence, with identifiers masked

**doc:D68#page1**

> FTB Web Pay confirmations: 2025-01-15 3,000.00 tax year 2024 (estimated payment); 2025-03-28 1,240.00 tax year 2024 (balance due); 2025-04-15 3,500.00 tax year 2025 (estimated payment); 2025-06-16 3,500.00 tax year 2025 (estimated payment); 2025-09-15 3,500.00 tax year 2024 (estimated payment); 2026-01-15 3,500.00 tax year 2025 (estimated payment).

### Verifiable input references

`F540NR.72` · `agency:/ftb_account/tax_year_2024_payments_after_filing` · `agency:/ftb_account/tax_year_2025_payments` · `doc:D68#page1` · `ev-1074` · `ev-1075` · `ev-1076`

## CARD_RECEIPTS_OVERLAP — Card receipts already appear in the business books

- Finding ID: `CARD_RECEIPTS_OVERLAP:D14+D15+D21`; rule/check version: `v3`; engine rules: `R-SCHC-GROSS`.
- Outcome: **confirmed_mismatch**; certainty: **certain**; severity: **blocking**.
- Affected tax line(s): `SchC.1` (Gross receipts: 163700).
- Resolution: **not_corrected_in_original_v3**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Reconcile card deposits to books. Source/calculation fact only; no tax-law conclusion or engine rerun.
- [Open workpaper route](/engagements/CL-20417/2025/review?issue=CARD_RECEIPTS_OVERLAP%3AD14%2BD15%2BD21&ref=doc%3AD15%23page3) · [Actual UI screenshot](screenshots/findings/CARD_RECEIPTS_OVERLAP.png)

The transaction detail identifies the processor, payer, gross deposits and sales account: the card receipts are already included in books revenue. The return adds the same card report to that books total. Reconcile timing and any other adjustments before changing gross receipts.

### Observed versus reconciliation target

```json
{
  "observed": {
    "returnGrossReceipts": 163700,
    "cardReceipts": 12400,
    "booksRevenue": 151300,
    "usedAsAdditionalSource": true
  },
  "expected": {
    "receiptsAlreadyInBooks": 12400,
    "booksGrossBeforeOtherAdjustments": 151300
  }
}
```

### Original engine references

```json
[
  {
    "key": "SchC.1",
    "label": "Gross receipts",
    "value": 163700,
    "rule": "R-SCHC-GROSS",
    "inputs": [],
    "sources": [
      "ev-0103",
      "ev-0127",
      "ev-0113",
      "ev-0116",
      "ev-0119",
      "ev-0122",
      "ev-0125"
    ]
  }
]
```

### Separate pipeline readings

```json
[
  {
    "id": "ev-0103",
    "documentId": "D14",
    "page": 1,
    "field": "total_income",
    "value": 151300,
    "textAsRead": "151,300.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0109",
    "documentId": "D15",
    "page": 3,
    "field": "atlas_paywell",
    "value": 12400,
    "textAsRead": "12,400.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0127",
    "documentId": "D21",
    "page": 1,
    "field": "box1a",
    "value": 12400,
    "textAsRead": "12,400.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  }
]
```

### Printed evidence, with identifiers masked

**doc:D14#page1**

> Profit and Loss, Lindqvist Studio, Jan-Dec 2025, cash basis. Sales - client projects 145,900.00; Sales - print and licensing 5,400.00; Advertising 2,100.00; Bank and merchant fees 386.00; Car and truck - fuel 3,100.00; Contract labor 7,400.00; Depreciation 7,600.00; Insurance - business liability 1,450.00; Insurance - health (Erik) 14,400.00; Internet 1,320.00; Legal and professional 1,800.00; Meals 3,960.00; Office expenses 1,180.00; Software and subscriptions 6,850.00; Supplies 3,240.00; Telephone 2,160.00; Travel 4,520.00. Total income 151,300.00. Total expenses 61,466.00. Net income 89,834.00.

**doc:D15#page3**

> Deposits detail: Atlas Outdoor Gear paid 41,200.00 in 2025, of which 12,400.00 arrived through Paywell Payments card processing (deposited gross; processing fees booked to Bank and merchant fees) and 28,800.00 by ACH. Client deposits are recorded as Sales - client projects, except print and licensing sales (5,400.00). Deposits from clients who issued no Form 1099: 9,300.00 from 11 small clients.

**doc:D21#page1**

> Form 1099-K 2025. Filer Paywell Payments, Inc. Payee Erik Lindqvist dba Lindqvist Studio. Box 1a gross amount of payment card/third party network transactions 12,400.00. Box 3 number of payment transactions 6. Monthly: 0.00, 0.00, 1,850.00, 0.00, 2,400.00, 0.00, 3,100.00, 0.00, 1,650.00, 2,200.00, 0.00, 1,200.00.

### Verifiable input references

`SchC.1` · `doc:D14#page1` · `doc:D15#page3` · `doc:D21#page1` · `ev-0103` · `ev-0109` · `ev-0127`

## CHARITY_AMOUNT_UNCLEAR — Handwritten donation amount needs clarification

- Finding ID: `CHARITY_AMOUNT_UNCLEAR:D64`; rule/check version: `v3`; engine rules: `R-CHARITY-CASH`.
- Outcome: **needs_information**; certainty: **judgment**; severity: **blocking**.
- Affected tax line(s): `SchA.11` (Gifts by cash or check: 3350).
- Resolution: **not_corrected_in_original_v3**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Inspect ambiguous receipt. CPA confirmation or additional dated evidence is required.
- [Open workpaper route](/engagements/CL-20417/2025/review?issue=CHARITY_AMOUNT_UNCLEAR%3AD64&ref=ev-1049) · [Actual UI screenshot](screenshots/findings/CHARITY_AMOUNT_UNCLEAR.png)

The printed first digit is unknown. The pipeline's amount and confidence do not establish the gift amount. No amount is established by this check, and later client answers are unavailable at the workpaper date. Obtain legible, dated supporting evidence.

### Observed versus reconciliation target

```json
{
  "observed": {
    "printedAmount": "$?,500.00",
    "pipelineReading": 1500,
    "pipelineConfidence": 0.41
  },
  "expected": {
    "verifiedGiftAmount": null,
    "clarificationRequired": true
  }
}
```

### Original engine references

```json
[
  {
    "key": "SchA.11",
    "label": "Gifts by cash or check",
    "value": 3350,
    "rule": "R-CHARITY-CASH",
    "inputs": [],
    "sources": [
      "ev-1047",
      "ev-1048",
      "ev-1049"
    ]
  }
]
```

### Separate pipeline readings

```json
[
  {
    "id": "ev-1049",
    "documentId": "D64",
    "page": 1,
    "field": "amount",
    "value": 1500,
    "textAsRead": "1,500.00",
    "confidence": 0.41,
    "humanVerification": "Not recorded by the immutable packet"
  }
]
```

### Printed evidence, with identifiers masked

**doc:D64#page1**

> Handwritten receipt on parish letterhead dated 12/21/2025: 'Received from the Okafor-Lindqvist family, $?,500.00 - thank you.' The first digit is ambiguous (could be read as 1 or 7). No goods or services line. Signed by parish office manager.

### Verifiable input references

`SchA.11` · `doc:D64#page1` · `ev-1049`

## INTEREST_SWEEP_OVERLAP — Bank sweep interest appears in two used reports

- Finding ID: `INTEREST_SWEEP_OVERLAP:D28+D29`; rule/check version: `v3`; engine rules: `R-CARRY`, `R-INTEREST-PAYER`, `R-INTEREST-PAYER`, `R-SUM`.
- Outcome: **candidate**; certainty: **probable**; severity: **blocking**.
- Affected tax line(s): `F1040.2b` (Taxable interest: 6450); `SchB.1.1` (Interest - Northlake Securities - bank sweep (composite 1099-INT): 1840); `SchB.1.2` (Interest - Northlake Bank, N.A.: 1840); `SchB.4` (Taxable interest: 6450).
- Resolution: **not_corrected_in_original_v3**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Compare sweep reports. CPA confirmation or additional dated evidence is required.
- [Open workpaper route](/engagements/CL-20417/2025/review?issue=INTEREST_SWEEP_OVERLAP%3AD28%2BD29&ref=ev-0492) · [Actual UI screenshot](screenshots/findings/INTEREST_SWEEP_OVERLAP.png)

The reports identify the same bank sweep program, account ending, owner and tax year, and both extracted interest items feed separate used Schedule B lines. Matching amounts alone are not the basis for this candidate. Confirm the economic overlap before excluding a report.

### Observed versus reconciliation target

```json
{
  "observed": {
    "documents": [
      "D28",
      "D29"
    ],
    "usedItems": [
      {
        "document": "D28",
        "amount": 1840,
        "lines": [
          "SchB.1.1"
        ]
      },
      {
        "document": "D29",
        "amount": 1840,
        "lines": [
          "SchB.1.2"
        ]
      }
    ],
    "usedReportedTotal": 3680
  },
  "expected": {
    "economicItems": 1,
    "CPAConfirmationRequired": true
  }
}
```

### Original engine references

```json
[
  {
    "key": "F1040.2b",
    "label": "Taxable interest",
    "value": 6450,
    "rule": "R-CARRY",
    "inputs": [
      "SchB.4"
    ],
    "sources": []
  },
  {
    "key": "SchB.1.1",
    "label": "Interest - Northlake Securities - bank sweep (composite 1099-INT)",
    "value": 1840,
    "rule": "R-INTEREST-PAYER",
    "inputs": [],
    "sources": [
      "ev-0492"
    ]
  },
  {
    "key": "SchB.1.2",
    "label": "Interest - Northlake Bank, N.A.",
    "value": 1840,
    "rule": "R-INTEREST-PAYER",
    "inputs": [],
    "sources": [
      "ev-0538"
    ]
  },
  {
    "key": "SchB.4",
    "label": "Taxable interest",
    "value": 6450,
    "rule": "R-SUM",
    "inputs": [
      "SchB.2"
    ],
    "sources": []
  }
]
```

### Separate pipeline readings

```json
[
  {
    "id": "ev-0492",
    "documentId": "D28",
    "page": 1,
    "field": "int_1",
    "value": 1840,
    "textAsRead": "1,840.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0538",
    "documentId": "D29",
    "page": 1,
    "field": "box1",
    "value": 1840,
    "textAsRead": "1,840.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  }
]
```

### Printed evidence, with identifiers masked

**doc:D28#page1**

> Consolidated 1099 2025, account ending 7731, Ngozi Okafor. 1099-DIV: 1a total ordinary dividends 2,940.00; 1b qualified 2,410.00; 2a total capital gain distributions 1,180.00. 1099-INT (bank sweep program, Northlake Bank): box 1 interest 1,840.00.

**doc:D29#page1**

> Form 1099-INT 2025. Payer Northlake Bank, N.A. (bank sweep program for Northlake Securities account ending 7731). Recipient Ngozi Okafor. Box 1 interest income 1,840.00.

### Verifiable input references

`F1040.2b` · `SchB.1.1` · `SchB.1.2` · `SchB.4` · `doc:D28#page1` · `doc:D29#page1` · `ev-0492` · `ev-0538`

## MILEAGE_DUPLICATE_PAGES — Mileage includes a duplicated printed page

- Finding ID: `MILEAGE_DUPLICATE_PAGES:D23`; rule/check version: `v3`; engine rules: `R-MILEAGE-PAGE-TOTALS`, `R-STANDARD-MILEAGE`.
- Outcome: **confirmed_mismatch**; certainty: **certain**; severity: **blocking**.
- Affected tax line(s): `SchC.44a` (Business miles (Part IV): 11800); `SchC.9` (Car and truck expenses (standard mileage): 8260).
- Resolution: **not_corrected_in_original_v3**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Inspect duplicate mileage pages. Source/calculation fact only; no tax-law conclusion or engine rerun.
- [Open workpaper route](/engagements/CL-20417/2025/review?issue=MILEAGE_DUPLICATE_PAGES%3AD23&ref=doc%3AD23%23page2) · [Actual UI screenshot](screenshots/findings/MILEAGE_DUPLICATE_PAGES.png)

Pages with the same dates, destinations, purposes and trip miles occur twice. Counting each unique printed trip sheet once gives the expected page total. This is a source reconciliation, not a recomputed tax deduction.

### Observed versus reconciliation target

```json
{
  "observed": {
    "reportedMiles": 11800,
    "printedPageTotal": 11800,
    "duplicatePageGroups": [
      [
        2,
        3
      ]
    ]
  },
  "expected": {
    "uniquePageMiles": 8100,
    "excessMiles": 3700
  }
}
```

### Original engine references

```json
[
  {
    "key": "SchC.44a",
    "label": "Business miles (Part IV)",
    "value": 11800,
    "rule": "R-MILEAGE-PAGE-TOTALS",
    "inputs": [],
    "sources": [
      "ev-0226",
      "ev-0315",
      "ev-0477",
      "ev-0404"
    ]
  },
  {
    "key": "SchC.9",
    "label": "Car and truck expenses (standard mileage)",
    "value": 8260,
    "rule": "R-STANDARD-MILEAGE",
    "inputs": [
      "SchC.44a"
    ],
    "sources": [
      "ref:param.mileage_rate"
    ]
  }
]
```

### Separate pipeline readings

```json
[
  {
    "id": "ev-0226",
    "documentId": "D23",
    "page": 1,
    "field": "page_total",
    "value": 2600,
    "textAsRead": "2600",
    "confidence": 0.96,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0315",
    "documentId": "D23",
    "page": 2,
    "field": "page_total",
    "value": 3700,
    "textAsRead": "3700",
    "confidence": 0.96,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0404",
    "documentId": "D23",
    "page": 3,
    "field": "page_total",
    "value": 3700,
    "textAsRead": "3700",
    "confidence": 0.96,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0477",
    "documentId": "D23",
    "page": 4,
    "field": "page_total",
    "value": 1800,
    "textAsRead": "1800",
    "confidence": 0.96,
    "humanVerification": "Not recorded by the immutable packet"
  }
]
```

### Printed evidence, with identifiers masked

**doc:D23#page1**

> Mileage log Jan-Apr. Vehicle 2021 Toyota RAV4 Hybrid. 2025-01-03 Pixel Press print shop, Sacramento (equipment pickup) 118 mi; 2025-01-08 Sable & Finch, Davis (client presentation) 60 mi; 2025-01-11 Fennimore Brewing, Sacramento (client presentation) 125 mi; 2025-01-13 Fennimore Brewing, Sacramento (client presentation) 50 mi; 2025-01-15 Atlas Outdoor Gear, Roseville (photo shoot) 167 mi; 2025-01-18 Fennimore Brewing, Sacramento (photo shoot) 45 mi; 2025-01-25 Camera Exchange, Sacramento (client meeting) 154 mi; 2025-01-30 Fennimore Brewing, Sacramento (photo shoot) 146 mi; 2025-02-01 Camera Exchange, Sacramento (print proofing) 53 mi; 2025-02-19 Fennimore Brewing, Sacramento (client presentation) 201 mi; 2025-02-20 Pixel Press print shop, Sacramento (print proofing) 227 mi; 2025-02-20 Pixel Press print shop, Sacramento (client presentation) 79 mi; 2025-02-23 Atlas Outdoor Gear, Roseville (print proofing) 199 mi; 2025-03-05 Camera Exchange, Sacramento (equipment pickup) 79 mi; 2025-03-11 Camera Exchange, Sacramento (equipment pickup) 45 mi; 2025-03-15 Pixel Press print shop, Sacramento (client meeting) 186 mi; 2025-03-16 Client site shoot, Folsom (client presentation) 87 mi; 2025-03-26 Pixel Press print shop, Sacramento (client presentation) 202 mi; 2025-04-11 Fennimore Brewing, Sacramento (print proofing) 202 mi; 2025-04-20 Camera Exchange, Sacramento (photo shoot) 175 mi. Page total 2,600 miles.

**doc:D23#page2**

> Mileage log May-Aug. Vehicle 2021 Toyota RAV4 Hybrid. 2025-05-01 Pixel Press print shop, Sacramento (client meeting) 130 mi; 2025-05-10 Atlas Outdoor Gear, Roseville (photo shoot) 222 mi; 2025-05-19 Atlas Outdoor Gear, Roseville (photo shoot) 195 mi; 2025-05-19 Atlas Outdoor Gear, Roseville (equipment pickup) 178 mi; 2025-05-21 Camera Exchange, Sacramento (photo shoot) 240 mi; 2025-05-30 Sable & Finch, Davis (client presentation) 188 mi; 2025-06-05 Fennimore Brewing, Sacramento (client meeting) 177 mi; 2025-06-05 Camera Exchange, Sacramento (equipment pickup) 178 mi; 2025-06-05 Atlas Outdoor Gear, Roseville (photo shoot) 184 mi; 2025-06-07 Atlas Outdoor Gear, Roseville (photo shoot) 83 mi; 2025-06-09 Client site shoot, Folsom (print proofing) 167 mi; 2025-06-12 Sable & Finch, Davis (photo shoot) 139 mi; 2025-06-14 Client site shoot, Folsom (print proofing) 244 mi; 2025-06-16 Client site shoot, Folsom (print proofing) 128 mi; 2025-07-07 Atlas Outdoor Gear, Roseville (equipment pickup) 169 mi; 2025-07-09 Atlas Outdoor Gear, Roseville (client presentation) 105 mi; 2025-07-09 Pixel Press print shop, Sacramento (photo shoot) 120 mi; 2025-07-21 Riverbend Credit Union, Austin (client presentation) 188 mi; 2025-07-25 Quill Media, Round Rock (photo shoot) 53 mi; 2025-08-15 Client site shoot, Pflugerville (print proofing) 167 mi; 2025-08-18 Atlas Outdoor Gear store, Austin (client presentation) 261 mi; 2025-08-23 Quill Media, Round Rock (client meeting) 184 mi. Page total 3,700 miles.

**doc:D23#page3**

> (Second scan of the May-Aug sheet - same handwriting and coffee stain as page 2.) Mileage log May-Aug. Vehicle 2021 Toyota RAV4 Hybrid. 2025-05-01 Pixel Press print shop, Sacramento (client meeting) 130 mi; 2025-05-10 Atlas Outdoor Gear, Roseville (photo shoot) 222 mi; 2025-05-19 Atlas Outdoor Gear, Roseville (photo shoot) 195 mi; 2025-05-19 Atlas Outdoor Gear, Roseville (equipment pickup) 178 mi; 2025-05-21 Camera Exchange, Sacramento (photo shoot) 240 mi; 2025-05-30 Sable & Finch, Davis (client presentation) 188 mi; 2025-06-05 Fennimore Brewing, Sacramento (client meeting) 177 mi; 2025-06-05 Camera Exchange, Sacramento (equipment pickup) 178 mi; 2025-06-05 Atlas Outdoor Gear, Roseville (photo shoot) 184 mi; 2025-06-07 Atlas Outdoor Gear, Roseville (photo shoot) 83 mi; 2025-06-09 Client site shoot, Folsom (print proofing) 167 mi; 2025-06-12 Sable & Finch, Davis (photo shoot) 139 mi; 2025-06-14 Client site shoot, Folsom (print proofing) 244 mi; 2025-06-16 Client site shoot, Folsom (print proofing) 128 mi; 2025-07-07 Atlas Outdoor Gear, Roseville (equipment pickup) 169 mi; 2025-07-09 Atlas Outdoor Gear, Roseville (client presentation) 105 mi; 2025-07-09 Pixel Press print shop, Sacramento (photo shoot) 120 mi; 2025-07-21 Riverbend Credit Union, Austin (client presentation) 188 mi; 2025-07-25 Quill Media, Round Rock (photo shoot) 53 mi; 2025-08-15 Client site shoot, Pflugerville (print proofing) 167 mi; 2025-08-18 Atlas Outdoor Gear store, Austin (client presentation) 261 mi; 2025-08-23 Quill Media, Round Rock (client meeting) 184 mi. Page total 3,700 miles.

**doc:D23#page4**

> Mileage log Sep-Dec. Vehicle 2021 Toyota RAV4 Hybrid. 2025-09-10 Quill Media, Round Rock (photo shoot) 92 mi; 2025-09-21 Client site shoot, Pflugerville (photo shoot) 121 mi; 2025-10-05 Atlas Outdoor Gear store, Austin (client meeting) 121 mi; 2025-10-11 Riverbend Credit Union, Austin (photo shoot) 91 mi; 2025-10-13 Lone Star Print, Austin (print proofing) 78 mi; 2025-10-17 Atlas Outdoor Gear store, Austin (client meeting) 78 mi; 2025-10-17 Riverbend Credit Union, Austin (client presentation) 47 mi; 2025-10-19 Riverbend Credit Union, Austin (client presentation) 145 mi; 2025-10-30 Atlas Outdoor Gear store, Austin (print proofing) 122 mi; 2025-11-01 Lone Star Print, Austin (photo shoot) 65 mi; 2025-11-05 Lone Star Print, Austin (client presentation) 157 mi; 2025-11-07 Lone Star Print, Austin (photo shoot) 163 mi; 2025-11-07 Riverbend Credit Union, Austin (equipment pickup) 119 mi; 2025-11-19 Atlas Outdoor Gear store, Austin (client presentation) 51 mi; 2025-12-02 Client site shoot, Pflugerville (print proofing) 66 mi; 2025-12-03 Atlas Outdoor Gear store, Austin (print proofing) 157 mi; 2025-12-04 Lone Star Print, Austin (photo shoot) 45 mi; 2025-12-07 Lone Star Print, Austin (equipment pickup) 82 mi. Page total 1,800 miles. Odometer 01/01/2025: 41,220. Odometer 12/31/2025: 58,960. No commuting (home office is the principal place of business). Vehicle used in the business since 06/01/2021.

### Verifiable input references

`SchC.44a` · `SchC.9` · `doc:D23#page1` · `doc:D23#page2` · `doc:D23#page3` · `doc:D23#page4` · `ev-0226` · `ev-0315` · `ev-0404` · `ev-0477`

## W2_CONTRIBUTION_COUNT — Duplicate W-2 image contribution control

- Finding ID: `W2_CONTRIBUTION_COUNT:F1040.1a`; rule/check version: `v3`; engine rules: `R-W2-BOX1-SUM`.
- Outcome: **pass**; certainty: **certain**; severity: **info**.
- Affected tax line(s): `F1040.1a` (Wages (Forms W-2, box 1): 212400).
- Resolution: **passing_control**. Packet-only report. No live human resolution or corrected liability is asserted; open the route for current triage.
- Next action: Inspect wage contribution. Source/calculation fact only; no tax-law conclusion or engine rerun.
- [Open workpaper route](/engagements/CL-20417/2025/return?ref=F1040.1a&line=F1040.1a) · [Actual UI screenshot](screenshots/findings/W2_CONTRIBUTION_COUNT.png)

D09 and D10 match on employer, owner, year and W-2 box details; used wage sources: D09. No matching report has more than one used wage contribution. No duplicate engine contribution is flagged.

### Observed versus reconciliation target

```json
{
  "observed": {
    "duplicateImageGroups": [
      {
        "documents": [
          "D09",
          "D10"
        ],
        "usedDocuments": [
          "D09"
        ]
      }
    ]
  },
  "expected": {
    "maximumUsedContributionsPerMatchingReport": 1
  }
}
```

### Original engine references

```json
[
  {
    "key": "F1040.1a",
    "label": "Wages (Forms W-2, box 1)",
    "value": 212400,
    "rule": "R-W2-BOX1-SUM",
    "inputs": [],
    "sources": [
      "ev-0016",
      "ev-0035"
    ]
  }
]
```

### Separate pipeline readings

```json
[
  {
    "id": "ev-0035",
    "documentId": "D09",
    "page": 1,
    "field": "box1",
    "value": 107800,
    "textAsRead": "107,800.00",
    "confidence": 0.99,
    "humanVerification": "Not recorded by the immutable packet"
  },
  {
    "id": "ev-0052",
    "documentId": "D10",
    "page": 1,
    "field": "box1",
    "value": 107800,
    "textAsRead": "107,800.00",
    "confidence": 0.93,
    "humanVerification": "Not recorded by the immutable packet"
  }
]
```

### Printed evidence, with identifiers masked

**doc:D09#page1**

> Form W-2 2025. Employer Halvorsen Data LLC, EIN 74-2290518, 300 Colorado St, Austin TX. Employee Ngozi Okafor, SSN [REDACTED SSN]. Box 1 107,800.00; Box 2 9,600.00; Box 3 118,000.00; Box 4 7,316.00; Box 5 118,000.00; Box 6 1,711.00; Box 10 5,000.00; Box 12 D 10,200.00, W 3,500.00, DD 11,400.00; Box 13 retirement plan checked; Box 15 CA; Box 16 111,300.00; Box 17 4,180.00. (Employment began 06/02/2025. Employer payroll kept California as the work state through 09/30/2025.)

**doc:D10#page1**

> Phone photo of a Halvorsen Data LLC 2025 Form W-2 (Copy B), slightly skewed. Employer Halvorsen Data LLC, EIN 74-2290518. Employee Ngozi Okafor, SSN [REDACTED SSN]. Box 1 107,800.00; Box 2 9,600.00; Box 3 118,000.00; Box 4 7,316.00; Box 5 118,000.00; Box 6 1,711.00; Box 10 5,000.00; Box 12 D 10,200.00, W 3,500.00, DD 11,400.00; Box 13 retirement plan checked; Box 15 CA; Box 16 111,300.00; Box 17 4,180.00.

### Verifiable input references

`F1040.1a` · `doc:D09#page1` · `doc:D10#page1` · `ev-0035` · `ev-0052`

## Reproduction and demonstration

Run `npm run findings:generate -- --canonical` to read the committed original only after checking its exact SHA-256, or pass `--packet /absolute/path/to/the/original.json`. `npm run findings:check` compares both generated files byte for byte without rewriting them. The same pure reconciliations power Review Desk. `tests/e2e/phase8.spec.ts` opens each real finding, checks the source text, and creates the linked screenshots; the W-2 screenshot is explicitly a passing control. No database dispositions, current clock, wall-clock timestamp, or random IDs enter this report. The original JSON is never modified.
