export interface Credentials {
  clientId: string;
  clientSecret: string;
  subscriptionClientId: string;
  subscriptionClientSecret: string;
  productCode: string;
  platform: string;
  businessTypeCode: string;
  bankOpeningBalanceJournalCode: string;
  bankPaymentJournalCode: string;
  bankReceiptJournalCode: string;
}

export interface Tenant {
  id: string;
  name: string;
  businessName: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export interface BankAccount {
  id: string;
  tenantId: string;
  name: string;
  accountNumber: string;
  sortCode: string;
  currencyISO: string;
  accountType: string;
  balance: number;
  createdAt: string;
}

export interface FinancialYear {
  id: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  periodType: string;
  status: 'open' | 'closed';
}

export interface BankTransaction {
  id: string;
  tenantId: string;
  bankAccountId: string;
  type: 'payment' | 'receipt';
  date: string;
  description: string;
  reference: string;
  amount: number;
  category: string;
}

export interface OpeningBalance {
  id: string;
  bankAccountId: string;
  amount: number;
  date: string;
}

export interface ProfitLossReport {
  periodStart: string;
  periodEnd: string;
  income: {
    category: string;
    amount: number;
  }[];
  expenses: {
    category: string;
    amount: number;
  }[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface AppState {
  isAuthenticated: boolean;
  credentials: Credentials | null;
  tenants: Tenant[];
  activeTenantId: string | null;
  bankAccounts: BankAccount[];
  financialYears: FinancialYear[];
  transactions: BankTransaction[];
}

// API Response types
export interface ApiError {
  error: string;
  message: string;
  status: number;
  requestId?: string;
}

// Token metadata for Developer Mode display
export interface TokenMetadata {
  expiresAt: number;
  expiresIn: number;
  scope?: string;
  audience?: string;
  isValid: boolean;
  lastRefresh: number | null;
}

// API Log entry for IndexedDB
export interface ApiLogEntry {
  id?: number;
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  tenantId: string | null;
  featureArea: string;
  error?: string;
}

// Sage API specific types
export interface SageTenantRequest {
  name: string;
  businessName: string;
  productCode: string;
  platform: string;
  businessTypeCode: string;
}

export interface SageBankAccountRequest {
  name: string;
  accountNumber: string;
  sortCode: string;
  currencyISO: string;
  accountType: string;
}

export interface SageBankAccountResponse {
  Id: string;
  Name: string;
  BankName: string | null;
  External: string | null;
  IsActive: boolean;
  AccountNumber: string;
  CreditCardNumber: string | null;
  AccountType: string;
  CurrencyIso: string;
  SortCode: string;
  IBAN: string | null;
  BIC_SWIFT: string | null;
  Debit: {
    Base: number;
    Currency: number;
  };
  Credit: {
    Base: number;
    Currency: number;
  };
  Balance: {
    Base: number;
    Currency: number;
  };
  BankFeedBalance: {
    Base: number;
    Currency: number;
  };
  BankFeedId: string | null;
  PaymentsAcceptance: string | null;
  BankFeedLastBalanceDate: string | null;
  BankFeedLastTransactionDate: string | null;
  LedgerAccountId: string;
  ImportTransactionWorkflowStatusId: string | null;
  ImportTransactionWorkflowStatus: string | null;
  BankFeedPlaceholderBankUsed: string | null;
  BankFeedStatus: string | null;
  BankFeedStatusLastUpdatedAt: string | null;
}

export interface SageOpeningBalanceRequest {
  Date: string;
  Reference: string;
  BankAccount: {
    Id: string;
  };
  Amount: number;
  TreatAs: 'Debit' | 'Credit';
  Draft: string;
}

export interface SageFinancialYearRequest {
  startDate: string;
  endDate: string;
  periodType: string;
}

export interface SageBankPaymentRequest {
  date: string;
  bankAccountId: string;
  reference: string;
  description: string;
  amount: number;
  category?: string;
}

export interface SageBankReceiptRequest {
  date: string;
  bankAccountId: string;
  reference: string;
  description: string;
  amount: number;
  category?: string;
}

// Dimension types from Sage API
export interface SageDimension {
  Id: string;
  Code: string;
  Name: string;
  IsActive: boolean;
}

export interface SageDimensionTag {
  Id: string;
  Code: string;
  Name: string;
  IsActive: boolean;
}

export interface RequiredDimension {
  id: string;
  code: string;
  name: string;
}

// Transaction payload types for Sage journal API
export interface SageTransactionDimensionTag {
  Id: string;
  Percentage?: number;
}

export interface SageTransactionDimension {
  Dimension: {
    Id: string;
    AllocationType?: string;
  };
  DimensionTags: SageTransactionDimensionTag[];
}

export interface SageTransactionItem {
  Order: number;
  Date: string;
  AmountType: string;
  Amount: number;
  TreatAs: 'Debit' | 'Credit';
  Dimensions: SageTransactionDimension[];
}

export interface SageTransactionRequest {
  Date: string;
  Reference: string;
  BankAccount: {
    Id: string;
  };
  Items: SageTransactionItem[];
}

// Parsed CSV transaction with dimension selections
export interface ParsedCsvTransaction {
  rowIndex: number;
  type: 'payment' | 'receipt';
  date: string;
  description: string;
  reference: string;
  amount: number;
  category?: string;
  dimensionSelections: Record<string, string>; // dimensionCode -> tagCode
}

// CSV upload types
export interface CsvUploadResult {
  row: number;
  success: boolean;
  status?: number;
  message?: string;
  data?: BankTransaction;
}
