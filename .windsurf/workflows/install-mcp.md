
---
description: Workflow para Instalación de Servidores MCP
---

# Workflow para Instalación de Servidores MCP

Este workflow proporciona una guía paso a paso para realizar la instalación de servidores MCP de forma guiada.

## Requisitos Previos

1. Verificar que Node.js, npm y Python estén instalados correctamente:

   ```bash
   node --version && npm --version && python --version || python3 --version
   ```

2. Comprobar que el script de instalación tiene permisos de ejecución:

   ```bash
   ls -la ./scripts/install.sh
   ```

3. Si el script no tiene permisos de ejecución, asignarlos:

   ```bash
   chmod +x ./scripts/install.sh
   ```

## Instalación

1. Listar los servidores disponibles

   ```bash
   ./scripts/install.sh --list
   ```

2. Pedir al usuario que indique los servidores que desea instalar y aguarde la respuesta (esperar a que el usuario indique los servidores que desea instalar).

3. Instalar los servidores seleccionados por el usuario.

4. Ayudar al usuario a configurar los servidores instalados con base a los archivos `README.md` de cada servidor, proporcionando instrucciones claras y detalladas, y explicando los parámetros de configuración. Priorizar la configuración en la IDE Windsurf.

## Opciones del script de instalación

### Listar servidores disponibles

   ```bash
   ./scripts/install.sh --list
   ```

### Instalar servidores específicos

   ```bash
   ./scripts/install.sh <nombre del servidor> <nombre del otro servidor>
   ```

### Instalar todos los servidores

   ```bash
   ./scripts/install.sh --all
   ```

## Reglas

- Responder en el idioma Español
- No desviar del paso a paso de Instalación descrito en este workflow
- Debemos guiar al usuario para que pueda instalar y configurar los servidores MCP de forma correcta
- No solicitar credenciales de ningún tipo al usuario, orientar al usuario sobre cómo obtenerlas y cómo agregarlas al archivo de configuración
- Ofrecer al usuario la opción de instalar todos los servidores o seleccionar servidores específicos
- No asumir que el usuario desea instalar todos los servidores si el usuario no especifica que desea instalar todos
- No asumir cual servidor el usuario desea instalar si el usuario no especifica cual servidor desea instalar
- **IMPORTANTE**: Después de preguntar al usuario qué servidores instalar, detener la ejecución y esperar la entrada explícita del usuario antes de continuar con la instalación.
