/**
 * Type definitions for Zendesk Support tickets
 */

export interface ZendeskAttachment {
  id: number;
  file_name: string;
  content_url: string;
  content_type: string;
  size: number;
  inline: boolean;
}

export interface ZendeskTicketCustomField {
  id: number;
  value: string | null;
}

export interface ZendeskTicket {
  id: number;
  url: string;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  type: string | null;
  created_at: string;
  updated_at: string;
  requester_id: number;
  assignee_id: number | null;
  organization_id: number | null;
  tags: string[];
  custom_fields: ZendeskTicketCustomField[];
}

export interface ZendeskTicketComment {
  id: number;
  author_id: number;
  body: string;
  html_body: string;
  public: boolean;
  created_at: string;
  attachments?: ZendeskAttachment[];
}


