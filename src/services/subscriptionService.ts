import { apiRequest } from '@/lib/apiClient';
import { Tenant, Credentials } from '@/types/sage';
import { getConfig } from '@/lib/configManager';
import { generateIdempotencyKey } from '@/lib/idempotency';

const SUBSCRIPTIONS_BASE_URL = 'https://api.sandbox.sbc.sage.com/slcsadapter/v2/subscriptions';

export interface CreateTenantRequest {
  ProductCode: string;
  ReferenceId: string;
  Business: {
    Name: string;
    BusinessTypeCode: string;
  };
  Platform: string;
}

export interface CreateTenantResponse {
  AccountId: string;
  ProductSubscriptionId: string;
  ProductLicenceIds: string[];
  BusinessId: string;
  TenantId: string;
}

export interface AsyncResponse {
  'retry-after': string;
  'x-correlation-id': string;
  'x-request-id': string;
}

export interface TenantCreationResult {
  id: string;
  name: string;
  businessName: string;
  status: string;
  createdAt: string;
}

/**
 * Callback for status updates during async operations
 */
export type StatusCallback = (status: string) => void;

/**
 * Sleep for a specified number of seconds
 */
function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export const subscriptionService = {
  /**
   * Create a new tenant via the subscription API
   * Handles 202 async responses with retry logic
   */
  async createTenant(
    data: { name: string; businessName: string }, 
    credentials: Credentials,
    onStatusChange?: StatusCallback
  ): Promise<TenantCreationResult> {
    const config = await getConfig();
    const creds = config.credentials || credentials;
    
    const idempotencyKey = generateIdempotencyKey();
    
    const requestBody: CreateTenantRequest = {
      ProductCode: creds.productCode || 'SAGE_ONE',
      ReferenceId: idempotencyKey,
      Business: {
        Name: data.businessName,
        BusinessTypeCode: creds.businessTypeCode || 'SOLE_TRADER',
      },
      Platform: creds.platform || 'UK',
    };

    onStatusChange?.('Creating tenant...');
    console.log("creating tenant");

    // Make initial request
    const response = await apiRequest<CreateTenantResponse | AsyncResponse>(
      {
        method: 'POST',
        endpoint: SUBSCRIPTIONS_BASE_URL,
        body: requestBody,
        tokenType: 'subscription',
        featureArea: 'tenants',
        idempotencyKey,
        retries: 0, // We'll handle retries ourselves for 202
      },
      creds
    );

    // Handle 202 Accepted - async processing
    if (response.status === 202) {
      const asyncHeader = response.headers as unknown as AsyncResponse;
      console.log(asyncHeader);
      const retryAfter = parseInt(asyncHeader['retry-after'] || '5', 10);
      
      onStatusChange?.(`Processing... waiting ${retryAfter} seconds`);
      
      await sleep(retryAfter);
      
      onStatusChange?.('Checking status...');
      
      // Retry with same idempotency key to get result
      const retryResponse = await apiRequest<CreateTenantResponse>(
        {
          method: 'POST',
          endpoint: SUBSCRIPTIONS_BASE_URL,
          body: requestBody,
          tokenType: 'subscription',
          featureArea: 'tenants',
          idempotencyKey, // Same key to get the result
          retries: 2,
        },
        creds
      );

      if (!retryResponse.success || !retryResponse.data) {
        throw new Error(retryResponse.error || 'Failed to get tenant creation result');
      }

      const tenantData = retryResponse.data;
      return {
        id: tenantData.TenantId,
        name: data.name,
        businessName: data.businessName,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }

    // Handle immediate 200/201 success
    if (response.success && response.data) {
      const tenantData = response.data as CreateTenantResponse;
      return {
        id: tenantData.TenantId,
        name: data.name,
        businessName: data.businessName,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
    }

    throw new Error(response.error || 'Failed to create tenant');
  },

  /**
   * Get all tenants from the subscription
   */
  async getTenants(credentials: Credentials): Promise<Tenant[]> {
    const response = await apiRequest<{ data: Tenant[] }>(
      {
        method: 'GET',
        endpoint: SUBSCRIPTIONS_BASE_URL,
        tokenType: 'subscription',
        featureArea: 'tenants',
      },
      credentials
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch tenants');
    }

    return response.data?.data || [];
  },

  /**
   * Get subscription metadata
   */
  async getSubscription(credentials: Credentials): Promise<{
    productCode: string;
    platform: string;
    businessTypeCodes: string[];
  }> {
    const response = await apiRequest<{
      productCode: string;
      platform: string;
      businessTypeCodes: string[];
    }>(
      {
        method: 'GET',
        endpoint: SUBSCRIPTIONS_BASE_URL,
        tokenType: 'subscription',
        featureArea: 'tenants',
      },
      credentials
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch subscription');
    }

    return response.data;
  },
};
