# Servidor MCP de Google Workspace

Este es un servidor Model Context Protocol (MCP) para interactuar con Google Workspace.
Es un fork del repositorio original de [Google Workspace MCP](https://github.com/taylorwilsdon/google_workspace_mcp).

En Buk lo disponemos para agilizar interacciones en procesos de discovery de misiones y otros casos de uso que surgirán con la herramienta.

## Requisitos

- Python 3.11+
- uv (para ejecución local): Puedes instalarlo [aquí](https://docs.astral.sh/uv/getting-started/installation/)
- Un proyecto de Google Cloud con credenciales Oauth 2.0: Instalación y configuración a continuación...

## Instalación

### 1. Setup Proyecto de Google Cloud

Nota: Este requerimiento es temporal y estamos trabajando en facilitar la instalación con un proyecto común de Buk. Estimamos que no debe tomar más de 15-20 minutos configurar el proyecto para el servidor, y es algo que se debe realizar una única vez.

#### 1.1 Crea un nuevo proyecto de Google Cloud

Ingresa al siguiente [enlace](https://console.cloud.google.com/projectcreate) y crea un nuevo proyecto con tu correo de buk.
Recomendamos usar un nombre como "MCP Google Windsurf", de forma que sea fácil identificar y recordar el motivo de su creación.

#### 1.2 Habilita las APIs de Google Drive y Docs

Ingresa al enlace con el [listado de APIs de Google](https://console.cloud.google.com/workspace-api/products).
Inicialmente recomendamos activar:

- Google Drive API
- Google Docs API

#### 1.3 Crea credenciales OAuth 2.0 y Configura las URIs de Redirección

Ingresa al enlace con el [listado de clientes de google auth](https://console.cloud.google.com/auth/clients), ingresa a tu proyecto nuevo.
Debes crear un cliente con la siguiente configuración:

- Tipo de aplicación: "Aplicación Web"
- Nombre: "Auth MCP Google"

Luego, en la sección de "Origines autorizados de JavaScript", añade la URI: `http://localhost:8000`.
Además de agregar las siguientes URIs de redireccionamiento autorizados:

- `http://localhost:8000`
- `http://localhost:8000/oauth2callback`

#### 1.4 Descarga el archivo `client_secret.json`

Después de haber configurado y guardado las URIs de redirección, descarga el archivo `client_secret.json` del secreto del cliente.
Ese archivo debemos renombrarlo a `client_secret.json` y guardarlo en la raíz del directorio del servidor (`.../src/google_workspace_mcp/client_secret.json`).

#### 1.5 Registra tu correo Buk como usuario de test

Ingresa a la [pestaña de audiencia/público](https://console.cloud.google.com/auth/audience) y haz click en agregar usuario de test.
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

Nota: Puede ser que el puerto en WORKSPACE_MCP_PORT no sea el 8000 por algún conflicto con otro servicio corriendo en ese puerto, en ese caso, debes reemplazarlo con el puerto que estés usando, aquí en la variable y en las URIs de redirección del proyecto de Google descrito en el paso 1.3.

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

Nota: Como mencionamos, tambien están disponibles las herramientas de las otras apps de google workspace, aquí no las listamos pero están disponibles en el servidor para ser usadas con la configuración por defecto del repositorio base.

## Ejemplo de uso

### 1. Primera interacción para autenticación con Google

En la primera vez que uses este servidor, deberás realizar la autenticación con tu proyecto de Google (asegura de tener la variable de entorno configurada con tu correo de buk). Puedes usar un prompt como este:

```md
Necesito leer un documento de Google Docs, iniciemos el proceso de autenticación con Google.
```

Respuesta:

```md
Perfecto, he iniciado el proceso de autenticación con Google Docs para tu cuenta <tucorreo@buk.cl>

Por favor sigue estos pasos:

1. Haz clic en este enlace para autorizar el acceso a Google Docs: Click here to authorize Google Docs access
2. Completa el proceso de autorización en tu navegador - asegúrate de usar la cuenta <tucorreo@buk.cl>
3. Una vez completada la autorización, vuelve aquí y dime qué documento de Google Docs quieres leer (puedes proporcionarme el ID del documento o la URL completa)
4. ¡Listo! Una vez que completes la autorización, podremos acceder a tus documentos de Google Docs.
```

O bien, iniciar con la solicitud de lectura de un documento, y el servidor automáticamente pedirá iniciar con el proceso de autenticación.

### 2. Solicitud de lectura de un documento

Prompt 1:

```md
Lee el documento <https://docs.google.com/document/d/id_del_documento>
```

Prompt 2:

```md
Lee el documento de Google Docs con id <id_del_documento>
```

Respuesta:

```md
Perfecto, he accedido al documento.
...
Voy a leer el contenido de la pestaña principal para darte un resumen del documento.
<resumen_del_documento>

He actualizado la memoria con la información completa del documento.

¿Te gustaría que explore alguna pestaña específica del documento para obtener más detalles técnicos o de negocio sobre alguna misión en particular?

```

### 3. Solicitud de lectura de un tab/subtab específico del documento

Prompt:

```md
Lee la subtab <nombre_del_subtab> de la tab <nombre_de_la_tab>.
```

### 4. Teniendo el contenido del documento leido como contexto de la conversación podemos proceder a interactuar con él para cualquier propósito del discovery/delivery
