# Getting Started

## Logging In

Navigate to the portal URL and sign in with your email and password. If you don't have an account, ask your Admin to create one and provide you with a password setup link.

## First-Time Setup

Before running your first billing cycle, complete these steps in order:

### 1. Configure API Credentials

Go to **Settings** and enter your InnoVint API credentials:

- **Access Token** - Your InnoVint API access token
- **Winery ID** - Your InnoVint winery identifier (numeric)

These credentials allow the portal to pull action and inventory data from InnoVint.

### 2. Set Up Customers

Go to **Customers** and map your InnoVint owner names to billing codes:

- **Owner Name** - The owner name as it appears in InnoVint (e.g., "VIV")
- **Code** - Short billing code (auto-uppercased)
- **Display Name** - Full name for invoices (e.g., "Vivier Wines")
- **Address, Phone, Email** - Contact details for invoices

You can also import customers from a CSV file.

### 3. Create Rate Rules

Go to **Rate Table** and add your billing rules. Each rule defines how a specific type of action is priced. See the [Rate Table](rate-table.md) guide for detailed instructions.

### 4. Run Billing

Go to **Billing**, select the month and year, and click **Run Billing**. The system will:

1. Fetch all actions from InnoVint for the selected period
2. Match each action to your rate rules
3. Calculate bulk wine storage charges
4. Calculate empty barrel/tirage storage charges
5. Present results for review

See the [Billing](billing.md) guide for details on reviewing and exporting results.
