#!/usr/bin/env node

import { authenticate } from "@google-cloud/local-auth";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from 'url';

const drive = google.drive("v3");

const server = new Server(
  {
    name: "example-servers/gdrive",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const pageSize = 10;
  const params: any = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType)",
  };

  if (request.params?.cursor) {
    params.pageToken = request.params.cursor;
  }

  const res = await drive.files.list(params);
  const files = res.data.files!;

  return {
    resources: files.map((file) => ({
      uri: `gdrive:///${file.id}`,
      mimeType: file.mimeType,
      name: file.name,
    })),
    nextCursor: res.data.nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const fileId = request.params.uri.replace("gdrive:///", "");

  // First get file metadata to check mime type
  const file = await drive.files.get({
    fileId,
    fields: "mimeType",
  });

  // For Google Docs/Sheets/etc we need to export
  if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
    let exportMimeType: string;
    switch (file.data.mimeType) {
      case "application/vnd.google-apps.document":
        exportMimeType = "text/markdown";
        break;
      case "application/vnd.google-apps.spreadsheet":
        exportMimeType = "text/csv";
        break;
      case "application/vnd.google-apps.presentation":
        exportMimeType = "text/plain";
        break;
      case "application/vnd.google-apps.drawing":
        exportMimeType = "image/png";
        break;
      default:
        exportMimeType = "text/plain";
    }

    const res = await drive.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: "text" },
    );

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: exportMimeType,
          text: res.data,
        },
      ],
    };
  }

  // For regular files download content
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  const mimeType = file.data.mimeType || "application/octet-stream";
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: mimeType,
          text: Buffer.from(res.data as ArrayBuffer).toString("utf-8"),
        },
      ],
    };
  } else {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: mimeType,
          blob: Buffer.from(res.data as ArrayBuffer).toString("base64"),
        },
      ],
    };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search for files in Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "readGoogleDoc",
        description:
          "Lee el contenido de un Google Doc por secciones (tab) y chunks, permitiendo especificar el formato y la sección a leer.",
        inputSchema: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "ID del archivo de Google Docs a leer",
            },
            mime_type: {
              type: "string",
              description:
                "Formato para exportar el documento (por defecto text/plain)",
            },
            tab: {
              type: "string",
              description: "Nombre del heading/sección a leer (opcional)",
            },
            chunk_index: {
              type: "integer",
              description: "Índice del chunk a devolver (opcional, default 0)",
            },
            chunk_size: {
              type: "integer",
              description:
                "Tamaño máximo de caracteres por chunk (opcional, default 4000)",
            },
          },
          required: ["file_id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "search") {
    const userQuery = request.params.arguments?.query as string;
    const escapedQuery = userQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const formattedQuery = `fullText contains '${escapedQuery}'`;

    const res = await drive.files.list({
      q: formattedQuery,
      pageSize: 10,
      fields: "files(id, name, mimeType, modifiedTime, size)",
    });

    const fileList = res.data.files
      ?.map((file: any) => `${file.name} (${file.mimeType})`)
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `Found ${res.data.files?.length ?? 0} files:\n${fileList}`,
        },
      ],
      isError: false,
    };
  } else if (request.params.name === "readGoogleDoc") {
    const fileId: string = request.params.arguments?.file_id as string;
    const mimeType: string = (request.params.arguments?.mime_type ??
      "text/plain") as string;
    const tab: string | undefined = request.params.arguments?.tab as
      | string
      | undefined;
    const chunkIndex: number = (request.params.arguments?.chunk_index ??
      0) as number;
    const chunkSize: number = (request.params.arguments?.chunk_size ??
      4000) as number;

    // Si el formato no es text/plain, usa la API de exportación de Drive
    if (mimeType !== "text/plain" && mimeType !== "text/markdown") {
      const res = await drive.files.export(
        { fileId, mimeType },
        { responseType: "arraybuffer" }
      );
      const isText =
        mimeType.startsWith("text/") || mimeType === "application/json";
      if (isText) {
        const fullText = Buffer.from(res.data as ArrayBuffer).toString("utf-8");
        const totalChunks = Math.ceil(fullText.length / chunkSize);
        if (chunkIndex >= totalChunks) {
          throw new Error(
            `chunk_index fuera de rango. El documento tiene ${totalChunks} chunks.`
          );
        }
        const chunkText = fullText.slice(
          chunkIndex * chunkSize,
          (chunkIndex + 1) * chunkSize
        );
        return {
          content: [
            {
              type: "text",
              text: chunkText,
            },
          ],
          isError: false,
          meta: {
            chunk_index: chunkIndex,
            total_chunks: totalChunks,
            chunk_size: chunkSize,
            mime_type: mimeType,
            chars_total: fullText.length,
          },
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: "[Binary file content available as base64]",
            },
          ],
          isError: false,
          meta: {
            mime_type: mimeType,
          },
        };
      }
    }

    const docs = google.docs({ version: "v1" });
    const docRes = await docs.documents.get({ documentId: fileId });
    const body: Array<any> = docRes.data.body?.content || [];

    function extractText(elements: Array<any>): string {
      let text = "";
      for (const el of elements) {
        if (el.paragraph && el.paragraph.elements) {
          for (const pe of el.paragraph.elements) {
            if (pe.textRun && pe.textRun.content) {
              text += pe.textRun.content;
            }
          }
        }
      }
      return text;
    }

    let sectionElements: Array<any> = [];
    if (tab) {
      let inSection = false;
      for (const el of body) {
        if (
          el.paragraph &&
          el.paragraph.paragraphStyle &&
          el.paragraph.paragraphStyle.namedStyleType === "HEADING_1"
        ) {
          const headingText = extractText([el]).trim();
          if (headingText === tab) {
            inSection = true;
            continue;
          }
          if (inSection) break;
        }
        if (inSection) sectionElements.push(el);
      }
      if (!sectionElements.length) {
        throw new Error(
          `No se encontró la sección/tab "${tab}" en el documento.`
        );
      }
    } else {
      sectionElements = body;
    }

    const fullText: string = extractText(sectionElements);

    const totalChunks: number = Math.ceil(fullText.length / chunkSize);
    if (chunkIndex >= totalChunks) {
      throw new Error(
        `chunk_index fuera de rango. El documento tiene ${totalChunks} chunks.`
      );
    }
    const chunkText: string = fullText.slice(
      chunkIndex * chunkSize,
      (chunkIndex + 1) * chunkSize
    );

    return {
      content: [
        {
          type: "text",
          text: chunkText,
        },
      ],
      isError: false,
      meta: {
        chunk_index: chunkIndex,
        total_chunks: totalChunks,
        chunk_size: chunkSize,
        tab: tab || null,
        chars_total: fullText.length,
        mime_type: mimeType,
      },
    };
  }
  throw new Error("Tool not found");
});

const credentialsPath =
  process.env.GDRIVE_CREDENTIALS_PATH ||
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.gdrive-server-credentials.json"
  );

async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  const authOptions: any = {
    keyfilePath:
      process.env.GDRIVE_OAUTH_PATH ||
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../gcp-oauth.keys.json"
      ),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    access_type: "offline",
    prompt: "consent",
  };
  const auth = await authenticate(authOptions);
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
  console.log("Credentials saved. You can now run the server.");
}

async function loadCredentialsAndRunServer() {
  if (!fs.existsSync(credentialsPath)) {
    console.error(
      "Credentials not found. Please run with 'auth' argument first.",
    );
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const auth = new google.auth.OAuth2();
  auth.setCredentials(credentials);
  google.options({ auth });

  console.error("Credentials loaded. Starting server.");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}
