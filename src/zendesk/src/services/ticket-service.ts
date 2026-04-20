/**
 * Service for Zendesk Support tickets
 */
import { BaseService } from "./base-service.js";
import { ZendeskTicket, ZendeskTicketComment } from "../types/ticket.types.js";
import { ZendeskConfig } from "../types/config.types.js";

const TICKET_FIELDS: (keyof ZendeskTicket)[] = [
  "id",
  "url",
  "subject",
  "description",
  "status",
  "priority",
  "type",
  "created_at",
  "updated_at",
  "requester_id",
  "assignee_id",
  "organization_id",
  "tags",
  "custom_fields",
];

/**
 * Service class for Zendesk Support tickets
 */
export class TicketService extends BaseService {
  /**
   * Creates a new TicketService instance
   * @param config Zendesk API configuration
   */
  constructor(config: ZendeskConfig) {
    super(config);
  }

  /**
   * Get detailed information about a specific Zendesk ticket.
   * Filters the API response to only include relevant fields, avoiding the
   * massive payload (~166K chars) that the raw Zendesk API returns.
   * @param ticketId The ID of the ticket to retrieve
   * @returns Ticket data with only the relevant fields
   */
  async getTicket(ticketId: number): Promise<ZendeskTicket> {
    try {
      const ticketUrl = `/tickets/${ticketId}.json`;
      const response = await this.makeRequest<{ ticket: Record<string, unknown> }>(ticketUrl);
      const raw = response.ticket;

      const filtered = Object.fromEntries(
        TICKET_FIELDS
          .filter((field) => field in raw)
          .map((field) => [field, raw[field]])
      ) as unknown as ZendeskTicket;

      return filtered;
    } catch (error) {
      console.error(`Failed to get ticket ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Get all comments for a specific Zendesk ticket
   * @param ticketId The ID of the ticket to get comments for
   * @returns Array of ticket comments
   */
  async getTicketComments(ticketId: number): Promise<ZendeskTicketComment[]> {
    try {
      const commentsUrl = `/tickets/${ticketId}/comments.json`;
      const response = await this.makeRequest<{ comments: ZendeskTicketComment[] }>(commentsUrl);
      return response.comments;
    } catch (error) {
      console.error(`Failed to get comments for ticket ${ticketId}:`, error);
      throw error;
    }
  }


}
