import type { DownloadResponse } from '@/types/docIntelligence';

export const mockDownloadResponse: DownloadResponse = {
  download_url: 'https://sage-ai-documents.s3.eu-west-1.amazonaws.com/demo/sample-document.pdf?X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=mock_signature_demo',
  details: null,
};
