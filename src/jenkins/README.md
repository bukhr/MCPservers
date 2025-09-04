# Jenkins MCP Server

Este es un servidor de Protocolo de Control de Máquina (MCP) para interactuar con Jenkins. Permite consultar el último build fallido de un job y obtener un extracto (tail) de su log de consola, o recuperar logs directamente desde una URL absoluta de un build (incluyendo URLs de Blue Ocean, que serán convertidas a la vista clásica automáticamente).

## Requisitos previos

- Node.js (v16 o superior)
- npm o yarn
- Acceso a tu instancia de Jenkins con usuario y API Token

## Funcionalidades

- Obtener el último build en estado FAILURE para un job y devolver un extracto del log
- Obtener el log de consola de un build a partir de su URL absoluta (soporta Blue Ocean y clásica)
- Configuración de logs a archivo y nivel de log personalizable

## Configuración

1. Instalar dependencias dentro de esta carpeta:

   ```bash
   npm install
   ```

2. Configurar Codeium MCP:
   - Añade la siguiente configuración a tu archivo `~/.codeium/windsurf/mcp_config.json`:

   ```json
   {
     "mcpServers": {
       "jenkins": {
         "command": "npx",
         "args": [
           "-y",
           "tsx",
           "/path/to/MCPservers/src/jenkins/main.ts"
         ]
       }
     },
     "jenkins": {
       "baseUrl": "https://jenkins.example.com",
       "auth": {
         "username": "usuario",
         "apiToken": "<API_TOKEN>"
       },
       "logs": {
         "enableFileLogs": true,
         "logLevel": "info"
       }
     }
   }
   ```

   Notas:
   - Reemplaza `/path/to/` con la ruta absoluta en tu sistema donde se encuentra el repositorio MCPservers.
   - El archivo de configuración debe ser JSON válido (sin comentarios).
   - Puedes referenciar variables de entorno usando el prefijo `env:` (por ejemplo `"apiToken": "env:JENKINS_API_TOKEN"`).
   - También puedes definir credenciales mediante variables de entorno sin modificar el JSON: `JENKINS_BASE_URL`, `JENKINS_USERNAME`, `JENKINS_API_TOKEN`.
   - Normalmente el username es el correo electrónico de la cuenta que usas para acceder a Jenkins.
   - El API Token se puede obtener desde la interfaz de Jenkins.

## Variables de entorno soportadas

- `JENKINS_BASE_URL`: URL base de Jenkins (por ejemplo, `https://jenkins.example.com`).
- `JENKINS_USERNAME`: Usuario de Jenkins.
- `JENKINS_API_TOKEN`: API Token del usuario.

Si no se proporcionan por variables de entorno, se leen desde la sección `jenkins` del `mcp_config.json`. Si faltan valores requeridos, el servidor lanzará un error al iniciar.

## Obtener API Token en Jenkins

Sigue estos pasos para crear un API Token desde la interfaz de Jenkins:

1. Inicia sesión en tu Jenkins.
2. Haz clic en tu nombre de usuario (arriba a la derecha) y luego en `Configure`.
3. En la sección `API Token`, selecciona `Add new Token`.
4. Asigna un nombre descriptivo (por ejemplo, "MCP Server") y haz clic en `Generate`.
5. Copia el token generado y guárdalo de forma segura. No podrá volverse a ver después de cerrar el diálogo.
6. Configura las variables de entorno o el archivo `mcp_config.json` con el usuario y token.

Notas:

- Asegúrate de que el usuario de Jenkins tenga permisos para leer jobs y acceder a logs de consola.
- Puedes revocar el token en cualquier momento desde la misma sección de `API Token`.

## Herramientas disponibles

- `check_jobs`: Obtiene el último build fallido de un job de Jenkins y devuelve un extracto del log, o retorna el log desde una URL de build.
  - Parámetros:
    - `job_full_name`: (Opcional) Nombre completo del job, por ejemplo `"Folder/Sub/Job"`.
    - `pipeline_url`: (Opcional) URL absoluta del build, por ejemplo `"https://jenkins.example.com/job/foo/15/"`.
    - `tail_lines`: (Opcional) Número de líneas finales del log a retornar. Si se omite, retorna el log completo.
  - Reglas:
    - Debes especificar `pipeline_url` o `job_full_name`. Si se define `pipeline_url`, tiene prioridad.

## Ejemplos de uso

### Obtener extracto del último build fallido de un job

```text
Revisa el último build fallido del job "Folder/Sub/Job" y dame las últimas 200 líneas del log
```

Respuesta:

```json
{
  "status": "success",
  "job": "Folder/Sub/Job",
  "build": {
    "number": 152,
    "url": "https://jenkins.example.com/job/Folder/job/Sub/job/Job/152/",
    "result": "FAILURE",
    "timestamp": 1725230000000,
    "duration": 340000
  },
  "log_tail_lines": 200,
  "log_excerpt": "...últimas 200 líneas..."
}
```

### Obtener log por URL absoluta (incluye Blue Ocean)

```text
Trae el log del build https://jenkins.example.com/blue/organizations/jenkins/org%2Frepo/detail/main/25/pipeline
```

Respuesta:

```json
{
  "status": "success",
  "job": "https://jenkins.example.com/blue/organizations/jenkins/org%2Frepo/detail/main/25/pipeline",
  "build": {
    "number": 25,
    "url": "https://jenkins.example.com/blue/organizations/jenkins/org%2Frepo/detail/main/25/pipeline"
  },
  "log_tail_lines": null,
  "log_excerpt": "...contenido completo del log..."
}
```

## Desarrollo

Para ejecutar el servidor localmente en modo desarrollo:

```bash
npx tsx main.ts
```

## Habilitar logs

Para habilitar y configurar logs, añade en `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "jenkins": {
    "logs": {
      "enableFileLogs": true,
      "logLevel": "debug",
      "logDir": "/ruta/opcional/a/logs"
    }
  }
}
```

Notas:

- Los logs se guardarán en el directorio `logs` dentro de la carpeta del servidor MCP si no se especifica `logDir`.
- Los archivos generados incluyen `combined.log` y `error.log`, además de un archivo por herramienta cuando aplique (por ejemplo `check-jobs.log`).
