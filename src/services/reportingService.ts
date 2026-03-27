import { apiClient, apiRequest, ApiRequestOptions } from '@/lib/apiClient';
import { Credentials } from '@/types/sage';
import { generateIdempotencyKey } from '@/lib/idempotency';

/**
 * Sage Report Engine API integration
 * 
 * Two-step flow:
 * 1. POST .../ProfitAndLoss/run  → 201 with { Id: executionId }
 * 2. GET  .../executions/{executionId} → poll until 200 with full report data
 * 
 * PDF export:
 * 1. POST .../ProfitAndLoss/run?ExportType=pdf → 201 with { Id: executionId }
 * 2. GET  .../exports/{executionId} → poll until 200 with { Url: downloadUrl }
 */

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // 60 seconds max

/**
 * Poll a GET endpoint until we receive a 200 (not 202).
 */
async function pollUntilReady<T>(
  requestOpts: Omit<ApiRequestOptions, 'method'>,
  credentials: Credentials
): Promise<T> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const response = await apiRequest<T>(
      { ...requestOpts, method: 'GET', retries: 0 },
      credentials
    );

    if (response.status === 200 && response.data) {
      return response.data;
    }

    if (response.status === 202) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    // Any other status is an error
    throw new Error(response.error || `Unexpected status ${response.status}`);
  }

  throw new Error('Report generation timed out after 60 seconds');
}

export const reportingService = {
  /**
   * Run & fetch the Profit & Loss report for a tenant (two-step)
   */
  async getProfitAndLoss(
    tenantId: string,
    params: { startDate: string; endDate: string },
    credentials: Credentials
  ): Promise<any> {
    const body = {
      Filters: {
        Date: 'Custom',
        CustomDateRange: {
          StartDate: params.startDate,
          EndDate: params.endDate,
        },
        ExcludeZeroValues: true,
      },
    };

    // Step 1: POST to run the report
    const runResponse = await apiRequest<{ Id: string }>(
      {
        method: 'POST',
        endpoint: `/reportengine/v1/tenant/${tenantId}/reports/ProfitAndLoss/run`,
        body,
        tokenType: 'tenant',
        featureArea: 'reports',
        tenantId,
        idempotencyKey: generateIdempotencyKey(),
      },
      credentials
    );

    if (!runResponse.success || !runResponse.data?.Id) {
      throw new Error(runResponse.error || 'Failed to run P&L report');
    }

    const executionId = runResponse.data.Id;

    // Step 2: Poll until the execution result is ready (200)
    return await pollUntilReady<any>(
      {
        endpoint: `/reportengine/v1/tenant/${tenantId}/reports/executions/${executionId}`,
        tokenType: 'tenant',
        featureArea: 'reports',
        tenantId,
      },
      credentials
    );
  },

  /**
   * Export P&L as PDF (two-step) – returns the download URL
   */
  async exportProfitAndLossPdf(
    tenantId: string,
    params: { startDate: string; endDate: string },
    credentials: Credentials
  ): Promise<string> {
    const body = {
      Filters: {
        Date: 'Custom',
        CustomDateRange: {
          StartDate: params.startDate,
          EndDate: params.endDate,
        },
        ExcludeZeroValues: true,
      },
    };

    // Step 1: POST with ExportType=pdf
    const runResponse = await apiRequest<{ Id: string }>(
      {
        method: 'POST',
        endpoint: `/reportengine/v1/tenant/${tenantId}/reports/ProfitAndLoss/run?ExportType=pdf`,
        body,
        tokenType: 'tenant',
        featureArea: 'reports',
        tenantId,
        idempotencyKey: generateIdempotencyKey(),
      },
      credentials
    );

    if (!runResponse.success || !runResponse.data?.Id) {
      throw new Error(runResponse.error || 'Failed to run P&L PDF export');
    }

    const executionId = runResponse.data.Id;

    // Step 2: Poll until the export result is ready (200)
    const exportData = await pollUntilReady<{ URL: string }>(
      {
        endpoint: `/reportengine/v1/tenant/${tenantId}/reports/exports/${executionId}`,
        tokenType: 'tenant',
        featureArea: 'reports',
        tenantId,
      },
      credentials
    );
    
    if (!exportData?.URL) {
      throw new Error('Failed to fetch PDF export URL');
    }

    return exportData.URL;
  },
};
