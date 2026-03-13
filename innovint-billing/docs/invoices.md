# Invoices

The Invoices page generates professional PDF invoices from your billing results.

## Prerequisites

Before generating invoices:

1. **Run billing** for the desired month on the Billing tab.
2. **Set up customers** with display names and contact details on the Customers tab.

## Generating Invoices

1. Go to the **Invoices** tab.
2. Select the **Month** and **Year**.
3. Optionally enter **Excluded Customers** (comma-separated billing codes) to skip specific customers.
4. Click **Generate Preview**.

The preview shows a table of all customers with their:

- **Winery Services** total (actions + storage + add-ons)
- **Fruit Intake** total (crush installments due this month)
- **Combined Total**

Summary cards show the grand total, number of invoices, and number of customers.

5. Click **Download All Invoices (ZIP)** to generate and download all PDFs in a single ZIP file.

## Invoice Types

Each customer may receive up to two invoices per billing month:

### Winery Services Invoice

Covers all charges from the billing run:

- **Action-based charges** — Grouped by rate rule label (e.g., all "Filter" actions on one line)
- **Barrel storage** — Empty barrel and tirage storage charges
- **Bulk wine storage** — Per-gallon storage charges
- **Billable add-ons** — Manual charges entered on the Add-Ons tab

A **3% merchant fee** is added to the subtotal.

### Fruit Intake Invoice

Covers the crush installment due for the billing month. Each lot with an active contract that has a payment due in the selected month appears as a line item showing:

- Lot code
- Fruit weight (tons)
- Full contract total
- This month's installment amount

The invoice title indicates the installment number (e.g., "3rd Crush Installment") and subtitle shows progress (e.g., "3 OF 9 INSTALLMENTS 2025 CRUSH").

A **3% merchant fee** is also added.

## Invoice Format

### Invoice Number

Format: `{YEAR}-{MM}-{CODE}-{SEQ}`

Example: `2026-03-VIV-001` (first invoice for customer VIV in March 2026). If the customer has both a Winery Services and Fruit Intake invoice, the sequence increments (e.g., `-001` and `-002`).

### Issue Date

Set to the last day of the billing month.

### PDF Layout

Each invoice includes:

- Company header with logo, name, and contact information
- Invoice number and issue date
- Customer name and contact details
- Itemized line items with quantity, price, and amount
- Subtotal
- 3% merchant fee
- **Total Due** (highlighted)

### File Naming

PDFs are named: `{CustomerName}_{Invoice-Type}_{InvoiceNumber}.pdf`

The ZIP file is named: `Invoices_{Mon}-{Year}.zip` (e.g., `Invoices_Mar-2026.zip`).
