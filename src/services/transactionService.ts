import { apiClient, apiRequest } from '@/lib/apiClient';
import { 
  BankTransaction, 
  CsvUploadResult, 
  Credentials, 
  ParsedCsvTransaction,
  SageTransactionRequest,
  SageTransactionDimension,
  RequiredDimension
} from '@/types/sage';
import { generateIdempotencyKey } from '@/lib/idempotency';

// Default Journal IDs for payments and receipts (fallback if not configured in Admin)
const DEFAULT_PAYMENT_JOURNAL_ID = '7078df86-3c36-f139-1b3a-390d1197b0f8';
const DEFAULT_RECEIPT_JOURNAL_ID = 'd6be52be-4361-1dc6-21f4-f895bba7ed5a';

export interface CreateTransactionResponse {
  Id?: string;
  id?: string;
}

export const transactionService = {
  /**
   * Build the Dimensions array for a transaction request.
   * Returns a plain Array to avoid any object-with-numeric-keys serialisation bug.
   */
  buildDimensions(
    dimensionSelections: Record<string, string>,
    requiredDimensions: RequiredDimension[]
  ): SageTransactionDimension[] {
    const dims: SageTransactionDimension[] = [];

    for (const dim of Array.from(requiredDimensions)) {
      const tagCode = dimensionSelections[dim.code];
      if (!tagCode) continue;

      const isAllowability = dim.name.toLowerCase().includes('allowability') || 
                             dim.code.toLowerCase().includes('allowability');

      dims.push({
        Dimension: {
          Id: dim.code,
          ...(isAllowability ? { AllocationType: 'Percentage' } : {}),
        },
        DimensionTags: [
          {
            Id: tagCode,
            ...(isAllowability ? { Percentage: 100 } : {}),
          },
        ],
      });
    }

    return dims;
  },

  /**
   * Create a single transaction (payment or receipt) with the correct Sage payload
   */
  async createTransaction(
    tenantId: string,
    bankAccountId: string,
    tx: ParsedCsvTransaction,
    requiredDimensions: RequiredDimension[],
    credentials: Credentials
  ): Promise<CreateTransactionResponse> {
    const journalTypeId = tx.type === 'payment' 
      ? (credentials.bankPaymentJournalCode || DEFAULT_PAYMENT_JOURNAL_ID)
      : (credentials.bankReceiptJournalCode || DEFAULT_RECEIPT_JOURNAL_ID);
    const treatAs = tx.type === 'receipt' ? 'Debit' : 'Credit';
    
    const dimensions = this.buildDimensions(tx.dimensionSelections, requiredDimensions);

    // Build the JSON string manually to guarantee arrays stay as arrays
    const dimensionsJsonStr = dimensions.map(d => {
      const allocType = d.Dimension.AllocationType
        ? `,"AllocationType":"${d.Dimension.AllocationType}"` : '';
      const tagsStr = d.DimensionTags.map(t => {
        const pct = t.Percentage !== undefined ? `,"Percentage":${t.Percentage}` : '';
        return `{"Id":"${t.Id}"${pct}}`;
      }).join(',');
      return `{"Dimension":{"Id":"${d.Dimension.Id}"${allocType}},"DimensionTags":[${tagsStr}]}`;
    }).join(',');

    const bodyString = `{"Date":"${tx.date}","Reference":"${tx.reference}","BankAccount":{"Id":"${bankAccountId}"},"Draft":false,"Items":[{"Order":0,"Date":"${tx.date}","AmountType":"TaxesExcluded","Amount":${tx.amount},"TreatAs":"${treatAs}","Dimensions":[${dimensionsJsonStr}]}]}`;

    const idempotencyKey = generateIdempotencyKey();
    const response = await apiRequest<CreateTransactionResponse>(
      {
        method: 'POST',
        endpoint: `/transaction/v2/tenant/${tenantId}/journals/${journalTypeId}`,
        rawBody: bodyString,
        tokenType: 'tenant',
        featureArea: 'transactions',
        tenantId,
        idempotencyKey,
      },
      credentials
    );

    // Handle 202 async processing
    if (response.status === 202) {
      const retryAfter = parseInt(response.headers['retry-after'] || '2', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

      const followUp = await apiRequest<CreateTransactionResponse>(
        {
          method: 'POST',
          endpoint: `/transaction/v2/tenant/${tenantId}/journals/${journalTypeId}`,
          rawBody: bodyString,
          tokenType: 'tenant',
          featureArea: 'transactions',
          tenantId,
          idempotencyKey,
        },
        credentials
      );

      if (!followUp.success) {
        throw new Error(followUp.error || `Follow-up failed: ${followUp.status}`);
      }
      return followUp.data!;
    }

    if (!response.success) {
      throw new Error(response.error || `Request failed: ${response.status}`);
    }
    return response.data!;
  },

  /**
   * Upload parsed CSV transactions with dimension selections
   */
  async uploadTransactions(
    tenantId: string,
    bankAccountId: string,
    transactions: ParsedCsvTransaction[],
    requiredDimensions: RequiredDimension[],
    credentials: Credentials
  ): Promise<CsvUploadResult[]> {
    const results: CsvUploadResult[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      try {
        const response = await this.createTransaction(
          tenantId,
          bankAccountId,
          tx,
          requiredDimensions,
          credentials
        );

        results.push({
          row: tx.rowIndex,
          success: true,
          status: 201,
          data: {
            id: response.Id || response.id || '',
            tenantId,
            bankAccountId,
            type: tx.type,
            date: tx.date,
            description: tx.description,
            reference: tx.reference,
            amount: tx.amount,
            category: tx.category || 'Uncategorized',
          },
        });
      } catch (error: any) {
        results.push({
          row: tx.rowIndex,
          success: false,
          status: error.status || 500,
          message: error.message || 'Unknown error',
        });
      }
    }

    return results;
  },
};
