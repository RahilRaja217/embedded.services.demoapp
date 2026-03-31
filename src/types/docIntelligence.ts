// ===== Sage AI Document Intelligence — API Types =====

export type WorkflowType = 'accounts_payable';

export type StatusType = 'processing' | 'completed' | 'error';

// ---- Auth ----
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ---- Company ----
export interface Localization {
  country?: string;
  province_code?: string;
  locale?: string;
}

export interface CompanyPreferences {
  base_currency?: string;
  vat_period_frequency?: string;
  date_format?: string;
  default_payment_term?: string;
}

export interface CompanyEvent {
  name: string;
  unique_id: string;
  created_at: string;
  legal_name?: string;
  is_active?: boolean;
  localization?: Localization;
  preferences?: CompanyPreferences;
  is_test_client?: boolean;
}

export interface CompanyCreateRequest {
  company: CompanyEvent;
}

export interface CompanyCreateResponse {
  customer_unique_id: string;
}

// ---- Defaults ----
export interface VMSSettings {
  active: boolean;
}

export interface ExtractionSetting {
  einvoice_only?: boolean;
}

export interface APWorkflowParameters {
  check_duplicates?: boolean;
  split_extract?: boolean;
  vms?: VMSSettings;
  extraction?: ExtractionSetting;
}

export interface DefaultsRequest<T> {
  customer_unique_id: string;
  new_defaults: T;
}

// ---- Run ----
export interface RunMetadata {
  file_extension: string;
  file_name?: string;
  file_upload_time?: string;
}

export interface RunRequest {
  input_data: string;
  customer_unique_id: string;
  metadata: RunMetadata;
  override_parameters?: Record<string, unknown>;
}

export interface RunResponse {
  orchestration_id: string;
}

// ---- Status ----
export interface StatusRequest {
  customer_unique_id: string;
  orchestration_ids: string[];
}

export interface StatusResponseItem {
  orchestration_id: string;
  has_feedback: boolean;
  status: StatusType;
  details?: string;
}

// ---- Results ----
export interface ResultsRequest {
  customer_unique_id: string;
  orchestration_ids: string[];
  include_ocr?: boolean;
}

export interface BasePrediction {
  value: string | null;
  confidence: number;
  tagged: boolean;
  coordinates?: Record<string, number[]>;
}

export interface HeaderFields {
  document_id: BasePrediction;
  document_type: BasePrediction;
  issue_date: BasePrediction;
  due_date: BasePrediction;
  currency: BasePrediction;
  total_amount: BasePrediction;
  total_without_tax: BasePrediction;
  tax_amount: BasePrediction;
  po_number: BasePrediction;
  reference_number: BasePrediction;
  discount_amount: BasePrediction;
  shipping_amount: BasePrediction;
  document_description: BasePrediction;
  document_language: BasePrediction;
  invoice_type: BasePrediction;
  [key: string]: BasePrediction;
}

export interface VendorFields {
  name: BasePrediction;
  address: BasePrediction;
  country: BasePrediction;
  email: BasePrediction;
  tax_id: BasePrediction;
  iban: BasePrediction;
  bic: BasePrediction;
  website: BasePrediction;
  vendor_phone_number: BasePrediction;
  company_id: BasePrediction;
  [key: string]: BasePrediction;
}

export interface RecipientFields {
  name: BasePrediction;
  address: BasePrediction;
  country: BasePrediction;
  [key: string]: BasePrediction;
}

export interface LineItem {
  line_id: BasePrediction;
  description: BasePrediction;
  quantity: BasePrediction;
  unit_price: BasePrediction;
  tax_amount: BasePrediction;
  tax_percentage: BasePrediction;
  total_amount: BasePrediction;
  total_without_tax: BasePrediction;
  [key: string]: BasePrediction;
}

export interface PaymentFields {
  payable_amount: BasePrediction;
  payment_method: BasePrediction;
  payment_term: BasePrediction;
  payment_term_string: BasePrediction;
  [key: string]: BasePrediction;
}

export interface TaxTableRow {
  tax_percentage: BasePrediction;
  tax: BasePrediction;
  taxable_amount: BasePrediction;
  total_amount: BasePrediction;
  description: BasePrediction;
  [key: string]: BasePrediction;
}

export interface Extraction {
  header: HeaderFields;
  vendor: VendorFields;
  recipient: RecipientFields;
  line_items: LineItem[];
  payment: PaymentFields;
  tax_table: TaxTableRow[];
}

export interface ResultMetadata {
  orchestration_id: string;
  file_name: string | null;
  file_upload_time: string;
  request_origin: string;
  is_einvoice: boolean;
  is_receipt: boolean;
}

export interface ExtractionResult {
  metadata: ResultMetadata;
  extraction: Extraction;
  vendor_from_directory?: Record<string, BasePrediction>;
}

// ---- Download ----
export interface DownloadRequest {
  customer_unique_id: string;
  orchestration_id: string;
}

export interface DownloadResponse {
  download_url: string;
  details: string | null;
}

// ---- Feedback ----
export interface FeedbackExtraction {
  header: Record<string, string | null>;
  vendor: Record<string, string | null>;
  recipient: Record<string, string | null>;
  line_items: Record<string, string | null>[];
  payment: Record<string, string | null>;
  tax_table: Record<string, string | null>[];
}

export interface FeedbackItem {
  orchestration_id: string;
  extraction: FeedbackExtraction;
}

export interface FeedbackRequest {
  customer_unique_id: string;
  feedback: FeedbackItem[];
}

export interface FeedbackResponse {
  message: string;
  results: { orchestration_id: string; status: string }[];
}

// ---- App State ----
export interface DocApiCall {
  method: string;
  url: string;
  requestBody: unknown;
  responseBody: unknown;
  timestamp: string;
}

export interface DocIntelligenceState {
  mode: 'mock' | 'live';
  workflow: WorkflowType;
  currentStep: number;
  completedSteps: number[];

  // Session auth (populated from Admin Settings)
  accessToken: string | null;
  customerUniqueId: string | null;

  // Workflow data
  orchestrationId: string | null;
  status: StatusType | null;
  results: ExtractionResult | null;
  feedbackSent: boolean;

  // Document preview
  documentPreviewUrl: string | null;
  documentFileType: string | null;
  downloadUrl: string | null;

  // API Inspector
  currentApiCall: DocApiCall | null;
}
