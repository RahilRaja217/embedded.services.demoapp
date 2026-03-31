import type { StatusResponseItem } from '@/types/docIntelligence';

export const mockStatusProcessing: StatusResponseItem = {
  orchestration_id: 'orch_5e8f2a1b-7c3d-4e9f-b6a2-1d0c8e3f5b7a',
  has_feedback: false,
  status: 'processing',
};

export const mockStatusCompleted: StatusResponseItem = {
  orchestration_id: 'orch_5e8f2a1b-7c3d-4e9f-b6a2-1d0c8e3f5b7a',
  has_feedback: false,
  status: 'completed',
};
