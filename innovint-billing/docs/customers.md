# Customers

The Customers page maps InnoVint owner names to billing codes and stores contact information used on invoices.

## Customer Fields

| Field | Description |
|-------|-------------|
| **Owner Name** | The owner name exactly as it appears in InnoVint (e.g., "VIV"). This is the lookup key used to match actions to customers. |
| **Code** | Short billing code (e.g., "VIV"). Automatically uppercased. Used throughout the system as the internal customer identifier. |
| **Display Name** | Full customer name shown on invoices (e.g., "Vivier Wines"). |
| **Address** | Mailing address, printed on PDF invoices. |
| **Phone** | Phone number, printed on PDF invoices. |
| **Email** | Email address, printed on PDF invoices. |

## Managing Customers

### Adding a Customer

Click **Add Row** to add a blank row. Fill in the Owner Name, Code, and Display Name at minimum, then click **Save Customers**.

### Editing a Customer

All fields are editable directly in the table. Make your changes and click **Save Customers** to persist.

### Removing a Customer

Click the **X** button on a row to remove it, then click **Save Customers**.

### Unmapped Owners

If the system encounters an owner from InnoVint that doesn't have a customer mapping, it is automatically added as a row with the Owner Name pre-filled but no Code. These unmapped rows appear highlighted in amber. Fill in the Code and Display Name to complete the mapping.

On the Fruit Intake page, records from unmapped owners appear with a red background and "UNMAPPED" as the code.

## CSV Import

Click **Import CSV** to upload a file. The expected format is:

```
Owner Name, Code, Display Name, Address, Phone, Email
```

- One customer per line
- Fields are comma-separated
- Surrounding quotes are stripped automatically
- Imported customers are appended to the existing list (not replaced)
- Click **Save Customers** after importing to persist

Accepts `.csv` and `.txt` files.
