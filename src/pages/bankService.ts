import { apiClient } from '@/lib/apiClient';
import { BankAccount, SageBankAccountRequest, SageOpeningBalanceRequest, OpeningBalance, Credentials } from '@/types/sage';
import { generateIdempotencyKey } from '@/lib/idempotency';

export interface CreateBankAccountResponse {
  id: string;
  name: string;
  accountType: string;
  currencyIso: string;
  accountNumber: string;
  sortCode: string;
  balance: number;
  createdAt: string;
}

export interface CreateOpeningBalanceResponse {
  id: string;
  bankAccountId: string;
  amount: number;
  date: string;
}

export const bankService = {
  /**
   * Create a new bank account for a tenant
   * URL: /bank/v2/tenant/{TenantId}/bank-accounts
   */
  async createBankAccount(
    tenantId: string,
    data: SageBankAccountRequest,
    credentials: Credentials
  ): Promise<CreateBankAccountResponse> {
    const response = await apiClient.post<CreateBankAccountResponse>(
      `/bank/v2/tenant/${tenantId}/bank-accounts`,
      data,
      { 
        tokenType: 'tenant', 
        featureArea: 'bank-accounts',
        tenantId,
        credentials,
        idempotencyKey: generateIdempotencyKey()
      }
    );

    return response;
  },

  /**
   * Get all bank accounts for a tenant
   * URL: /bank/v2/tenant/{TenantId}/bank-accounts
   */
  async getBankAccounts(tenantId: string, credentials: Credentials): Promise<BankAccount[]> {
    const response = await apiClient.get<{ data: BankAccount[] }>(
      `/bank/v2/tenant/${tenantId}/bank-accounts`,
      { 
        tokenType: 'tenant', 
        featureArea: 'bank-accounts',
        tenantId,
        credentials
      }
    );

    return response.data || [];
  },

  /**
   * Set opening balance for a bank account
   * URL: /bank/v2/tenant/{TenantId}/bank-opening-balances
   */
  async createOpeningBalance(
    tenantId: string,
    data: SageOpeningBalanceRequest,
    credentials: Credentials
  ): Promise<CreateOpeningBalanceResponse> {
    const response = await apiClient.post<CreateOpeningBalanceResponse>(
      `/transaction/v2/tenant/${tenantId}/journals/759b6bdc-7200-09bc-e93b-9284bd95a344`,
      data,
      { 
        tokenType: 'tenant', 
        featureArea: 'bank-accounts',
        tenantId,
        credentials,
        idempotencyKey: generateIdempotencyKey()
      }
    );

    return response;
  },

  /**
   * Get opening balances for a tenant
   * URL: /bank/v2/tenant/{TenantId}/bank-opening-balances
   */
  async getOpeningBalances(tenantId: string, credentials: Credentials): Promise<OpeningBalance[]> {
    const response = await apiClient.get<{ data: OpeningBalance[] }>(
      `/bank/v2/tenant/${tenantId}/bank-opening-balances`,
      { 
        tokenType: 'tenant', 
        featureArea: 'bank-accounts',
        tenantId,
        credentials
      }
    );

    return response.data || [];
  },
};
