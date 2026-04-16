/**
 * Service for downloading and processing Zendesk ticket attachments
 */
import { BaseService } from "./base-service.js";
import { ZendeskAttachment, ZendeskTicketComment } from "../types/ticket.types.js";
import { ZendeskConfig } from "../types/config.types.js";
import { cleanHtmlContent } from "../utils/html-cleaner.js";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export interface AttachmentWithCommentId {
  attachment: ZendeskAttachment;
  comment_id: number;
}

export type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/**
 * Service class for downloading and processing Zendesk attachments
 */
export class AttachmentService extends BaseService {
  /**
   * Creates a new AttachmentService instance
   * @param config Zendesk API configuration
   */
  constructor(config: ZendeskConfig) {
    super(config);
  }

  /**
   * List all attachments from all comments of a ticket
   * @param ticketId The ID of the ticket
   * @returns Array of attachments with their parent comment ID
   */
  async getTicketAttachments(ticketId: number): Promise<AttachmentWithCommentId[]> {
    try {
      const commentsUrl = `/tickets/${ticketId}/comments.json`;
      const response = await this.makeRequest<{ comments: ZendeskTicketComment[] }>(commentsUrl);
      const comments = response.comments;

      const result: AttachmentWithCommentId[] = [];
      for (const comment of comments) {
        if (comment.attachments && comment.attachments.length > 0) {
          for (const attachment of comment.attachments) {
            result.push({ attachment, comment_id: comment.id });
          }
        }
      }
      return result;
    } catch (error) {
      console.error(`Failed to get attachments for ticket ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Download and return the content of an attachment as MCP content blocks
   * @param contentUrl The URL of the attachment
   * @param contentType Optional MIME type hint (detected from response if not provided)
   * @returns Array of MCP content blocks (text or image)
   */
  async readAttachment(contentUrl: string, contentType?: string): Promise<McpContentBlock[]> {
    try {
      const response = await this.httpClient.get(contentUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data as ArrayBuffer);

      if (buffer.length > MAX_ATTACHMENT_SIZE) {
        return [
          {
            type: "text",
            text: `El adjunto supera el tamaño máximo permitido de 10 MB (tamaño actual: ${(buffer.length / 1024 / 1024).toFixed(2)} MB).`,
          },
        ];
      }

      const mime = contentType || (response.headers["content-type"] as string) || "application/octet-stream";
      // Normalize: strip parameters like charset
      const mimeBase = mime.split(";")[0].trim().toLowerCase();

      if (mimeBase.startsWith("image/")) {
        return [
          {
            type: "image",
            data: buffer.toString("base64"),
            mimeType: mimeBase,
          },
        ];
      }

      if (mimeBase === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        return [
          {
            type: "text",
            text: pdfData.text,
          },
        ];
      }

      if (mimeBase === "text/html") {
        const raw = buffer.toString("utf-8");
        const cleaned = cleanHtmlContent(raw) ?? raw;
        return [
          {
            type: "text",
            text: cleaned,
          },
        ];
      }

      if (mimeBase.startsWith("text/")) {
        return [
          {
            type: "text",
            text: buffer.toString("utf-8"),
          },
        ];
      }

      return [
        {
          type: "text",
          text: `Tipo de archivo no soportado para lectura: ${mimeBase}`,
        },
      ];
    } catch (error) {
      console.error(`Failed to read attachment at ${contentUrl}:`, error);
      throw error;
    }
  }
}
