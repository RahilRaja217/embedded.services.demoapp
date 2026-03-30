import type {
  TokenResponse,
  CompanyCreateRequest,
  CompanyCreateResponse,
  DefaultsRequest,
  APWorkflowParameters,
  ExpenseWorkflowParameters,
  RunRequest,
  RunResponse,
  StatusRequest,
  StatusResponseItem,
  ResultsRequest,
  ExtractionResult,
  FeedbackRequest,
  FeedbackResponse,
  DownloadRequest,
  DownloadResponse,
  WorkflowType,
  DocApiCall,
} from '@/types/docIntelligence';
import { mockTokenResponse } from '@/mocks/docIntelligence/mockToken';
import { mockCompanyResponse } from '@/mocks/docIntelligence/mockCompany';
import { mockAPDefaults, mockExpenseDefaults } from '@/mocks/docIntelligence/mockDefaults';
import { mockRunResponse } from '@/mocks/docIntelligence/mockRunResponse';
import { mockStatusProcessing, mockStatusCompleted } from '@/mocks/docIntelligence/mockStatusResponses';
import { mockAPResults } from '@/mocks/docIntelligence/mockAPResults';
import { mockExpenseResults } from '@/mocks/docIntelligence/mockExpenseResults';
import { mockDownloadResponse } from '@/mocks/docIntelligence/mockDownloadResponse';

const SANDBOX_URL = 'https://models.mercury.pre-production.eu-west-1.sageai.sagecloudops.com/external';
const TOKEN_URL = 'https://id-shadow.sage.com/oauth/token';
const DEV_SANDBOX_PROXY_URL = '/doc-ai';
const DEV_TOKEN_PROXY_URL = '/doc-auth/oauth/token';

function getLiveSandboxBaseUrl(): string {
  return import.meta.env.DEV ? DEV_SANDBOX_PROXY_URL : SANDBOX_URL;
}

function getLiveTokenUrl(): string {
  return import.meta.env.DEV ? DEV_TOKEN_PROXY_URL : TOKEN_URL;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let onApiCall: ((call: DocApiCall) => void) | null = null;

export function setDocApiCallListener(listener: (call: DocApiCall) => void) {
  onApiCall = listener;
}

function recordApiCall(method: string, url: string, requestBody: unknown, responseBody: unknown) {
  const call: DocApiCall = {
    method,
    url,
    requestBody,
    responseBody,
    timestamp: new Date().toISOString(),
  };
  onApiCall?.(call);
  return call;
}

// ===== Auth =====
export async function docGetToken(
  clientId: string,
  clientSecret: string,
  mode: 'mock' | 'live'
): Promise<TokenResponse> {
  const requestUrl = getLiveTokenUrl();
  const displayUrl = TOKEN_URL;
  const body = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    audience: 'SAIL/mercury_orchestration',
  };

  if (mode === 'mock') {
    await delay(800);
    const response = mockTokenResponse;
    recordApiCall('POST', displayUrl, body, response);
    return response;
  }

  const formBody = new URLSearchParams(body as Record<string, string>);
  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, body, response);
  return response;
}

// ===== Company =====
export async function docCreateCompany(
  request: CompanyCreateRequest,
  token: string,
  mode: 'mock' | 'live'
): Promise<CompanyCreateResponse> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/company/create`;
  const displayUrl = `${SANDBOX_URL}/v2/company/create`;

  if (mode === 'mock') {
    await delay(600);
    recordApiCall('POST', displayUrl, request, mockCompanyResponse);
    return mockCompanyResponse;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, request, response);
  return response;
}

// ===== Defaults =====
export async function docSetDefaults(
  workflow: WorkflowType,
  request: DefaultsRequest<APWorkflowParameters | ExpenseWorkflowParameters>,
  token: string,
  mode: 'mock' | 'live'
): Promise<unknown> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/workflow/${workflow}/defaults`;
  const displayUrl = `${SANDBOX_URL}/v2/workflow/${workflow}/defaults`;

  if (mode === 'mock') {
    await delay(500);
    const response = {
      new_defaults: workflow === 'accounts_payable' ? mockAPDefaults : mockExpenseDefaults,
    };
    recordApiCall('POST', displayUrl, request, response);
    return response;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, request, response);
  return response;
}

// ===== Run =====
export async function docUploadDocument(
  workflow: WorkflowType,
  request: RunRequest,
  token: string,
  mode: 'mock' | 'live'
): Promise<RunResponse> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/workflow/${workflow}/run`;
  const displayUrl = `${SANDBOX_URL}/v2/workflow/${workflow}/run`;

  const displayRequest = {
    ...request,
    input_data: request.input_data.substring(0, 80) + '... [base64 truncated]',
  };

  if (mode === 'mock') {
    await delay(1000);
    recordApiCall('POST', displayUrl, displayRequest, mockRunResponse);
    return mockRunResponse;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, displayRequest, response);
  return response;
}

// ===== Status =====
let statusPollCount = 0;

export function resetDocStatusPoll() {
  statusPollCount = 0;
}

export async function docCheckStatus(
  workflow: WorkflowType,
  request: StatusRequest,
  token: string,
  mode: 'mock' | 'live'
): Promise<StatusResponseItem[]> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/workflow/${workflow}/status`;
  const displayUrl = `${SANDBOX_URL}/v2/workflow/${workflow}/status`;

  if (mode === 'mock') {
    await delay(1500);
    statusPollCount++;
    const response = statusPollCount >= 2 ? [mockStatusCompleted] : [mockStatusProcessing];
    recordApiCall('POST', displayUrl, request, response);
    return response;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, request, response);
  return response;
}

// ===== Results =====
export async function docGetResults(
  workflow: WorkflowType,
  request: ResultsRequest,
  token: string,
  mode: 'mock' | 'live'
): Promise<ExtractionResult[]> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/workflow/${workflow}/results`;
  const displayUrl = `${SANDBOX_URL}/v2/workflow/${workflow}/results`;

  if (mode === 'mock') {
    await delay(700);
    const results = workflow === 'accounts_payable' ? [mockAPResults] : [mockExpenseResults];
    recordApiCall('POST', displayUrl, request, { results });
    return results;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const data = await res.json();
  recordApiCall('POST', displayUrl, request, data);
  return data.results;
}

// ===== Feedback =====
export async function docSendFeedback(
  workflow: WorkflowType,
  request: FeedbackRequest,
  token: string,
  mode: 'mock' | 'live'
): Promise<FeedbackResponse> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/workflow/${workflow}/feedback`;
  const displayUrl = `${SANDBOX_URL}/v2/workflow/${workflow}/feedback`;

  if (mode === 'mock') {
    await delay(800);
    const response: FeedbackResponse = {
      message: 'Feedback received successfully',
      results: request.feedback.map(f => ({ orchestration_id: f.orchestration_id, status: 'success' })),
    };
    recordApiCall('POST', displayUrl, request, response);
    return response;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, request, response);
  return response;
}

// ===== Download =====
export async function docDownloadDocument(
  workflow: WorkflowType,
  request: DownloadRequest,
  token: string,
  mode: 'mock' | 'live'
): Promise<DownloadResponse> {
  const requestUrl = `${getLiveSandboxBaseUrl()}/v2/workflow/${workflow}/download`;
  const displayUrl = `${SANDBOX_URL}/v2/workflow/${workflow}/download`;

  if (mode === 'mock') {
    await delay(500);
    recordApiCall('POST', displayUrl, request, mockDownloadResponse);
    return mockDownloadResponse;
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  const response = await res.json();
  recordApiCall('POST', displayUrl, request, response);
  return response;
}
