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

export const mockAPResults: ExtractionResult = {
  metadata: {
    orchestration_id: 'orch_5e8f2a1b-7c3d-4e9f-b6a2-1d0c8e3f5b7a',
    file_name: 'invoice_acme_2026.pdf',
    file_upload_time: '2026-02-16T10:30:00Z',
    request_origin: 'API',
    is_einvoice: false,
    is_receipt: false,
  },
  extraction: {
    header: {
      document_id: p('INV-2026-0042', 0.98, false, c(0.55, 0.06, 0.88, 0.10)),
      document_type: p('invoice', 0.97, false, c(0.55, 0.11, 0.75, 0.14)),
      issue_date: p('2026-01-15', 0.96, false, c(0.55, 0.18, 0.78, 0.21)),
      due_date: p('2026-02-14', 0.94, false, c(0.55, 0.22, 0.78, 0.25)),
      currency: p('GBP', 0.99, false, c(0.55, 0.26, 0.66, 0.29)),
      total_amount: p('2,847.60', 0.97, false, c(0.62, 0.84, 0.92, 0.88)),
      total_without_tax: p('2,373.00', 0.96, false, c(0.62, 0.76, 0.92, 0.80)),
      tax_amount: p('474.60', 0.95, false, c(0.62, 0.80, 0.92, 0.84)),
      po_number: p('PO-8834', 0.88, false, c(0.55, 0.30, 0.75, 0.33)),
      reference_number: p('REF-UK-2026-118', 0.91, false, c(0.55, 0.34, 0.88, 0.37)),
      discount_amount: p('0.00', 0.93, false, c(0.62, 0.88, 0.82, 0.91)),
      shipping_amount: p('45.00', 0.85, false, c(0.62, 0.91, 0.82, 0.94)),
      document_description: p('Office supplies and IT equipment', 0.72, false, c(0.06, 0.42, 0.50, 0.45)),
      document_language: p('EN', 0.99),
      invoice_type: p('Standard Invoice', 0.95, false, c(0.55, 0.14, 0.85, 0.17)),
    },
    vendor: {
      name: p('Acme Office Supplies Ltd', 0.97, false, c(0.05, 0.04, 0.42, 0.08)),
      address: p('42 Commerce Street, London EC2A 4NE', 0.92, false, c(0.05, 0.08, 0.45, 0.12)),
      country: p('GB', 0.98, false, c(0.05, 0.12, 0.18, 0.15)),
      email: p('accounts@acmeoffice.co.uk', 0.89, false, c(0.05, 0.15, 0.42, 0.18)),
      tax_id: p('GB 123 4567 89', 0.94, false, c(0.05, 0.18, 0.35, 0.21)),
      iban: p('GB29 NWBK 6016 1331 9268 19', 0.91, false, c(0.05, 0.92, 0.45, 0.95)),
      bic: p('NWBKGB2L', 0.93, false, c(0.50, 0.92, 0.72, 0.95)),
      website: p('www.acmeoffice.co.uk', 0.78, false, c(0.05, 0.21, 0.38, 0.24)),
      vendor_phone_number: p('+44 20 7946 0958', 0.86, false, c(0.05, 0.24, 0.35, 0.27)),
      company_id: p('08765432', 0.90, false, c(0.05, 0.27, 0.28, 0.30)),
    },
    recipient: {
      name: p('Sage Software Ltd', 0.96, false, c(0.05, 0.35, 0.40, 0.38)),
      address: p('North Park, Newcastle upon Tyne NE13 9AA', 0.93, false, c(0.05, 0.38, 0.48, 0.42)),
      country: p('GB', 0.99, false, c(0.05, 0.42, 0.18, 0.45)),
    },
    line_items: [
      {
        line_id: p('1', 0.99),
        description: p('Premium A4 Copy Paper (5 reams)', 0.95),
        quantity: p('10', 0.97),
        unit_price: p('24.50', 0.96),
        tax_amount: p('49.00', 0.94),
        tax_percentage: p('20', 0.96),
        total_amount: p('294.00', 0.97),
        total_without_tax: p('245.00', 0.96),
      },
      {
        line_id: p('2', 0.99),
        description: p('Wireless Keyboard & Mouse Combo', 0.93),
        quantity: p('5', 0.98),
        unit_price: p('89.00', 0.95),
        tax_amount: p('89.00', 0.94),
        tax_percentage: p('20', 0.96),
        total_amount: p('534.00', 0.96),
        total_without_tax: p('445.00', 0.95),
      },
      {
        line_id: p('3', 0.99),
        description: p('27" LED Monitor - 4K UHD', 0.91),
        quantity: p('3', 0.98),
        unit_price: p('449.00', 0.96),
        tax_amount: p('269.40', 0.93),
        tax_percentage: p('20', 0.96),
        total_amount: p('1,616.40', 0.95),
        total_without_tax: p('1,347.00', 0.94),
      },
      {
        line_id: p('4', 0.99),
        description: p('Ergonomic Desk Chair - Mesh Back', 0.87),
        quantity: p('2', 0.97),
        unit_price: p('168.00', 0.94),
        tax_amount: p('67.20', 0.92),
        tax_percentage: p('20', 0.96),
        total_amount: p('403.20', 0.93),
        total_without_tax: p('336.00', 0.93),
      },
    ],
    payment: {
      payable_amount: p('2,847.60', 0.97, false, c(0.62, 0.84, 0.92, 0.88)),
      payment_method: p('Bank Transfer', 0.82, false, c(0.05, 0.88, 0.35, 0.91)),
      payment_term: p('Net 30', 0.76, false, c(0.05, 0.84, 0.28, 0.87)),
      payment_term_string: p('Payment due within 30 days of invoice date', 0.69, false, c(0.05, 0.80, 0.55, 0.83)),
    },
    tax_table: [
      {
        tax_percentage: p('20', 0.97),
        tax: p('474.60', 0.95),
        taxable_amount: p('2,373.00', 0.96),
        total_amount: p('2,847.60', 0.96),
        description: p('Standard Rate VAT', 0.88),
      },
    ],
  },
};
