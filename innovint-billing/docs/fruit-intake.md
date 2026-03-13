# Fruit Intake

The Fruit Intake page manages crush contracts — tracking fruit received, calculating installment payments, and generating billing schedules.

## Fetching Fruit Intake Data

1. Go to the **Fruit Intake** tab.
2. Click **Run Fruit Intake Fetch**.

The system pulls data from two InnoVint endpoints:

- **Fruit Intake Report** — All fruit intake events across configured vintages
- **Lots Modular** — Lot details including tags and owner information

The **Vintage Lookback** setting (in [Settings](settings.md#fruit-intake-settings)) controls how many years of data to fetch. For example, a lookback of 3 fetches the current year and 2 prior years.

New records are merged with existing data — re-running the fetch adds new events without overwriting previously saved records. Duplicates are detected by event ID and by the combination of lot code + vintage + date.

## Records Table

Each fruit intake record shows:

| Column | Description |
|--------|-------------|
| **Vintage** | Harvest year |
| **Date** | Date the fruit was received |
| **Code** | Customer billing code |
| **Lot Code** | InnoVint lot code |
| **Varietal** | Grape variety |
| **Color** | Red or white |
| **Weight** | Fruit weight in tons |
| **Total** | Total contract cost |
| **Program** | Pricing program assigned |
| **Contract** | Contract length in months |
| **Rate/ton** | Price per ton |
| **Sm Lot** | Small lot fee (if applicable) |
| **Monthly** | Monthly installment amount |
| **Remaining** | Outstanding balance |

### Row Colors

- **Red** — Owner is unmapped (no customer record). Go to [Customers](customers.md) to add the mapping.
- **Yellow** — Contract not fully configured (missing contract length or rate).
- **Green** — Fully configured and ready for billing.

### Filtering

Use the filters at the top of the page:

- **Customer** — Filter by owner code
- **Vintage** — Filter by harvest year
- **Color** — Filter by red or white
- **Balance** — Show all records, only those with a remaining balance, or only completed contracts

## Editing Records

Four fields can be edited directly in the table:

| Field | How to Edit |
|-------|-------------|
| **Program** | Select from the dropdown. Automatically updates Rate/ton from the program settings. |
| **Contract** | Select the contract length from the dropdown. |
| **Rate/ton** | Click the value, type a new amount, press Enter to save. |
| **Sm Lot** | Click the value, type a new amount, press Enter to save. |

All changes are saved immediately and trigger a recalculation of Total, Monthly, and Remaining.

## How Contracts are Calculated

### Contract Start

All contracts start in **November of the vintage year**. For example, 2025 vintage fruit starts billing in November 2025.

### Total Cost

```
Total = max(Weight × Rate/ton, Minimum Processing Fee) + Small Lot Fee
```

- **Minimum Processing Fee** is configured in [Settings](settings.md#fruit-intake-settings). If the weight × rate is below this threshold, the minimum fee is charged instead.
- **Small Lot Fee** is added automatically when the weight is below the **Small Lot Threshold** (also in Settings). It can be overridden per record.

### Monthly Amount

```
Monthly = Total ÷ Contract Length (months)
```

### Installments

One installment is generated per month for the full contract length, starting from the contract start month (November of the vintage year).

## Programs

Programs are pricing tiers configured in [Settings](settings.md#fruit-intake-settings). Each program has a name, description, and rate per ton. When you assign a program to a record, its Rate/ton is automatically applied.

Example programs:
- **Program #1** — Red Wine ($250/ton)
- **Program #2** — White Wine ($200/ton)

## Installment Schedule

The second tab shows a **monthly installment matrix**:

- **Rows** — One per fruit record (Owner Code + Lot Code)
- **Columns** — One per calendar month across all active contracts
- **Subtotal** — Bottom row shows the total due per month

Click any month column header to **copy** that month's billing data (owner code and amount, tab-separated) to your clipboard for pasting into a spreadsheet.

## CSV Export

Click **Export CSV** to download all fruit intake records with full details including weigh tag number, owner name, and all calculated fields.
