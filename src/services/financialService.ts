import { apiClient } from '@/lib/apiClient';
import { FinancialYear, SageFinancialYearRequest, Credentials } from '@/types/sage';
import { generateIdempotencyKey } from '@/lib/idempotency';

export interface CreateFinancialYearResponse {
  id: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
}

export const financialService = {
  /**
   * Create a new financial year for a tenant
   * URL: /ledger/v1/tenant/{TenantId}/financial-years
   */
  async createFinancialYear(
    tenantId: string,
    data: SageFinancialYearRequest,
    credentials: Credentials
  ): Promise<CreateFinancialYearResponse> {
    const response = await apiClient.post<CreateFinancialYearResponse>(
      `/ledger/v1/tenant/${tenantId}/financial-years`,
      data,
      { 
        tokenType: 'tenant', 
        featureArea: 'financial-years', 
        tenantId, 
        credentials,
        idempotencyKey: generateIdempotencyKey()
      }
    );
    return response;
  },

  /**
   * Get all financial years for a tenant
   * URL: /ledger/v1/tenant/{TenantId}/financial-years
   */
  async getFinancialYears(tenantId: string, credentials: Credentials): Promise<FinancialYear[]> {
    const response = await apiClient.get<{ data: FinancialYear[] }>(
      `/ledger/v1/tenant/${tenantId}/financial-years`,
      { 
        tokenType: 'tenant', 
        featureArea: 'financial-years', 
        tenantId, 
        credentials 
      }
    );
    return response.data || [];
  },
};
