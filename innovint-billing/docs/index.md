# Opal Moon Billing Portal - Documentation

Welcome to the Opal Moon Billing Portal documentation. This guide covers everything you need to get started with the billing system and use it effectively.

## Table of Contents

1. [Getting Started](getting-started.md) - Initial setup, login, and first billing run
2. [Settings](settings.md) - API credentials, snapshot configuration, and fruit intake settings
3. [Rate Table](rate-table.md) - Creating and managing billing rules
4. [Billing](billing.md) - Running billing, reviewing results, and exporting data
5. [Fruit Intake](fruit-intake.md) - Fruit intake contracts, programs, and installment schedules
6. [Billable Add-Ons](add-ons.md) - One-off charges outside standard billing rules
7. [Customers](customers.md) - Customer mapping and contact information
8. [Invoices](invoices.md) - Generating PDF invoices
9. [User Management](users.md) - Managing users and roles (Admin only)

## Overview

The Opal Moon Billing Portal connects to your InnoVint cellar management system and automates the billing process for winery services. It pulls action data from InnoVint, matches each action to your configured rate rules, and produces detailed billing reports and invoices.

### What the portal handles

- **Action-based billing** - Filters, analyses, additions, custom labor, bottling, barrel operations, and more
- **Inventory-based billing** - Bulk wine storage (per gallon) and empty barrel/tirage storage (per barrel)
- **Fruit intake contracts** - Multi-month installment billing for fruit processing
- **Billable add-ons** - Manual one-off charges
- **Invoice generation** - Professional PDF invoices per customer
- **Excel exports** - Multi-sheet workbooks with full billing detail

### User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access to all features, plus user management |
| **Team Member** | Full access to billing, rate table, settings, customers, invoices |
| **Cellar** | Can view and add billable add-ons only |
