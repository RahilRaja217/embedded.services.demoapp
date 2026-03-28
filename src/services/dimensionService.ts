import { apiClient } from '@/lib/apiClient';
import { Credentials, SageDimension, SageDimensionTag } from '@/types/sage';

export const dimensionService = {
  /**
   * Get all dimensions for a tenant
   * URL: /dimension/v1/tenant/{TenantId}/dimensions
   */
  async getDimensions(
    tenantId: string,
    credentials: Credentials
  ): Promise<SageDimension[]> {
    const response = await apiClient.get<SageDimension[]>(
      `/dimension/v1/tenant/${tenantId}/dimensions`,
      { tokenType: 'tenant', featureArea: 'dimensions', tenantId, credentials }
    );
    return response || [];
  },

  /**
   * Get tags for a specific dimension
   * URL: /dimension/v1/tenant/{TenantId}/dimensions/{dimensionId}/tags
   */
  async getDimensionTags(
    tenantId: string,
    dimensionId: string,
    credentials: Credentials
  ): Promise<SageDimensionTag[]> {
    const response = await apiClient.get<SageDimensionTag[]>(
      `/dimension/v1/tenant/${tenantId}/dimensions/${dimensionId}/tags`,
      { tokenType: 'tenant', featureArea: 'dimensions', tenantId, credentials }
    );
    return response || [];
  },
};
