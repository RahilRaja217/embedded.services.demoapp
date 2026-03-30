import type { APWorkflowParameters, ExpenseWorkflowParameters } from '@/types/docIntelligence';

export const mockAPDefaults: APWorkflowParameters = {
  check_duplicates: true,
  split_extract: false,
  vms: { active: false },
  extraction: { einvoice_only: false },
};

export const mockExpenseDefaults: ExpenseWorkflowParameters = {
  check_duplicates: true,
};
