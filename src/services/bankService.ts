import { apiRequest } from '@/lib/apiClient';
import { BankAccount, SageBankAccountRequest, SageBankAccountResponse, SageOpeningBalanceRequest, OpeningBalance, Credentials } from '@/types/sage';
import { generateIdempotencyKey } from '@/lib/idempotency';

export type StatusCallback = (status: string) => void;

export interface CreateBankAccountResponse {
  Id: string;
}

export interface CreateOpeningBalanceResponse {
  Id: string;
}

export interface SageJournalEntry {
  Id: string;
  JournalType: {
    Id: string;
    Code: string;
  };
  Date: string;
  Reference: string | null;
  Status: string;
  TreatAs: 'Debit' | 'Credit';
  TotalAmount: {
    Base: number;
    Currency: number;
  };
  BankAccount: {
    Id: string;
    Name: string;
  };
  Currency: {
    Code: string;
    ExchangeRate: number;
  };
  TransactionNumber: string;
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export const bankService = {
  /**
   * Create a new bank account for a tenant
   * Handles 202 async responses with retry logic
   * URL: /bank/v2/tenant/{TenantId}/bank-accounts
   */
  async createBankAccount(
    tenantId: string,
    data: SageBankAccountRequest,
    credentials: Credentials,
    onStatusChange?: StatusCallback
  ): Promise<CreateBankAccountResponse> {
    const idempotencyKey = generateIdempotencyKey();
    const endpoint = `/bank/v2/tenant/${tenantId}/bank-accounts`;

    onStatusChange?.('Creating bank account...');

    const response = await apiRequest<CreateBankAccountResponse>(
      {
        method: 'POST',
        endpoint,
        body: data,
        tokenType: 'tenant',
        featureArea: 'bank-accounts',
        tenantId,
        idempotencyKey,
        retries: 0, // We handle retries ourselves for 202
      },
      credentials
    );

    // Handle 202 Accepted - async processing
    if (response.status === 202) {
      const retryAfter = parseInt(response.headers['retry-after'] || '3', 10);

      onStatusChange?.(`Processing... waiting ${retryAfter} seconds`);
      await sleep(retryAfter);

      onStatusChange?.('Checking status...');

      const retryResponse = await apiRequest<CreateBankAccountResponse>(
        {
          method: 'POST',
          endpoint,
          body: data,
          tokenType: 'tenant',
          featureArea: 'bank-accounts',
          tenantId,
          idempotencyKey, // Same key to get the result
          retries: 2,
        },
        credentials
      );

      if (!retryResponse.success || !retryResponse.data) {
        throw new Error(retryResponse.error || 'Failed to get bank account creation result');
      }

      return retryResponse.data;
    }

    // Handle immediate 200/201 success
    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to create bank account');
  },

  /**
   * Get all bank accounts for a tenant
   * URL: /bank/v2/tenant/{TenantId}/bank-accounts
   */
  async getBankAccounts(tenantId: string, credentials: Credentials): Promise<BankAccount[]> {
    const response = await apiRequest<SageBankAccountResponse[]>(
      {
        method: 'GET',
        endpoint: `/bank/v2/tenant/${tenantId}/bank-accounts`,
        tokenType: 'tenant',
        featureArea: 'bank-accounts',
        tenantId,
      },
      credentials
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch bank accounts');
    }

    // Map Sage API response to BankAccount, extracting Balance.Base
    return response.data.map((sageBankAccount: SageBankAccountResponse) => ({
      id: sageBankAccount.Id,
      tenantId,
      name: sageBankAccount.Name,
      accountNumber: sageBankAccount.AccountNumber,
      sortCode: sageBankAccount.SortCode,
      currencyISO: sageBankAccount.CurrencyIso,
      accountType: sageBankAccount.AccountType,
      balance: sageBankAccount.Balance.Base,
      createdAt: new Date().toISOString(),
    }));
  },

  /**
   * Set opening balance for a bank account
   * URL: /transaction/v2/tenant/{TenantId}/journals/{BankOpeningBalanceJournalTypeId}
   */
  async createOpeningBalance(
    tenantId: string,
    journalCode: string,
    data: SageOpeningBalanceRequest,
    credentials: Credentials,
    onStatusChange?: StatusCallback
  ): Promise<CreateOpeningBalanceResponse> {
    const idempotencyKey = generateIdempotencyKey();
    const endpoint = `/transaction/v2/tenant/${tenantId}/journals/${journalCode}`;

    onStatusChange?.('Setting opening balance...');

    const response = await apiRequest<CreateOpeningBalanceResponse>(
      {
        method: 'POST',
        endpoint,
        body: data,
        tokenType: 'tenant',
        featureArea: 'bank-accounts',
        tenantId,
        idempotencyKey,
        retries: 0,
      },
      credentials
    );

    // Handle 202 Accepted - async processing
    if (response.status === 202) {
      const retryAfter = parseInt(response.headers['retry-after'] || '3', 10);

      onStatusChange?.(`Processing... waiting ${retryAfter} seconds`);
      await sleep(retryAfter);

      onStatusChange?.('Checking status...');

      const retryResponse = await apiRequest<CreateOpeningBalanceResponse>(
        {
          method: 'POST',
          endpoint,
          body: data,
          tokenType: 'tenant',
          featureArea: 'bank-accounts',
          tenantId,
          idempotencyKey,
          retries: 2,
        },
        credentials
      );

      if (!retryResponse.success || !retryResponse.data) {
        throw new Error(retryResponse.error || 'Failed to get opening balance result');
      }

      return retryResponse.data;
    }

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to create opening balance');
  },

  /**
   * Get opening balances (journal entries) for a tenant
   * URL: /transaction/v1/tenant/{TenantId}/journals?start-date=...&end-date=...&$filter=...
   */
  async getOpeningBalances(
    tenantId: string,
    journalCode: string,
    startDate: string,
    endDate: string,
    credentials: Credentials
  ): Promise<OpeningBalance[]> {
    const filter = `(status eq 'completed') and (journaltype.id eq ${journalCode})`;
    const endpoint = `/transaction/v1/tenant/${tenantId}/journals?start-date=${startDate}&end-date=${endDate}&$filter=${encodeURIComponent(filter)}`;

    const response = await apiRequest<{ data: OpeningBalance[] }>(
      {
        method: 'GET',
        endpoint,
        tokenType: 'tenant',
        featureArea: 'bank-accounts',
        tenantId,
      },
      credentials
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch opening balances');
    }

    return response.data?.data || [];
  },

  /**
   * Get transactions for a specific bank account
   * URL: /transaction/v1/tenant/{TenantId}/journals?start-date=...&end-date=...&$filter=bankaccount.id eq {bankAccountId}&$orderby=date desc
   */
  async getAccountTransactions(
    tenantId: string,
    bankAccountId: string,
    startDate: string,
    endDate: string,
    credentials: Credentials
  ): Promise<SageJournalEntry[]> {
    const filter = `bankaccount.id eq ${bankAccountId}`;
    const endpoint = `/transaction/v1/tenant/${tenantId}/journals?start-date=${startDate}&end-date=${endDate}&$filter=${encodeURIComponent(filter)}&$orderby=${encodeURIComponent('date desc')}`;

    const response = await apiRequest<SageJournalEntry[]>(
      {
        method: 'GET',
        endpoint,
        tokenType: 'tenant',
        featureArea: 'bank-accounts',
        tenantId,
      },
      credentials
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch transactions');
    }

    return response.data || [];
  },
};
