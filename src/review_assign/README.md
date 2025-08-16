# Servidor MCP para Asignación Automática de Revisores

Este es un servidor de Protocolo de Control de Máquina (MCP) para la asignación automática de revisores a Pull Requests en GitHub basado en la carga de trabajo previa.

## Requisitos previos

- Node.js (v16 o superior)
- npm o yarn
- GitHub CLI (`gh`) instalado y configurado
- Acceso a los repositorios relevantes a través de GitHub CLI

## Funcionalidades

- Asignación automática de revisores basada en la carga de trabajo previa
- Notificaciones a Google Chat a través de webhooks
- Configuración personalizable de equipos y repositorios

## Configuración

1. Instalar dependencias dentro de esta carpeta:

   ```bash
   npm install
   ```

2. Configurar Codeium MCP:
   - Añadir la siguiente configuración a tu archivo de configuración de Codeium MCP (`~/.codeium/windsurf/mcp_config.json`):

   ```json
   {
     "mcpServers": {
       "review_assign": {
         "command": "npx",
         "args": [
           "-y",
           "tsx",
           "/path/to/MCPservers/src/googlechat/main.ts"
         ]
       }
     },
     "reviewAssign": {
       "teams": [
         {
           "team_name": "Equipo Ejemplo",
           "repositories": ["bukhr/k8s", "bukhr/otro-repo"],
           "members": [
             {
               "name": "Nombre Completo 1",
               "email": "usuario1@ejemplo.com",
               "nickname_github": "usuario1"
             },
             {
               "name": "Nombre Completo 2",
               "email": "usuario2@ejemplo.com",
               "nickname_github": "usuario2"
             }
           ],
           "webhook_url": "https://chat.googleapis.com/v1/spaces/XXXX/messages?key=YYYY"
         }
       ],
       "reviewDays": 15
     }
   }
   ```

   Reemplaza `/path/to/` con la ruta absoluta en tu sistema donde se encuentra el repositorio MCPservers.

## Herramientas disponibles

- `assign_reviewer`: Asigna automáticamente un revisor a un PR basado en la carga de trabajo
  - Parámetros:
    - `repo`: Nombre del repositorio en formato owner/repo (ej: "bukhr/k8s")
    - `pr_number`: Número del Pull Request
    - `days`: (Opcional) Número de días a considerar para el análisis de carga (default: 15)
    - `thread_key`: (Opcional) Clave para agrupar mensajes en Google Chat (default: "review-pr-NUM")

- `list_teams`: Lista los equipos configurados y sus miembros

## Desarrollo

Para ejecutar el servidor localmente en modo desarrollo:

```bash
npx tsx main.ts
```

## Ejemplos de uso

### Asignar un revisor a un PR

```text
Asigna un revisor al PR #123 del repositorio bukhr/k8s
```

Respuesta:

```json
{
  "status": "success",
  "message": "Revisor asignado exitosamente: Nombre Completo (usuario)",
  "pr": {
    "number": 123,
    "title": "Título del PR",
    "url": "https://github.com/bukhr/k8s/pull/123",
    "author": "autor-pr"
  },
  "reviewer": {
    "name": "Nombre Completo",
    "github": "usuario",
    "email": "usuario@ejemplo.com"
  },
  "team": "Equipo Ejemplo",
  "thread_key": "review-pr-123"
}
```

### Listar equipos configurados

```text
Lista los equipos configurados para la asignación de revisores
```

Respuesta:

```json
{
  "teams": [
    {
      "name": "Equipo Ejemplo",
      "members": ["usuario1", "usuario2"],
      "repositories": ["bukhr/k8s", "bukhr/otro-repo"]
    }
  ]
}
```

## Habilitar logs

Para habilitar los logs, debes agregar la siguiente configuración al archivo `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "reviewAssign": {
    "logs": {
      "enableFileLogs": true,
      "logLevel": "debug"
    }
  }
}
```

> Nota: Los logs se guardarán en el directorio `logs` dentro de la carpeta del servidor MCP.
