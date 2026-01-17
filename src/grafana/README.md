# Grafana MCP Server

Este es un servidor de Protocolo de Control de Máquina (MCP) para interactuar con Grafana. Permite consultar dashboards, métricas y logs a través de la API de Grafana.

## Índice

- [Requisitos previos](#requisitos-previos)
- [Funcionalidades](#funcionalidades)
- [Configuración](#configuración)
  - [Configuración en Windows](#configurar-en-windows)
  - [Configuración en Gemini CLI](#configurar-en-gemini-cli)
- [Variables de entorno soportadas](#variables-de-entorno-soportadas)
- [Obtener API Key en Grafana](#obtener-api-key-en-grafana)
- [Herramientas disponibles](#herramientas-disponibles)
- [Ejemplos de uso](#ejemplos-de-uso)
- [Desarrollo](#desarrollo)
- [Habilitar logs](#habilitar-logs)
- [Problemas comunes](#problemas-comunes)
- [Contribución](#contribución)

## Requisitos previos

- Node.js (v16 o superior)
- npm o yarn
- Acceso a tu instancia de Grafana con una API Key
- Permisos necesarios para consultar dashboards, métricas y logs

## Funcionalidades

- Búsqueda y consulta de dashboards
- Consulta de métricas usando PromQL u otros lenguajes de consulta soportados
- Consulta de logs usando LogQL u otros lenguajes de consulta soportados
- Consulta de datos usando SQL
- Búsqueda de fuentes de datos (datasources) por nombre, tipo o UID
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
       "grafana": {
         "command": "npx",
         "args": [
           "-y",
           "tsx",
           "/path/to/MCPservers/src/grafana/main.ts"
         ]
       }
     },
     "grafana": {
       "baseUrl": "https://grafana.example.com",
       "apiKey": "<API_KEY>",
       "orgId": 1,
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
   - Puedes referenciar variables de entorno usando el prefijo `env:` (por ejemplo `"apiKey": "env:GRAFANA_API_KEY"`).
   - También puedes definir credenciales mediante variables de entorno sin modificar el JSON: `GRAFANA_BASE_URL`, `GRAFANA_API_KEY`, `GRAFANA_ORG_ID`.
   - El parámetro `orgId` es opcional y solo necesario si trabajas con múltiples organizaciones en Grafana.

### Configurar en Windows

Cambia el archivo `~/.codeium/windsurf/mcp_config.json` a:

```json
{
  "mcpServers": {
    "grafana": {
      "command": "wsl.exe",
      "args": [
        "zsh",
        "-ic",
        "npx -y tsx /path/to/MCPservers/src/grafana/main.ts"
      ]
    }
  },
  "grafana": {
    "baseUrl": "https://grafana.example.com",
    "apiKey": "<API_KEY>",
    "orgId": 1,
    "logs": {
      "enableFileLogs": true,
      "logLevel": "info"
    }
  }
}
```

Reemplaza tal cual descrito anteriormente en la sección de [Configuración](#configuración).

### Configurar en Gemini CLI

Hace lo mismo que la configuración en [Configuración](#configuración) pero en el archivo `~/.gemini/settings.json`.

## Variables de entorno soportadas

- `GRAFANA_BASE_URL`: URL base de Grafana (por ejemplo, `https://grafana.example.com`).
- `GRAFANA_API_KEY`: API Key de Grafana.
- `GRAFANA_ORG_ID`: ID de la organización en Grafana (opcional).

Si no se proporcionan por variables de entorno, se leen desde la sección `grafana` del `mcp_config.json`. Si faltan valores requeridos, el servidor lanzará un error al iniciar.

## Obtener API Key en Grafana

Sigue estos pasos para crear una API Key desde la interfaz de Grafana:

1. Inicia sesión en tu Grafana.
2. Navega a "Configuration" > "API Keys" (o directamente en la URL `/org/apikeys`).
3. Haz clic en "Add API key".
4. Asigna un nombre descriptivo (por ejemplo, "MCP Server").
5. Selecciona el rol adecuado ("Admin" para acceso completo, o "Editor"/"Viewer" según tus necesidades).
6. Establece una fecha de expiración o deja sin expiración según tus políticas de seguridad.
7. Haz clic en "Add".
8. Copia la API Key generada y guárdala de forma segura. No podrá volverse a ver después de cerrar el diálogo.
9. Configura las variables de entorno o el archivo `mcp_config.json` con la API Key.

Notas:

- En las versiones más recientes de Grafana, se utilizan Service Accounts en lugar de API Keys.
- Asegúrate de que la API Key tenga los permisos adecuados para las funciones que necesitas.
- Puedes revocar la API Key en cualquier momento desde la misma sección.
- Para mayor seguridad, considera crear una clave con permisos mínimos necesarios.

## Herramientas disponibles

### Dashboards

- `search_dashboards`: Busca dashboards en Grafana con distintos criterios.
  - Parámetros:
    - `query` (opcional): Texto para buscar en los dashboards.
    - `tag` (opcional): Tags para filtrar los dashboards.
    - `limit` (opcional): Límite de resultados a devolver.
    - `folder_ids` (opcional): IDs de carpetas para filtrar.
    - `starred` (opcional): Filtrar solo por dashboards favoritos.

- `get_dashboard`: Obtiene los detalles de un dashboard específico por su UID.
  - Parámetros:
    - `uid`: UID del dashboard a consultar.

### Datasources

- `search_datasources`: Busca fuentes de datos (datasources) en Grafana por nombre, tipo o UID.
  - Parámetros:
    - `name` (opcional): Nombre de la fuente de datos (parcial o completo).
    - `type` (opcional): Tipo de fuente de datos (como "prometheus", "loki", etc.).
    - `uid` (opcional): UID único de la fuente de datos.
    - `id` (opcional): ID de la fuente de datos.

### Métricas

- `query_metrics`: Consulta métricas en Grafana usando PromQL u otras consultas.
  - Parámetros:
    - `queries`: Array de consultas PromQL o expresiones de consulta.
    - `start` (opcional): Timestamp de inicio en segundos desde la época Unix.
    - `end` (opcional): Timestamp de fin en segundos desde la época Unix.
    - `step` (opcional): Intervalo en segundos para la resolución de datos.
    - `datasource` (opcional): UID o nombre de la fuente de datos.
    - `from` (opcional): Inicio del rango de tiempo (formato relativo como "now-1h" o ISO).
    - `to` (opcional): Fin del rango de tiempo (formato relativo como "now" o ISO).

### Logs

- `query_logs`: Consulta logs en Grafana usando LogQL u otras expresiones de consulta.
  - Parámetros:
    - `queries`: Array de consultas LogQL o expresiones de consulta.
    - `limit` (opcional): Número máximo de logs a devolver.
    - `start` (opcional): Timestamp de inicio en milisegundos desde la época Unix.
    - `end` (opcional): Timestamp de fin en milisegundos desde la época Unix.
    - `datasource` (opcional): UID o nombre de la fuente de datos.
    - `from` (opcional): Inicio del rango de tiempo (formato relativo como "now-1h" o ISO).
    - `to` (opcional): Fin del rango de tiempo (formato relativo como "now" o ISO).

### SQL

- `query_sql`: Ejecuta una consulta SQL en una fuente de datos de Grafana.
  - Parámetros:
    - `queries`: Array de consultas SQL a ejecutar.
    - `datasource`: UID de la fuente de datos SQL.
    - `from` (opcional): Inicio del rango de tiempo (formato relativo como "now-1h" o ISO). Default: 'now-1h'.
    - `to` (opcional): Fin del rango de tiempo (formato relativo como "now" o ISO). Default: 'now'.

## Ejemplos de uso

### Buscar dashboards

```text
Busca dashboards en Grafana que contengan la palabra "Golden Signals"
```

Respuesta:

```json
{
  "dashboards": [
    {
      "id": 1,
      "uid": "abc123",
      "title": "System Metrics",
      "url": "https://grafana.example.com/d/abc123",
      "tags": ["system", "metrics"],
      "folderTitle": "Monitoring",
      "folderId": 10,
      "folderUid": "xyz789",
      "isStarred": true
    },
    ...
  ],
  "total": 5
}
```

### Obtener detalles de un dashboard

```text
Muéstrame el dashboard con UID "abc123" en Grafana
```

Respuesta:

```json
{
  "dashboard": {
    "id": 1,
    "uid": "abc123",
    "title": "System Metrics",
    "tags": ["system", "metrics"],
    "timezone": "browser",
    "schemaVersion": 26,
    "version": 15,
    "panels": [
      {
        "id": 1,
        "title": "CPU Usage",
        "type": "graph",
        "datasource": {
          "type": "prometheus",
          "uid": "prometheus"
        }
      },
      ...
    ]
  },
  "meta": {
    "isStarred": true,
    "url": "/d/abc123/system-metrics",
    "folderId": 10,
    "folderUid": "xyz789",
    "folderTitle": "Monitoring",
    "folderUrl": "/dashboards/f/xyz789/monitoring",
    "provisioned": false
  }
}
```

### Buscar fuentes de datos por uid

```text
Buscar el datasource con uid contenga `sdlc` en Grafana
```

```json
{
  "datasources": [
    {
      "id": 1,
      "uid": "P8D5A3D41BF356E5B",
      "name": "metricsserversdlc",
      "type": "prometheus",
      "typeName": "Prometheus",
      "url": "http://prometheus:9090",
      "access": "proxy",
      "isDefault": true,
      "basicAuth": false,
      "readOnly": false
    }
  ],
  "total": 1
}
```

### Consultar métricas

```text
Dame el uso de CPU y de memoria para los últimos 30 minutos en el datasource Prometheus-Prod
```

Respuesta:

```json
{
  "successful": [
    {
      "series": [
        {
          "metric": { "instance": "host:9100", "job": "node" },
          "datapoints": [ { "timestamp": 1697529600, "value": 0.75 }, ... ]
        }
      ],
      "status": "success",
      "executedQueryString": "rate(node_cpu_seconds_total{mode=\"user\"}[1m])"
    },
    {
      "series": [
        {
          "metric": { "instance": "host:9100", "job": "node" },
          "datapoints": [ { "timestamp": 1697529600, "value": 85.1 }, ... ]
        }
      ],
      "status": "success",
      "executedQueryString": "node_memory_MemAvailable_bytes"
    }
  ],
  "failed": []
}
```

### Consultar logs

```text
Muéstrame los logs de SELECT y UPDATE de los últimos 30 minutos en el datasource Logs-Prod
```

Respuesta:

```json
{
  "successful": [
    {
      "logs": [
        {
          "timestamp": "2023-10-17T10:15:23Z",
          "content": "Error connecting to database: Connection refused",
          "labels": { "level": "error", "app": "api-server" }
        }
      ]
    },
    {
      "logs": [
        {
          "timestamp": "2023-10-17T10:16:05Z",
          "content": "Cache cleared",
          "labels": { "level": "warn", "app": "api-server" }
        }
      ]
    }
  ],
  "failed": []
}
```

### Buscar fuentes de datos por tipo

```text
Busca las fuentes de datos de tipo prometheus en Grafana
```

Respuesta:

```json
{
  "datasources": [
    {
      "id": 1,
      "uid": "P8D5A3D41BF356E5B",
      "name": "Prometheus",
      "type": "prometheus",
      "typeName": "Prometheus",
      "url": "http://prometheus:9090",
      "access": "proxy",
      "isDefault": true,
      "basicAuth": false,
      "readOnly": false
    },
    {
      "id": 5,
      "uid": "E8F4A3B7C8D9E0F1",
      "name": "Prometheus Staging",
      "type": "prometheus",
      "typeName": "Prometheus",
      "url": "http://prometheus-staging:9090",
      "access": "proxy",
      "isDefault": false,
      "basicAuth": false,
      "readOnly": false
    }
  ],
  "total": 2
}
```

### Buscar fuentes de datos por nombre

```text
Busca las fuentes de datos de <nombre_parcial_del_datasource> en Grafana
```

```json
{
  "datasources": [
    {
      "id": 1,
      "uid": "P8D5A3D41BF356E5B",
      "name": "<nombre_del_datasource>",
      "type": "prometheus",
      "typeName": "Prometheus",
      "url": "http://prometheus:9090",
      "access": "proxy",
      "isDefault": true,
      "basicAuth": false,
      "readOnly": false
    }
  ],
  "total": 1
}
```

### Consultar con SQL

```text
Ejecuta las consultas 'SELECT * FROM users LIMIT 2' y 'SELECT * FROM products LIMIT 2' en el datasource con UID 'my-postgres-db'
```

Respuesta:

```json
{
  "successful": [
    {
      "results": {
        "A": {
          "tables": [
            {
              "columns": [ { "text": "id" }, { "text": "name" } ],
              "rows": [ [ 1, "Alice" ], [ 2, "Bob" ] ]
            }
          ]
        }
      }
    },
    {
      "results": {
        "B": {
          "tables": [
            {
              "columns": [ { "text": "id" }, { "text": "product_name" } ],
              "rows": [ [ 101, "Laptop" ], [ 102, "Mouse" ] ]
            }
          ]
        }
      }
    }
  ],
  "failed": [
    "Error: la tabla 'non_existent_table' no existe"
  ]
}
```

## Desarrollo

### Ejecutar el servidor localmente

Para ejecutar el servidor en modo desarrollo:

```bash
npx tsx main.ts
```

### Ejecutar tests

Para ejecutar las pruebas automatizadas:

```bash
npm run test
```

Para ejecutar las pruebas con cobertura:

```bash
npm run test:coverage
```

## Habilitar logs

Para habilitar y configurar logs, añade en `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "grafana": {
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
- Los archivos generados incluyen `combined.log` y `error.log`, además de un archivo por herramienta cuando aplique (por ejemplo `dashboards.log`).
- Niveles de log disponibles: `error`, `warn`, `info`, `debug`, `silly`.

## Problemas comunes

### Error "Missing GRAFANA_BASE_URL"

Verifica que hayas configurado correctamente la URL base de Grafana, ya sea en el archivo de configuración o mediante la variable de entorno `GRAFANA_BASE_URL`.

### Error "Missing GRAFANA_API_KEY"

Asegúrate de haber configurado correctamente la API Key de Grafana en el archivo de configuración o mediante la variable de entorno `GRAFANA_API_KEY`.

### Errores 401 (Unauthorized) o 403 (Forbidden)

Verifica que la API Key sea válida y que tenga los permisos suficientes para acceder a las funcionalidades que intentas utilizar.

### Error en consulta de métricas o logs

Asegúrate de que:

1. La fuente de datos especificada exista en tu instancia de Grafana.
2. La consulta utilice la sintaxis correcta para el tipo de fuente de datos.
3. Estés utilizando el formato correcto para los timestamps y rangos de tiempo.

## Contribución

Si deseas contribuir al desarrollo de este servidor MCP:

1. Crea un fork del repositorio
2. Crea una rama para tu funcionalidad (`git checkout -b feature/nueva-funcionalidad`)
3. Realiza tus cambios, añade pruebas y documentación
4. Ejecuta las pruebas para asegurarte de que todo funciona correctamente
5. Haz commit de tus cambios (`git commit -am 'Añadir nueva funcionalidad'`)
6. Envía tus cambios a tu fork (`git push origin feature/nueva-funcionalidad`)
7. Crea un Pull Request
