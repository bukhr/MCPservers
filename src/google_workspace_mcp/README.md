# Servidor MCP de Google Workspace

Este es un servidor Model Context Protocol (MCP) para interactuar con Google Workspace.
Es un fork del repositorio original de [Google Workspace MCP](https://github.com/taylorwilsdon/google_workspace_mcp).

En Buk lo disponemos para agilizar interacciones en procesos de discovery de misiones y otros casos de uso que surgirán con la herramienta.

## Requisitos previos

- Python 3.11+
- uv (para ejecución local)
- Un proyecto de Google Cloud con credenciales Oauth 2.0

## Configuración

### 1. Setup Proyecto de Google Cloud

#### 1.1 Crea un nuevo proyecto de Google Cloud

Ingresa al siguiente [enlace](https://console.cloud.google.com/projectcreate) y crea un nuevo proyecto.
Recomendamos usar un nombre como "Google Workspace MCP Server Windsurf", de forma que sea fácil identificar y recordar el motivo de su creación.

#### 1.2 Habilita las APIs de Google Drive y Docs

Ingresa al enlace con el [listado de APIs de Google](https://console.cloud.google.com/workspace-api/products).
Inicialmente recomendamos activar:

- Google Drive API
- Google Docs API

#### 1.3 Crea credenciales OAuth 2.0 y Configura las URIs de Redirección

Ingresa al enlace con el [listado de clientes de google auth](https://console.cloud.google.com/auth/clients), ingresa a tu proyecto nuevo.
Aquí necesitamos configurar el listado de origines autorizados de JavaScript con la URI: `http://localhost:8000`.
Además de agregar las siguientes URIs de redirección:

- `http://localhost:8000`
- `http://localhost:8000/oauth2callback`

#### 1.4 Descarga el archivo `client_secret.json`

Después de haber configurado y guardado las URIs de redirección, descarga el archivo `client_secret.json del secreto del cliente.
Ese archivo debemos renombrarlo a client_secret.json` y guardarlo en la raiz del repositorio.

#### 1.5 Registra tu correo Buk como usuario de test

Ingresa a la [pestaña de audiencia](https://console.cloud.google.com/auth/audience) y haz click en agregar usuario de test.
Debes ingresar tu correo de Buk.

### 2. Configurar Codeium MCP

- Añade la siguiente configuración a tu archivo de configuración de Codeium MCP (`~/.codeium/windsurf/mcp_config.json`):

```json
   {
     "mcpServers": {
       "google_workspace": {
        "command": "uv",
        "args": [
          "--directory",
          "path/to/google_workspace_mcp",
          "run",
          "main.py",
          "--tools",
          "docs"
        ],
        "env": {
          "OAUTHLIB_INSECURE_TRANSPORT": "1",
          "WORKSPACE_MCP_BASE_URI": "http://localhost",
          "WORKSPACE_MCP_PORT": "8000",
          "USER_GOOGLE_EMAIL": "tucorreo@buk.cl"
        }
      }
     }
   }
```

Para el nombre de usuario, normalmente es tu correo corporativo.

En `path/to/google_workspace_mcp` reemplaza `path/to` con la ruta absoluta en tu máquina al repo.

Nota: de momento recomendamos ejecutar el servidor con la flag `--tools docs` ya que son las herramientas que hemos validado y creemos
que son más útiles en Buk, de todas formas si quieres usar las demás herramientas, puedes eliminar el flag.

## Uso

Con esa configuración, el servidor MCP será iniciado automáticamente por Windsurf para usar cuando sea necesario.
Herramientas disponibles:

- `start_google_auth`: Iniciar el proceso de autenticación con Google
- `get_tab_content`: Lee y entrega el contenido de una tab/subtab específica de un documento.
- `read_doc_comments`: Lee y entrega los comentarios de un documento.
- `reply_to_comment`: Responde a un comentario específico de un documento.
- `create_doc_comment`: Crea un nuevo comentario en un documento.

## Primeras pruebas

Recomendamos probar las herramientas con los siguientes prompts de prueba:

### Discovery Técnico de Misiones

### Slicing tarjetas de Misiones

### Resumen de documentos de Tracks

## Para más información

Referenciar la [documentación del servidor original](https://github.com/taylorwilsdon/google_workspace_mcp?tab=readme-ov-file#google-workspace-mcp-server-)

Y cualquier duda la pueden hacer llegar en el canal @coord-guild-prod-windsurf. También queda abierto a contribuciones para ir mejorando cada vez más la experiencia y los casos de uso!
