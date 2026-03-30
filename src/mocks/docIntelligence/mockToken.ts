import type { TokenResponse } from '@/types/docIntelligence';

export const mockTokenResponse: TokenResponse = {
  access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNhZ2VfYWlfZGVtbyJ9.eyJpc3MiOiJodHRwczovL2lkLXNoYWRvdy5zYWdlLmNvbSIsInN1YiI6ImRlbW9AY2xpZW50cyIsImF1ZCI6IlNBSUwvbWVyY3VyeV9vcmNoZXN0cmF0aW9uIiwiZXhwIjoxNzM5OTk5OTk5LCJpYXQiOjE3Mzk5OTYzOTksInNjb3BlIjoiZXh0cmFjdGlvbiJ9.demo_signature_placeholder',
  token_type: 'Bearer',
  expires_in: 86400,
};
