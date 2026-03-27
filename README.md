# Sage Embedded Services Demo

A demonstration web application showcasing Sage Embedded Services API capabilities for prospective customers. This app simulates a small business owner's experience while demonstrating core API features.

## Features

- **Authentication**: Simple login gate for demo access
- **Tenant Management**: Create and manage business tenants
- **Bank Accounts**: Add bank accounts with opening balances
- **Financial Years**: Set up accounting periods
- **CSV Upload**: Import bank payments and receipts from CSV files
- **P&L Reports**: Generate Profit & Loss reports

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or bun

### Installation

```bash
# Clone the repository (if applicable)
# git clone <repository-url>

# Install dependencies
npm install
```

### Running Locally

The application includes a built-in Vite proxy to handle CORS when making requests to the Sage API. This allows the app to run entirely in the browser without a separate backend.

```bash
# Start development server with proxy enabled
npm run dev
```

This starts the app on `http://localhost:8080` with automatic proxying:

| Local Proxy Path | Target API |
|------------------|------------|
| `/api/oauth/token` | `https://id-shadow.sage.com/oauth/token` |
| `/api/sage-core/*` | `https://api.sandbox.sbc.sage.com/*` |
| `/api/sage-subscriptions/*` | `https://api.sandbox.sbc.sage.com/slcsadapter/v2/*` |

The proxy runs only during development and transparently forwards requests to the Sage sandbox APIs.

### How the CORS Proxy Works

Browser security (CORS) blocks direct requests from a web page to external APIs that don't include the proper headers. The Sage OAuth and API endpoints don't support CORS for browser requests.

The Vite development server acts as a proxy:
1. Your browser makes requests to `localhost:8080/api/...`
2. Vite intercepts these requests and forwards them to the real Sage API
3. Vite returns the response to your browser

This is configured in `vite.config.ts` and requires no additional setup.

### Build for Production

```bash
npm run build
npm run preview  # To test the production build locally
```

> **⚠️ Production Deployment:** The Vite proxy only works in development. For production deployments, you will need:
> - A backend proxy (Node.js, serverless function, etc.) to forward API requests
> - Or deploy behind a reverse proxy (nginx, Cloudflare Workers, etc.) that adds CORS headers

### Demo Login

- **Password**: `sage2024`

## Configuration

### Option 1: Configuration File (Recommended for Development)

Create a file `public/app-config.local.json` with your Sage API credentials:

```json
{
  "clientId": "your-tenant-client-id",
  "clientSecret": "your-tenant-client-secret",
  "subscriptionClientId": "your-subscription-client-id",
  "subscriptionClientSecret": "your-subscription-client-secret",
  "productCode": "SAGE_ONE",
  "platform": "UK",
  "businessTypeCode": "SOLE_TRADER"
}
```

> **Note:** This file is gitignored and will not be committed to version control.

### Option 2: Admin Settings UI

Navigate to **Admin Settings** in the app to configure credentials at runtime:

1. **Tenant Services Credentials**
   - Client ID
   - Client Secret

2. **Subscription Credentials**
   - Subscription Client ID
   - Subscription Client Secret

3. **Subscription Settings** (from [subscriptions endpoint](https://developer.columbus.sage.com/docs/services/sage-ses-subscriptions-api/operations/Tenants_GetSubscriptionAsync))
   - Product Code (e.g., `SAGE_ONE`)
   - Platform (e.g., `UK`)
   - Business Type Code (e.g., `SOLE_TRADER`)

Credentials entered in the Admin UI are stored in localStorage.

### Tenant Selection

After creating tenants, use the dropdown in the sidebar to select the active tenant for all operations.

## CSV Format for Transactions

Upload bank payments and receipts using a CSV file with the following format:

```csv
date,type,description,reference,amount,category
2024-01-15,receipt,Client Payment - ABC Corp,INV-001,5000.00,Sales
2024-01-18,payment,Office Supplies,PO-123,150.00,Office Expenses
2024-01-20,receipt,Consulting Fee,INV-002,2500.00,Sales
2024-01-22,payment,Software Subscription,SUB-001,99.00,Software
2024-01-25,payment,Travel Expenses,EXP-001,350.00,Travel
2024-01-28,receipt,Product Sale,INV-003,1200.00,Sales
```

### Column Definitions

| Column | Description | Example |
|--------|-------------|---------|
| `date` | Transaction date (YYYY-MM-DD) | `2024-01-15` |
| `type` | Either `payment` or `receipt` | `receipt` |
| `description` | Transaction description | `Client Payment - ABC Corp` |
| `reference` | Reference number | `INV-001` |
| `amount` | Transaction amount | `5000.00` |
| `category` | Expense/income category | `Sales` |

A sample CSV file can be downloaded from the Transactions page.

## API Endpoints Used

This demo simulates the following Sage Embedded Services API endpoints:

- `POST /oauth/token` - Authentication
- `POST /tenants` - Create tenant
- `GET /tenants` - List tenants
- `POST /bank_accounts` - Create bank account
- `POST /bank_opening_balances` - Set opening balance
- `POST /financial_settings` - Create financial year
- `POST /bank_payments` - Create bank payment
- `POST /bank_receipts` - Create bank receipt
- `GET /reports/profit_and_loss` - Generate P&L report

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Router
- TanStack Query

## Data Storage

This demo stores all data locally in the browser using localStorage. In a production environment, data would be stored securely on the server and synced with Sage's API.

## API Documentation

For full API documentation, visit:
- [Sage Embedded Services OpenAPI](https://developer.columbus.sage.com/docs/services/sage-ses-core-api)
- [Subscriptions API](https://developer.columbus.sage.com/docs/services/sage-ses-subscriptions-api)

## License

Demo application for demonstration purposes only.
