export type ContentStatus =
  | 'draft'
  | 'ai_analyzed'
  | 'human_approved'
  | 'sent_to_cms'
  | 'cms_error';

export interface ContentForm {
  title: string;
  description: string;
  category: string;
  tags: string;
}

export interface AiSuggestion {
  field: keyof ContentForm;
  originalValue: string;
  suggestedValue: string;
  reason: string;
}

export interface CmsPayload {
  title: string;
  description: string;
  category: string;
  tags: string[];
  approvedAt: string;
  status: ContentStatus;
}