# Loyalty Phase 1: Admin design changes (v3.1)

These are loyalty features added to the POS Admin prototype. The theme and layout are unchanged, except the Finance tab, which uses a neutral corporate style. All loyalty data is sample data stored in the browser. In production, every balance change updates the grower's balance in the Cropwise Grower app in real time.

## Screens

| Area | What it does |
|---|---|
| Loyalty → Overview | Existing KPIs, plus outstanding liability (PKR), new enrollments, points expiring in 30 days, open fraud cases, average basket size and repeat purchase rate. The header shows the active program. |
| Loyalty → Ledger | Full audit log: Grower ID, type (earn / redeem / adjust / expire), channel (Online / POS / Admin), order / sale ID, product, SKU, qty × price, cart value, points, franchise, lat/long, user |
| Loyalty → Members | Grower ID, province / district / tehsil / village, earned, redeemed, adjusted, expired, balance, expiring in 30 days, blacklist status |
| Loyalty → Adjustments | The admin adds or deducts points by mobile number (manual credit, manual debit, correction, return reversal), with an optional note. It applies immediately; there is no approval step. Returns processed at a franchise are reversed automatically and listed here with the franchise name. A return can't be reversed twice. |
| Loyalty → Risk & Fraud | Fraud cases with score and status (Open / Under review / Closed), dashboard alert, blacklist from a case, and the blacklist manager (scope, reason, unblock log) |
| Loyalty → Reports | 10 reports with date range, preview and CSV export: Daily Loyalty Summary, Master Loyalty, Transaction Ledger, Franchise Ledger, Product Performance, Loyalty Program Performance, Point Adjustment, Points Expiry, Fraud, Blacklist |
| **Loyalty → Finance** | Franchise settlement statements for about 1,000 franchises, per period. Each statement has redemptions, points, gross, on hold, payable and status (Pending review → Approved → Paid). Includes search, zone / region / status filters, sorting, pagination, totals, CSV export and bulk select. **Approve** excludes held lines. **Mark as paid** records a bank transfer or credit note with a reference. The statement detail shows every redemption line with its check result and an audit trail. |
| Settings → Loyalty Program | Product Points & Eligibility: catalogue picker (SKU), Eligible switch, points per unit, and a rule for unlisted products (standard rate or no points). Only one program is active at a time. |
| Settings → Fraud Rules & Controls | Max redemptions per day, high-value redemption, repeated returns after earning, dashboard alerts |
| Online Orders → Order details | Loyalty Points panel: points per line, credited on delivery, none if cancelled, blocked if blacklisted |
| POS → Redeem Loyalty Code | Enter or scan a 6-digit code to see the grower, points and discount, then confirm. Used, expired and blacklisted codes are rejected. |
| Sales → Return dialog | Reverses the points earned on the returned items and logs it in Adjustments as a franchise return |

## Files

- `src/app/utils/loyaltyStore.ts`, `src/app/utils/settlementStore.ts`: sample data
- `src/app/components/LoyaltyAdjustments.tsx`, `LoyaltyRisk.tsx`, `LoyaltyReports.tsx`, `LoyaltyFinance.tsx`, `LoyaltyLedgerMembers.tsx`, `LoyaltySettingsParts.tsx`, `LoyaltyTouchpoints.tsx`: new
- `LoyaltyModule.tsx`, `SettingsModule.tsx`, `OrderManagementSystem.tsx`, `OrderReturnDialog.tsx`, `POSMain.tsx`: edited

## Demo values

- Mobile numbers for Adjustments: `0300-1234567`, `0312-9876543`
- Redemption codes on POS: `482913` valid · `111111` already used · `909090` expired · `555123` blacklisted

## Run

```bash
npm install
npm run dev
```
