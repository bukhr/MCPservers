  # Servidores Model Context Protocol (MCP)

Este repositorio contiene implementaciones de referencia para el [Model Context Protocol](https://modelcontextprotocol.io/) (MCP), enfocadas únicamente en tres servidores:

- **[Git](src/git)**: Herramientas para leer, buscar y manipular repositorios Git locales.
- **[GitHub](src/github)**: Operaciones sobre repositorios remotos y la API de GitHub.
- **[Google Drive](src/gdrive)**: Acceso y búsqueda de archivos en Google Drive.

Estos servidores demuestran cómo MCP puede ofrecer a LLMs acceso seguro y controlado a repositorios de código y archivos en la nube.

## Uso

Cada servidor MCP está implementado usando el [SDK de TypeScript para MCP](https://github.com/modelcontextprotocol/typescript-sdk) o el [SDK de Python para MCP](https://github.com/modelcontextprotocol/python-sdk).

### Ejecutar un servidor basado en TypeScript

```sh
npx -y @modelcontextprotocol/server-gdrive
npx -y @modelcontextprotocol/server-github
```

### Ejecutar el servidor de Git (Python)

```sh
uvx mcp-server-git
# o bien
pip install mcp-server-git
python -m mcp_server_git
```

## Uso en un cliente MCP

Ejecutar un servidor por sí solo no suele ser útil; lo habitual es configurarlo como parte de un cliente MCP. Por ejemplo, esta es una configuración típica para Claude Desktop:

```json
{
  "mcpServers": {
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git", "--repository", "ruta/a/tu/repositorio"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<TU_TOKEN>"
      }
    },
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"]
    }
  }
}
```

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

## Contribución
Python-based servers in this repository can be used directly with [`uvx`](https://docs.astral.sh/uv/concepts/tools/) or [`pip`](https://pypi.org/project/pip/). `uvx` is recommended for ease of use and setup.

For example, this will start the [Git](src/git) server:
```sh
# With uvx
uvx mcp-server-git

# With pip
pip install mcp-server-git
python -m mcp_server_git
```

Follow [these](https://docs.astral.sh/uv/getting-started/installation/) instructions to install `uv` / `uvx` and [these](https://pip.pypa.io/en/stable/installation/) to install `pip`.

### Using an MCP Client
However, running a server on its own isn't very useful, and should instead be configured into an MCP client. For example, here's the Claude Desktop configuration to use the above server:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

Additional examples of using the Claude Desktop as an MCP client might look like:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git", "--repository", "path/to/git/repo"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

## 🛠️ Crear tu propio servidor MCP

¿Te interesa crear tu propio servidor MCP? Consulta la documentación oficial en [modelcontextprotocol.io](https://modelcontextprotocol.io/introduction) para encontrar guías completas, buenas prácticas y detalles técnicos sobre cómo implementar servidores MCP.

## 🤝 Contribuir

Consulta el archivo [CONTRIBUTING.md](CONTRIBUTING.md) para información sobre cómo contribuir a este repositorio.


Managed by Anthropic, but built together with the community. The Model Context Protocol is open source and we encourage everyone to contribute their own servers and improvements!