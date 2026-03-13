# Settings

The Settings page configures your InnoVint API connection, storage billing parameters, and fruit intake program settings.

## InnoVint API Credentials

| Field | Description |
|-------|-------------|
| **Access Token** | Your InnoVint API access token. Stored securely. |
| **Winery ID** | Your numeric InnoVint winery identifier. |

Both fields are required before you can run billing.

## Bulk Storage Rate

The **Rate per gallon** ($/gal) is applied to bulk wine storage billing. This rate is used when calculating charges based on the 3-snapshot billing method (see [Billing - Bulk Inventory](billing.md#bulk-inventory)).

## Barrel Inventory Snapshots

Configure which days of the month the system takes inventory snapshots for empty barrel storage billing:

| Field | Description |
|-------|-------------|
| **Snapshot 1 Day** | Day of month for the first snapshot (1-31) |
| **Snapshot 2 Day** | Day of month for the second snapshot (1-31) |
| **Snapshot 3 Day** | Day of month for the third snapshot, or "last day of month" |

The system averages the empty barrel counts across all three snapshots to calculate the monthly storage charge.

## Fruit Intake Settings

These settings control how fruit intake contracts are calculated.

### General

| Field | Description |
|-------|-------------|
| **Action Type Key** | The InnoVint action type used for fruit intake events (default: `FRUITINTAKE`) |
| **Vintage Lookback** | How many years of vintages to query (1-5, default: 3) |
| **API Page Delay** | Seconds to wait between API pages during fetch (0-30) |
| **Default Contract Length** | Number of months for new contracts (default: 9) |

### Programs

Create multiple pricing programs for different fruit types. Each program has:

| Field | Description |
|-------|-------------|
| **Program Name** | Display name (e.g., "Program #1") |
| **Description** | Description (e.g., "Red Wine") |
| **Rate per Ton** | Price per ton of fruit ($) |

### Fees

| Field | Description |
|-------|-------------|
| **Min Processing Fee** | Minimum charge per fruit intake event ($) |
| **Small Lot Fee** | Additional fee for lots below the threshold ($) |
| **Small Lot Threshold** | Weight in tons below which the small lot fee applies |
