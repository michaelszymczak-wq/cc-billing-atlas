# Billing

The Billing page is where you run monthly billing, review results, and export data.

## Running Billing

1. Select the **Month** and **Year** for the billing period.
2. Click **Run Billing**.

The system runs through these stages:

1. **Fetch Actions** — Pulls all actions from InnoVint for the selected month (paginated).
2. **Process Actions** — Normalizes raw API data into billable rows, extracting hours, volumes, and quantities.
3. **Enrich Volumes** — For CUSTOM actions billed per gallon, looks up each lot's actual volume at the time of the action.
4. **Rate Matching** — Matches each action to a rate rule and calculates charges. Unmatched actions go to the Audit tab.
5. **Bulk Inventory** — Calculates bulk wine storage charges using three inventory snapshots.
6. **Barrel Inventory** — Calculates empty barrel and tirage storage charges using three vessel inventory snapshots.

A progress bar and log show real-time status as each stage completes.

## Results Overview

After billing completes, five summary cards are displayed:

| Card | Description |
|------|-------------|
| **Total Actions** | Number of actions fetched and processed |
| **Total Billed** | Sum of all charges across matched actions |
| **Unmatched** | Number of actions that didn't match any rate rule |
| **BULK Lots** | Number of owners with bulk wine storage charges |
| **Barrel Owners** | Number of owners with barrel/tirage storage charges |

## Results Tabs

### Actions

The main billing results table. Each row shows:

- **Action Type** — The InnoVint action type
- **Action ID** — Links to the action in InnoVint
- **Lot Codes** — Associated lot codes
- **Performer** — Who performed the action
- **Date** — When the action occurred
- **Owner Code** — The customer billing code
- **Analysis/Notes** — Analysis panel name, custom action name, or notes
- **Hours** — Hours extracted from notes (for per-hour billing)
- **Qty** — Quantity used for billing (volume, cases, vessels, etc.)
- **Rate** — The matched rate per unit
- **Setup Fee** — One-time fee applied
- **Total** — Final charge for this action

**Color coding:**
- **Green** — Matched to a rate rule
- **Yellow** — Unmatched (no rate rule found)
- **Italic** — Rectified from the Audit tab

### Bulk Inventory

Bulk wine storage charges per owner. See [Bulk Storage](#bulk-storage) below.

### Barrel Inventory

Empty barrel and tirage storage charges per owner. See [Barrel Storage](#barrel-storage) below.

### Audit

Actions that didn't match any rate rule. See [Rectifying Unmatched Actions](#rectifying-unmatched-actions) below.

### Summary

A per-customer summary showing total charges across all categories.

## Bulk Storage

Bulk wine storage uses a **3-snapshot** method to determine monthly charges:

1. **Snapshot 1** — Day 1 of the month
2. **Snapshot 2** — Day 15 of the month
3. **Snapshot 3** — Last day of the month

For each owner:

- **Billing Volume** = the maximum volume across all three snapshots
- **Proration** = 100% if the owner had wine on day 15, or 50% if only on day 1 or the last day
- **Total** = Billing Volume × Rate per Gallon × Proration

The rate per gallon is configured in [Settings](settings.md#bulk-storage-rate).

Only lots tagged "BULK" or "Bulk" in InnoVint are included.

## Barrel Storage

Empty barrel storage uses a **3-snapshot average** to determine monthly charges. The snapshot days are configurable in [Settings](settings.md#barrel-inventory-snapshots).

For each snapshot, the system exports the full vessel inventory from InnoVint and counts empty vessels (those with zero or no fill level) by owner.

Three vessel categories are tracked separately:

| Category | Vessels Counted |
|----------|----------------|
| **Barrels** | Empty BARREL vessels (excluding puncheon style) |
| **Puncheons** | Empty BARREL vessels with a puncheon style |
| **Tirage** | Empty TIRAGE vessels |

For each owner and category:

- **Average** = (Snapshot 1 + Snapshot 2 + Snapshot 3) ÷ 3
- **Charge** = Average × Rate + Setup Fee

Each category uses its own rate rule from the Rate Table. Rules are identified by labels containing "EMPTY", "BARREL", and "STORAGE", with "PUNCHEON" or "TIRAGE" distinguishing the subcategories.

## Rectifying Unmatched Actions

The **Audit** tab shows actions that didn't match any rate rule. You can manually assign a rule to each:

1. Select a **rate rule** from the "Assign Rule" dropdown.
2. The **Total** field auto-calculates based on the rule's rate and setup fee. You can override it manually.
3. Optionally change the **Owner Code** if it was misidentified.
4. Click **Rectify**.

Rectified actions replace the original unmatched row in the Actions tab and appear in italic to indicate they were manually assigned.

## Excel Export

Click **Download Excel** to generate a multi-sheet workbook (`cc-billing-atlas.xlsx`):

| Sheet | Contents |
|-------|----------|
| **ACTIONS** | All action-based billing rows with color coding |
| **Bulk Inventory** | Bulk wine storage charges per owner |
| **Barrel Inventory** | Barrel/tirage storage charges per owner |
| **Audit Report** | Unmatched actions with reasons |
| **Fruit Intake** | Fruit intake records (if any exist) |
| **Installment Schedule** | Monthly installment matrix (if fruit records exist) |
