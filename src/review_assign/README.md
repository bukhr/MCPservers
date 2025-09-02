# Servidor MCP para Asignación Automática de Revisores

Este es un servidor de Protocolo de Control de Máquina (MCP) para la asignación automática de revisores a Pull Requests en GitHub basado en la carga de trabajo previa de los miembros de un equipo, con notificaciones a Google Chat opcionalmente.

## Requisitos previos

- Node.js (v16 o superior)
- npm o yarn
- GitHub CLI (`gh`) instalado y configurado
- Acceso a los repositorios relevantes a través de GitHub CLI

## Funcionalidades

- Asignación automática de revisores basada en la carga de trabajo previa
- Notificaciones a Google Chat a través de webhooks (opcional)
- Configuración personalizable de equipos y repositorios
- Detección automática de miembros de equipos desde GitHub
- Exclusión manual de miembros del equipo para revisiones

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

   **Notas:**
   - Reemplaza `/path/to/` con la ruta absoluta en tu sistema donde se encuentra el repositorio MCPservers.
   - El archivo de configuración **no debe contener comentarios**, es decir, debe ser un JSON válido.
   - Si no se especifica un `webhook_url`, se asume que no se desea notificar a Google Chat.
   - Si no se especifica un `reviewDays`, se asume que se desea considerar la carga de trabajo de los últimos 15 días.
   - El formato de los repositorios debe ser `owner/repo` (ej: `bukhr/k8s`). Omitiendo el prefijo con el dominio `https://github.com/`.

## Crear webhook en Google Chat

Para crear un webhook en Google Chat, sigue los siguientes pasos:

1. Ve a la página de Google Chat y selecciona el espacio donde deseas crear el webhook.
2. Ve a la `Configuración del Espacio` y selecciona `Integraciones y aplicaciones`.
3. Busca `Webhook`, verifica que ya no exista un webhook similar y si no existe, haz clic en `Agregar webhook`.
4. En la siguiente pantalla, llena los campos requeridos y haz clic en `Guardar`.
5. Copia la URL del webhook y pégala en el archivo de configuración.

> Notas: cuidado con la URL del webhook, contiene credenciales para acceder al espacio de Google Chat.

## Configuración de carga de trabajo

Se puede configurar el factor de carga de trabajo para cada miembro del equipo en el archivo de configuración.

```json
{
  "teams": [
    {
      "team_name": "Equipo Ejemplo",
      "members": [
        {
          "name": "Nombre Completo 1",
          "email": "usuario1@ejemplo.com",
          "nickname_github": "usuario1",
          "workloadFactor": 0.5
        },
        {
          "name": "Nombre Completo 2",
          "email": "usuario2@ejemplo.com",
          "nickname_github": "usuario2"
        }
      ],
      "repositories": ["bukhr/k8s", "bukhr/otro-repo"],
      "webhook_url": "https://chat.googleapis.com/v1/spaces/XXXX/messages?key=YYYY"
    }
  ],
  "reviewDays": 15
}
```

El factor de carga de trabajo es un valor entre 0 y 1 que indica la proporción de la carga normal que puede manejar el miembro. Por ejemplo, un valor de 0.5 indica que el miembro puede manejar la mitad de la carga normal.

Si no se especifica un factor de carga de trabajo, se asume 1.0 (carga normal).

## Detección automática de miembros del equipo en GitHub

El servidor MCP puede detectar automáticamente los miembros de un equipo directamente desde GitHub. Para habilitar esta funcionalidad, debes añadir los siguientes parámetros a tu configuración:

```json
{
  "teams": [
    {
      "team_name": "Equipo Ejemplo",
      "org": "nombre-de-la-organizacion",
      "team_slug": "nombre-del-equipo",
      "members": [
        {
          "name": "Nombre Personalizado",
          "nickname_github": "usuario1",
          "email": "correo@personalizado.com",
          "workloadFactor": 0.5
        }
      ],
      "repositories": ["bukhr/k8s", "bukhr/otro-repo"]
    }
  ],
  "reviewDays": 15,
  "auto_detect_members_from_github": true
}
```

**Parámetros adicionales:**

- `org`: El nombre de la organización de GitHub donde se encuentra el equipo.
- `team_slug`: El slug o nombre de la URL del equipo en GitHub.
- `auto_detect_members_from_github`: Activa la detección automática de miembros desde GitHub. Al estar activo este atributo hace opcional el uso del key `members` en los objetos de `teams`.

**Funcionamiento:**

- El sistema obtendrá la lista completa de miembros del equipo directamente desde GitHub.
- Si un miembro ya está definido en la configuración, se preservarán sus datos personalizados (nombre, email, factor de carga).
- Los nuevos miembros detectados en GitHub se agregarán automáticamente a la configuración.
- Los nombres de usuario de GitHub se tratan sin distinguir entre mayúsculas y minúsculas para la combinación de datos.

Esta funcionalidad es útil para mantener actualizada la lista de miembros del equipo sin necesidad de editar manualmente la configuración cuando hay cambios en los equipos de GitHub. Solo necesitas mantener manualmente los miembros que quieras personalizar (nombre, email, factor de carga).

## Excluir miembros del equipo manualmente

Además de la detección automática, puedes configurar el servidor MCP para excluir específicamente ciertos miembros del equipo aunque estén en el equipo de GitHub. Esto es útil cuando un miembro del equipo no debe participar en las revisiones de código por algún motivo (vacaciones, licencia, u otras responsabilidades).

Para excluir miembros, añade el parámetro `exclude_members_by_nickname` a tu configuración:

```json
{
  "teams": [
    {
      "team_name": "Equipo Ejemplo",
      "org": "nombre-de-la-organizacion",
      "team_slug": "nombre-del-equipo",
      "members": [
        {
          "name": "Nombre Personalizado",
          "nickname_github": "usuario1",
          "email": "correo@personalizado.com",
          "workloadFactor": 0.5
        }
      ],
      "repositories": ["bukhr/k8s", "bukhr/otro-repo"],
      "exclude_members_by_nickname": ["usuario3", "usuario4"]
    }
  ],
  "reviewDays": 15,
  "auto_detect_members_from_github": true
}
```

**Funcionamiento:**

- Los miembros listados en `exclude_members_by_nickname` serán excluidos de las asignaciones de revisión.
- Los nombres de usuario en esta lista deben coincidir con los valores de `nickname_github`.
- Esta configuración funciona tanto con la detección automática habilitada como con la configuración manual de miembros.
- La comparación de nombres de usuario no distingue entre mayúsculas y minúsculas.

## Herramientas disponibles

- `assign_reviewer`: Asigna automáticamente un revisor a un PR basado en la carga de trabajo
  - Parámetros:
    - `repo`: Nombre del repositorio en formato owner/repo (ej: "bukhr/k8s")
    - `pr_number`: Número del Pull Request
    - `days`: (Opcional) Número de días a considerar para el análisis de carga (default: 15)
    - `thread_key`: (Opcional) Clave para agrupar mensajes en Google Chat (default: "review-pr-NUM")
    - `exclude_nickname`: (Opcional) Nickname de GitHub a excluir solo para esta asignación

- `list_teams`: Lista los equipos configurados y sus miembros

## Ejemplos de uso

### Asignar un revisor a un PR

```text
Asigna un revisor al PR #123
```

Respuesta:

```json
{
  "status": "success",
  "message": "Revisor asignado exitosamente: Nombre Completo (usuario)",
  "pr": {
    "number": 123,
    "title": "Título del PR",
    "url": "https://github.com/owner/repo/pull/123",
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

#### Ocupar otro repositorio distinto al actual

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

#### En un hilo específico en Google Chat

```text
Asigna un revisor al PR #123 del repositorio bukhr/k8s en el hilo con clave `llave-del-hilo`
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
  "thread_key": "llave-del-hilo"
}
```

#### Excluir temporalmente a un miembro específico

```text
Asigna un revisor al PR #123 del repositorio bukhr/k8s excluyendo a "usuario2"
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

## Desarrollo

Para ejecutar el servidor localmente en modo desarrollo:

```bash
npx tsx main.ts
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
