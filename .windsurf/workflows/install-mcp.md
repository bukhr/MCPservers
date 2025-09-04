
---
description: Workflow para Instalación de Servidores MCP
---

# Workflow para Instalación de Servidores MCP

Este workflow proporciona una guía paso a paso para realizar la instalación de servidores MCP de forma guiada.

## Opciones

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

## Instalación

1. Listar los servidores disponibles

   ```bash
   ./scripts/install.sh --list
   ```

2. Pedir al usuario que indique los servidores que desea instalar, dando la opción de instalar todos los servidores o seleccionar servidores específicos.

3. Instalar los servidores seleccionados.

4. Ayudar al usuario a configurar los servidores instalados, proporcionando instrucciones claras y detalladas, y explicando los parámetros de configuración.

## Reglas

- Responder en el idioma Español
- No desviar del paso a paso de Instalación descrito en este workflow
- Debemos guiar al usuario para que pueda instalar y configurar los servidores MCP de forma correcta
- No solicitar credenciales de ningún tipo al usuario, orientar al usuario sobre cómo obtenerlas y cómo agregarlas al archivo de configuración
