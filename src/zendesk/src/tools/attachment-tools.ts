/**
 * MCP Tools for Zendesk ticket attachments
 */
import { ZendeskClient } from "../client.js";
import { z } from "zod";

/**
 * Register attachment-related tools with the MCP server
 * @param server MCP server instance
 * @param zendeskClient Zendesk client instance
 */
export function registerAttachmentTools(server: any, zendeskClient: ZendeskClient) {
  // Register ticket attachments listing tool
  server.tool(
    "getTicketAttachments",
    "Lista todos los adjuntos de los comentarios de un ticket de Zendesk",
    {
      ticket_id: z.number().describe("El ID del ticket del cual obtener los adjuntos"),
    },
    async ({ ticket_id }: { ticket_id: number }) => {
      try {
        const data = await zendeskClient.getTicketAttachments(ticket_id);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error al obtener adjuntos del ticket: ${error}`,
            },
          ],
        };
      }
    },
  );

  // Register attachment download tool
  server.tool(
    "readAttachment",
    "Descarga y retorna el contenido de un adjunto. Para imagenes retorna un bloque de imagen que Claude puede interpretar directamente.",
    {
      content_url: z.string().describe("La URL del adjunto a descargar"),
      content_type: z.string().optional().describe("Tipo MIME del adjunto (opcional, se detecta automaticamente)"),
    },
    async ({ content_url, content_type }: { content_url: string; content_type?: string }) => {
      try {
        const blocks = await zendeskClient.readAttachment(content_url, content_type);

        return {
          content: blocks,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error al leer el adjunto: ${error}`,
            },
          ],
        };
      }
    },
  );
}
