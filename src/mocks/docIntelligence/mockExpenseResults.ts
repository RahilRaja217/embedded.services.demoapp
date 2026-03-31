import type { ExtractionResult, BasePrediction } from '@/types/docIntelligence';

const p = (value: string | null, confidence: number, tagged = false, coordinates?: Record<string, number[]>): BasePrediction => ({
  value,
  confidence,
  tagged,
  ...(coordinates ? { coordinates } : {}),
});

const c = (x1: number, y1: number, x2: number, y2: number): Record<string, number[]> => ({
  x: [x1, x2, x2, x1],
  y: [y1, y1, y2, y2],
});

export const mockExpenseResults: ExtractionResult = {
  metadata: {
    orchestration_id: 'orch_5e8f2a1b-7c3d-4e9f-b6a2-1d0c8e3f5b7a',
    file_name: 'receipt_lunch_meeting.jpg',
    file_upload_time: '2026-02-16T12:15:00Z',
    request_origin: 'API',
    is_einvoice: false,
    is_receipt: true,
  },
  extraction: {
    header: {
      document_id: p('REC-94827', 0.92, false, c(0.25, 0.04, 0.75, 0.08)),
      document_type: p('receipt', 0.98, false, c(0.30, 0.09, 0.70, 0.12)),
      issue_date: p('2026-02-10', 0.95, false, c(0.25, 0.13, 0.75, 0.16)),
      due_date: p(null, 0.0),
      currency: p('GBP', 0.99, false, c(0.60, 0.17, 0.75, 0.20)),
      total_amount: p('86.40', 0.97, false, c(0.50, 0.82, 0.85, 0.87)),
      total_without_tax: p('72.00', 0.95, false, c(0.50, 0.74, 0.85, 0.78)),
      tax_amount: p('14.40', 0.94, false, c(0.50, 0.78, 0.85, 0.82)),
      po_number: p(null, 0.0),
      reference_number: p(null, 0.0),
      discount_amount: p('0.00', 0.90, false, c(0.50, 0.87, 0.85, 0.90)),
      shipping_amount: p(null, 0.0),
      document_description: p('Business lunch meeting', 0.68, false, c(0.10, 0.20, 0.90, 0.24)),
      document_language: p('EN', 0.99),
      invoice_type: p('Receipt', 0.97, false, c(0.30, 0.09, 0.70, 0.12)),
    },
    vendor: {
      name: p('The Ivy Restaurant', 0.96, false, c(0.15, 0.04, 0.85, 0.08)),
      address: p('1-5 West Street, London WC2H 9NQ', 0.88, false, c(0.15, 0.08, 0.85, 0.12)),
      country: p('GB', 0.98, false, c(0.35, 0.12, 0.65, 0.15)),
      email: p(null, 0.0),
      tax_id: p('GB 987 6543 21', 0.82, false, c(0.15, 0.88, 0.60, 0.91)),
      iban: p(null, 0.0),
      bic: p(null, 0.0),
      website: p('www.the-ivy.co.uk', 0.74, false, c(0.20, 0.15, 0.80, 0.18)),
      vendor_phone_number: p('+44 20 7836 4751', 0.79, false, c(0.20, 0.18, 0.80, 0.21)),
      company_id: p(null, 0.0),
    },
    recipient: {
      name: p(null, 0.0),
      address: p(null, 0.0),
      country: p('GB', 0.95),
    },
    line_items: [
      {
        line_id: p('1', 0.99),
        description: p('Grilled Sea Bass', 0.91),
        quantity: p('2', 0.93),
        unit_price: p('18.50', 0.90),
        tax_amount: p('7.40', 0.88),
        tax_percentage: p('20', 0.95),
        total_amount: p('44.40', 0.92),
        total_without_tax: p('37.00', 0.91),
      },
      {
        line_id: p('2', 0.99),
        description: p('Sparkling water (750ml)', 0.88),
        quantity: p('2', 0.95),
        unit_price: p('4.50', 0.92),
        tax_amount: p('1.80', 0.89),
        tax_percentage: p('20', 0.95),
        total_amount: p('10.80', 0.93),
        total_without_tax: p('9.00', 0.92),
      },
      {
        line_id: p('3', 0.99),
        description: p('Espresso Coffee', 0.86),
        quantity: p('2', 0.94),
        unit_price: p('3.50', 0.91),
        tax_amount: p('1.40', 0.88),
        tax_percentage: p('20', 0.95),
        total_amount: p('8.40', 0.92),
        total_without_tax: p('7.00', 0.91),
      },
      {
        line_id: p('4', 0.99),
        description: p('Service Charge', 0.82),
        quantity: p('1', 0.97),
        unit_price: p('19.00', 0.85),
        tax_amount: p('3.80', 0.83),
        tax_percentage: p('20', 0.94),
        total_amount: p('22.80', 0.87),
        total_without_tax: p('19.00', 0.86),
      },
    ],
    payment: {
      payable_amount: p('86.40', 0.96, false, c(0.50, 0.82, 0.85, 0.87)),
      payment_method: p('Contactless Card', 0.78, false, c(0.15, 0.91, 0.65, 0.94)),
      payment_term: p(null, 0.0),
      payment_term_string: p(null, 0.0),
    },
    tax_table: [
      {
        tax_percentage: p('20', 0.96),
        tax: p('14.40', 0.94),
        taxable_amount: p('72.00', 0.95),
        total_amount: p('86.40', 0.96),
        description: p('Standard Rate VAT', 0.87),
      },
    ],
  },
  expense_category: [
    {
      category_id: p('meals_entertainment', 0.91),
      description: p('Business Meals & Entertainment', 0.89),
    },
  ],
};
