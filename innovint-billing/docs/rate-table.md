# Rate Table

The Rate Table defines how each InnoVint action is priced. Each row is a **rate rule** that matches a specific action type, variation, and billing unit to a dollar rate.

## Creating a Rule

Click **Add Rule** to open the rule editor. Fill in the fields below and click **Save**.

### Required Fields

| Field | Description |
|-------|-------------|
| **Action Type** | The InnoVint action type to match (e.g., `ANALYSIS`, `CUSTOM`, `ADDITION`, `FILTER`, `BOTTLE`). Select from the dropdown or type a custom value. |
| **Variation** | The subtype or name within the action type (e.g., a specific analysis panel, additive name, or custom action name). Leave blank to create a catch-all rule that matches any variation. |
| **Label** | Human-readable name shown in billing results and invoices. Auto-generated from Action Type + Variation if left blank. |
| **Billing Unit** | How the charge is calculated. See [Billing Units](#billing-units) below. |
| **Rate** | Dollar amount per billing unit. |

### Optional Fields

| Field | Description |
|-------|-------------|
| **Setup Fee** | One-time fee added per action occurrence. |
| **Setup Fee Mode** | `per_action` (default) adds the fee to each action. `spread_daily` splits one setup fee across all actions of the same type on the same day, proportional to volume. |
| **Min Dollar** | Minimum charge floor. If the calculated total is below this amount, the charge is increased to the minimum. |
| **Free First per Lot** | Waives the charge for the first occurrence of this rule per lot code. The waived row shows "(Included)" in results. |
| **Exclude All-Inclusive** | Zeros out the charge for lots tagged "all-inclusive" in InnoVint. These rows show "(All-Inclusive)" in results. |
| **Min Qty / Max Qty** | For tonnage-based rules (fruit processing). Multiple rules can cover different weight ranges with tiered pricing. |
| **Notes** | Internal notes, not shown on invoices. |
| **Enabled** | Toggle the rule on or off without deleting it. |

### Action-Type-Specific Fields

| Field | Applies To | Description |
|-------|-----------|-------------|
| **Vessel Type** | ADDITION | Filter to a specific vessel type: Tank, Barrel, Keg, Carboy, Steel Drum, Bin, or Egg. |
| **Material Rate** | ADDITION | Cost per additive unit. Added to the per-vessel charge. |
| **Analysis Source** | ANALYSIS | Filter to a specific lab source. |
| **Bottles per Case** | BOTTLE | Filter to a specific case format (e.g., 12). |
| **Exclude Tax Classes** | ADDITION | List of tax classes to bill at $0 (e.g., `FERMENTING_JUICE`, `HARD_CIDER`). |

## Billing Units

| Unit | Quantity Used |
|------|-------------|
| **per hour** | Hours extracted from the action's notes field |
| **per barrel** | Number of vessels involved |
| **per vessel** | Number of vessels involved |
| **per gallon** | Lot volume at time of action |
| **per kg** | Weight from the action |
| **per ton** | Weight from the action |
| **per case** | Case count from the action |
| **per analysis** | Count of analyses |
| **per additive unit** | Quantity of additive used |
| **per lot** | Always 1 (flat per-lot charge) |
| **flat fee** | Always 1 (fixed charge regardless of quantity) |

## Matching Priority

When the system processes an action, it searches for a matching rate rule in this order:

1. **Exact match** — Action type, variation, and any type-specific filters (vessel type, analysis source, bottles per case) all match exactly.
2. **Partial match** — Action type and variation match, but type-specific filters are blank on the rule (matches any).
3. **Catch-all** — Action type matches and the rule's variation is blank.
4. **Billable keyword** — If the action's name or notes contain the word "billable", a rule with variation `BILLABLE` is used regardless of action type.
5. **Unmatched** — No rule found. The action appears in the Audit tab for manual review.

### ADDITION Actions (4-Tier Cascade)

1. Exact additive name + exact vessel type
2. Exact additive name + any vessel type
3. Any additive name + exact vessel type
4. Any additive name + any vessel type (full catch-all)

### ANALYSIS Actions (4-Tier Cascade)

1. Exact panel name + exact analysis source
2. Exact panel name + any source
3. Any panel name + exact source
4. Any panel name + any source (full catch-all)

### BOTTLE Actions

1. Exact bottle format name + exact bottles-per-case
2. Exact bottle format name + any bottles-per-case
3. Catch-all (blank variation)

## CSV Import and Export

### Exporting

Click **Export CSV** to download all rate rules as `rate-rules.csv`. All rules are exported regardless of any active filters.

### Importing

Click **Import CSV** to upload a CSV file. After parsing, a preview of the first 10 rules is shown. Choose an import mode:

- **Merge** — Updates existing rules that match by action type + variation (case-insensitive). New rules are appended.
- **Replace All** — Discards all current rules and replaces them with the imported set.

### CSV Column Order

```
actionType, variation, label, billingUnit, rate, setupFee, minQty, maxQty,
notes, enabled, setupFeeMode, minDollar, freeFirstPerLot, excludeTaxClasses,
vesselType, analysisSource, excludeAllInclusive
```

- `enabled`: use `1`, `true`, or `yes` for enabled
- `maxQty`: leave blank for unlimited
- `excludeTaxClasses`: pipe-separated (e.g., `FERMENTING_JUICE|HARD_CIDER`)
- `freeFirstPerLot` and `excludeAllInclusive`: use `1` for true, `0` for false
