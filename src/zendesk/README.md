# Servidor MCP para Zendesk

Un servidor Model Context Protocol (MCP) que se integra con la API de Zendesk, permitiendo la integración con Claude Code y otros clientes compatibles con MCP.

## Características

- **Búsqueda de Artículos**: Busca artículos en tu Centro de Ayuda de Zendesk
- **Detalles de Artículos**: Obtiene información detallada de artículos específicos por ID
- **Consulta de Tickets**: Obtiene detalles de tickets específicos de Zendesk por ID
- **Comentarios de Tickets**: Recupera todos los comentarios para un ticket específico de Zendesk
- **Adjuntos de Tickets**: Lista todos los adjuntos de los comentarios de un ticket con sus metadatos
- **Lectura de Adjuntos**: Descarga y procesa adjuntos; las imágenes se retornan como bloques visuales que Claude puede interpretar directamente

## Arquitectura del Proyecto

El proyecto sigue una arquitectura modular y escalable:

```plaintext
src/
  ├── types/               # Definiciones de tipos
  ├── services/            # Servicios de API
  ├── utils/               # Utilidades
  ├── tools/               # Herramientas MCP
  ├── client.ts            # Cliente principal
  ├── index.ts             # Punto de entrada para servidor MCP
  └── debug-cli.ts         # CLI para pruebas
```

## Requisitos Previos

- Node.js (v18 o superior)
- Cuenta de Zendesk con acceso a API
- Token de API de Zendesk

## Instalación

1. Clona este repositorio:

   ```bash
   git clone https://github.com/bukhr/MCPservers.git
   cd MCPservers/src/zendesk
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea un archivo `.env` en el directorio raíz con tus credenciales de Zendesk:

   ```bash
   ZENDESK_SUBDOMAIN=tu-subdominio
   ZENDESK_EMAIL=tu-email@ejemplo.com
   ZENDESK_API_TOKEN=tu-token-api
   DEFAULT_LOCALE=es
   ```

   Puedes copiar el archivo `.env.example` y completar con tus datos:

   ```bash
   cp .env.example .env
   ```

## Compilación y Ejecución

1. Compila el proyecto:

   ```bash
   npm run build
   ```

2. Inicia el servidor:

   ```bash
   npm start
   ```

El servidor se ejecutará en la entrada/salida estándar, haciéndolo compatible con Claude Code y otros clientes MCP.

## Herramientas Disponibles

El servidor proporciona las siguientes herramientas:

### 1. searchArticles

Busca artículos en tu Centro de Ayuda de Zendesk.

**Parámetros:**

- `query` (string, requerido): Palabra clave para búsqueda
- `locale` (string, opcional): Código de idioma (ej., 'es', 'en', 'ja')
- `page` (número, opcional): Número de página
- `per_page` (número, opcional): Número de resultados por página (máx. 100)

### 2. getArticle

Obtiene detalles de un artículo específico del Centro de Ayuda de Zendesk por ID.

**Parámetros:**

- `id` (número, requerido): ID del artículo
- `locale` (string, opcional): Código de idioma (ej., 'es', 'en', 'ja')

### 3. getTicket

Consulta un ticket de Zendesk por su ID.

**Parámetros:**

- `ticket_id` (número, requerido): ID del ticket a consultar

### 4. getTicketComments

Recupera todos los comentarios de un ticket de Zendesk por su ID.

**Parámetros:**

- `ticket_id` (número, requerido): ID del ticket para obtener comentarios

### 5. getTicketAttachments

Lista todos los adjuntos de los comentarios de un ticket de Zendesk, incluyendo metadatos como nombre de archivo, URL, tipo MIME y tamaño.

**Parámetros:**

- `ticket_id` (número, requerido): ID del ticket del cual obtener los adjuntos

**Respuesta:** Array de objetos `{ attachment, comment_id }` donde `attachment` contiene `id`, `file_name`, `content_url`, `content_type`, `size` e `inline`.

### 6. readAttachment

Descarga y retorna el contenido de un adjunto. Para imágenes, retorna un bloque de imagen que Claude puede interpretar directamente con sus capacidades de visión. Soporta imágenes, PDFs, HTML y archivos de texto. Rechaza archivos mayores a 10 MB.

**Parámetros:**

- `content_url` (string, requerido): URL del adjunto a descargar (obtenida de `getTicketAttachments`)
- `content_type` (string, opcional): Tipo MIME del adjunto. Si se omite, se detecta automáticamente desde la respuesta HTTP.

**Comportamiento según tipo MIME:**

| Tipo | Comportamiento |
|------|----------------|
| `image/*` | Retorna bloque de imagen en base64 para interpretación visual |
| `application/pdf` | Extrae y retorna el texto del PDF |
| `text/html` | Limpia el HTML y retorna el texto |
| `text/*` | Retorna el contenido como texto UTF-8 |
| Otros | Retorna mensaje indicando tipo no soportado |

## Uso con Claude Code

### Registrar el MCP en Claude Code

Ejecuta el siguiente comando reemplazando la ruta del proyecto, tu correo y tu API token:

```bash
claude mcp add zendesk --scope project node /home/tu-usuario/MCPservers/src/zendesk/dist/index.js \
  -e ZENDESK_SUBDOMAIN=buk \
  -e ZENDESK_EMAIL=tu-correo@buk.cl \
  -e "ZENDESK_API_TOKEN=tu-token-api" \
  -e DEFAULT_LOCALE=es
```

> **Nota:** el flag `--scope project` registra el MCP solo para el proyecto actual. Usa `--scope user` para registrarlo globalmente en tu usuario.

El comando requiere que ya hayas clonado el repositorio y compilado el proyecto (`npm run build`) para que el archivo `dist/index.js` exista.

### Pasos completos desde cero

```bash
# 1. Clonar el repositorio
git clone https://github.com/bukhr/MCPservers.git
cd MCPservers/src/zendesk

# 2. Instalar dependencias y compilar
npm install
npm run build

# 3. Registrar en Claude Code
claude mcp add zendesk --scope project node /ruta/absoluta/MCPservers/src/zendesk/dist/index.js \
  -e ZENDESK_SUBDOMAIN=buk \
  -e ZENDESK_EMAIL=tu-correo@buk.cl \
  -e "ZENDESK_API_TOKEN=tu-token-api" \
  -e DEFAULT_LOCALE=es
```

### Generar un token de API de Zendesk

> **Nota:** para generar un token de API debes ser administrador y el acceso con token de API debe estar activado en tu cuenta.

En el Centro de administración, haz clic en **Aplicaciones e integraciones** en la barra lateral y selecciona **API > API de Zendesk**. Haz clic en **Agregar token de API** a la derecha de Tokens de API activos. [Más información en la guía de Zendesk](https://support.zendesk.com/hc/es/articles/4408889192858-Administración-del-acceso-a-la-API-de-Zendesk#topic_mmh_gm1_2yb)

Después de registrar el MCP, **reinicia Claude Code** para que los cambios tomen efecto: sal con `exit` y vuelve a ingresar.

### Verificar que el MCP quedó configurado

Una vez dentro de Claude Code, ejecuta el comando:

```text
/mcp
```

Debiese aparecer `zendesk` en el listado de MCPs activos. Si no aparece, verifica que la ruta al archivo `dist/index.js` sea correcta y absoluta.

## Ejemplo de uso y caso de éxito

El prompt: me llego este ticket 190594 y necesito que lo analices y me indiques si tiene alguna propuesta de solución

La respuesta:

Análisis del problema
El cliente reporta que en el libro de remuneraciones del mes de abril, los nombres de las empresas en las pestañas del Excel aparecen abreviados (con puntos suspensivos "..."), mientras que en meses anteriores se mostraban completos. El nombre de la empresa no ha cambiado entre meses, pero ahora se muestra truncado.

Causa probable
Tras revisar el código, identifico que esto probablemente está relacionado con la forma en que se crean las pestañas en los archivos Excel. Excel tiene una limitación en la longitud de los nombres de pestañas (el límite es de 31 caracteres).

En la clase Exportador::BaseXlsx encontré este código relevante:

```ruby
book.add_worksheet(sanitizar_nombre(name))
```

Y en Exportador::BaseWriteXlsx hay una implementación que trunca explícitamente el nombre:

```ruby
book.add_worksheet(sanitizar_nombre(name.truncate(30, separator: ' ')))
```

Propuesta de solución
El problema parece ser que previamente los nombres de empresa más largos se mostraban completos (posiblemente ignorando el límite de Excel), pero ahora el sistema está aplicando correctamente el truncamiento. Dos posibles soluciones:

Solución inmediata: Modificar la función sanitizar_nombre para que no trunque los nombres de las empresas en este reporte específico, permitiendo que Excel los muestre como antes (aunque esto podría causar problemas de compatibilidad con Excel).

Solución recomendada: Mantener el truncamiento pero mejorar la forma en que se muestran los nombres. En lugar de permitir que Excel abrevie con "...", podemos truncar de manera más inteligente, por ejemplo:

- Mostrar la primera parte del nombre
- Añadir un sufijo más informativo como " (Abril)"
- Utilizar acrónimos o abreviaturas consistentes para empresas con nombres largos
Esta segunda opción sería compatible con Excel y proporcionaría una experiencia más profesional para el cliente.

### Nota: Gracias a este análisis identificamos el PR que había cambiado el comportamiento por el cual se levantó el ticket

## Desarrollo

Este proyecto utiliza TypeScript y sigue la especificación del Model Context Protocol.

Para ejecutar en modo desarrollo con recarga automática:

```bash
npm run dev
```

## Estructura del Código

El proyecto ha sido refactorizado siguiendo principios SOLID para mejorar la mantenibilidad y escalabilidad:

- **Separación de tipos**: Las interfaces están separadas en archivos específicos
- **Servicios modulares**: Cada servicio tiene una responsabilidad única
- **Utilidades reutilizables**: Funciones auxiliares extraídas a módulos independientes
- **Patrón Facade**: El cliente principal sirve como punto de acceso unificado

## Licencia

ISC

## Referencias

Este proyecto se baso en los siguientes repositorios:

- [zendesk-mcp-server](https://github.com/reminia/zendesk-mcp-server)
- [zendesk-help-center-mcp-server](https://github.com/hidechae/zendesk-help-center-mcp-server)
