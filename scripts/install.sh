#!/bin/bash

# Script para instalar servidores MCP (Python y TypeScript)

# Colores para una mejor visualización
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# Comprobar si la salida es a un terminal (para colorear)
if [ -t 1 ]; then
    USE_COLORS=true
else
    USE_COLORS=false
    GREEN=""
    BLUE=""
    YELLOW=""
    RED=""
    NC=""
fi

# Función para imprimir texto con color
print_color() {
    local color="$1"
    local text="$2"
    if [ "$USE_COLORS" = true ]; then
        printf "%b%s%b" "$color" "$text" "$NC"
    else
        printf "%s" "$text"
    fi
}

# Función para mostrar ayuda
show_help() {
    print_color "$YELLOW" "=== Instalador de Servidores MCP ==="
    echo ""
    echo "Uso: $0 [opciones] [servidores...]"
    echo ""
    echo "Opciones:"
    printf "  "; print_color "$BLUE" "-h, --help"; printf "          Mostrar esta ayuda\n"
    printf "  "; print_color "$BLUE" "-a, --all"; printf "           Instalar todos los servidores\n"
    printf "  "; print_color "$BLUE" "-i, --interactive"; printf "   Modo interactivo para seleccionar servidores\n"
    printf "  "; print_color "$BLUE" "-l, --list"; printf "          Listar servidores disponibles\n"
    echo ""
    echo "Ejemplos:"
    echo "  $0 --all                # Instalar todos los servidores"
    echo "  $0 --interactive        # Seleccionar servidores interactivamente"
    echo "  $0 git jira review_assign  # Instalar servidores específicos"
    echo "  $0 -l                   # Listar servidores disponibles"
    echo ""
    exit 0
}

# Función para descubrir servidores
find_servers() {
    # Buscar automáticamente todos los servidores Python (con pyproject.toml)
    python_servers=()
    for dir in src/*/; do
        if [ -f "${dir}pyproject.toml" ]; then
            server=$(basename "$dir")
            python_servers+=("$server")
        fi
    done

    # Buscar todos los servidores TypeScript (con package.json)
    ts_servers=()
    for dir in src/*/; do
        if [ -f "${dir}package.json" ] && [ ! -f "${dir}pyproject.toml" ]; then
            server=$(basename "$dir")
            ts_servers+=("$server")
        fi
    done
}

# Función para listar servidores disponibles
list_servers() {
    find_servers
    print_color "$YELLOW" "Servidores disponibles:"
    echo ""
    printf "  Python (${#python_servers[@]}): "; echo ""
    for server in "${python_servers[@]}"; do
        printf "    - "; print_color "$BLUE" "$server"; echo ""
    done
    echo ""
    printf "  TypeScript (${#ts_servers[@]}): "; echo ""
    for server in "${ts_servers[@]}"; do
        printf "    - "; print_color "$BLUE" "$server"; echo ""
    done
}

# Función para mostrar menú interactivo
select_servers_interactive() {
    find_servers
    
    selected_python_servers=()
    selected_ts_servers=()
    
    # Menú para Python
    if [ ${#python_servers[@]} -gt 0 ]; then
        echo ""
        print_color "$YELLOW" "Servidores Python disponibles:"
        echo ""
        PS3="Seleccione un servidor Python (0 para continuar): "
        select server in "${python_servers[@]}" "Todos" "Ninguno"; do
            case $REPLY in
                $((${#python_servers[@]}+1)))
                    selected_python_servers=("${python_servers[@]}")
                    break
                    ;;
                $((${#python_servers[@]}+2)))
                    selected_python_servers=()
                    break
                    ;;
                0)
                    break
                    ;;
                *)
                    if [ 1 -le "$REPLY" ] && [ "$REPLY" -le ${#python_servers[@]} ]; then
                        if [[ " ${selected_python_servers[*]} " =~ " ${server} " ]]; then
                            # Ya está seleccionado, eliminarlo
                            selected_python_servers=("${selected_python_servers[@]/$server}")
                            printf "Deseleccionado: "; print_color "$YELLOW" "${server}"; echo ""
                        else
                            selected_python_servers+=("$server")
                            printf "Seleccionado: "; print_color "$GREEN" "${server}"; echo ""
                        fi
                    else
                        print_color "$RED" "Opción no válida"; echo ""
                    fi
                    ;;
            esac
        done
    fi
    
    # Menú para TypeScript
    if [ ${#ts_servers[@]} -gt 0 ]; then
        echo ""
        print_color "$YELLOW" "Servidores TypeScript disponibles:"
        echo ""
        PS3="Seleccione un servidor TypeScript (0 para continuar): "
        select server in "${ts_servers[@]}" "Todos" "Ninguno"; do
            case $REPLY in
                $((${#ts_servers[@]}+1)))
                    selected_ts_servers=("${ts_servers[@]}")
                    break
                    ;;
                $((${#ts_servers[@]}+2)))
                    selected_ts_servers=()
                    break
                    ;;
                0)
                    break
                    ;;
                *)
                    if [ 1 -le "$REPLY" ] && [ "$REPLY" -le ${#ts_servers[@]} ]; then
                        if [[ " ${selected_ts_servers[*]} " =~ " ${server} " ]]; then
                            # Ya está seleccionado, eliminarlo
                            selected_ts_servers=("${selected_ts_servers[@]/$server}")
                            printf "Deseleccionado: "; print_color "$YELLOW" "${server}"; echo ""
                        else
                            selected_ts_servers+=("$server")
                            printf "Seleccionado: "; print_color "$GREEN" "${server}"; echo ""
                        fi
                    else
                        print_color "$RED" "Opción no válida"; echo ""
                    fi
                    ;;
            esac
        done
    fi
    
    echo ""
    print_color "$BLUE" "Servidores seleccionados para instalar:"
    echo ""
    printf "  Python: "; print_color "$GREEN" "${selected_python_servers[*]:-Ninguno}"; echo ""
    printf "  TypeScript: "; print_color "$GREEN" "${selected_ts_servers[*]:-Ninguno}"; echo ""
    
    # Preguntar confirmación
    read -p "¿Proceder con la instalación? (s/n): " confirm
    if [[ $confirm != [sS]* ]]; then
        print_color "$RED" "Instalación cancelada"
        echo ""
        exit 0
    fi
}

# Función para instalar servidores TypeScript
install_typescript_servers() {
    local servers=($@)
    
    if [ ${#servers[@]} -eq 0 ]; then
        print_color "$YELLOW" "No hay servidores TypeScript para instalar"
        echo ""
        return
    fi
    
    # Instalación de dependencias TypeScript (npm)
    print_color "$BLUE" "🔹 Instalando dependencias de TypeScript..."
    echo ""
    npm install
    print_color "$GREEN" "✅ Dependencias de TypeScript instaladas"
    echo ""
    
    # Construcción de paquetes TypeScript
    print_color "$BLUE" "🔹 Construyendo servidores TypeScript..."
    echo ""
    npm run build
    print_color "$GREEN" "✅ Servidores TypeScript construidos"
    echo ""
    
    printf "%s" "✅ Servidores TypeScript instalados: "; print_color "$GREEN" "${servers[*]}"; echo ""
}

# Función para instalar servidores Python
install_python_servers() {
    local servers=($@)
    
    if [ ${#servers[@]} -eq 0 ]; then
        print_color "$YELLOW" "No hay servidores Python para instalar"
        echo ""
        return
    fi

    printf "%s " "🔹 Instalando servidores Python:"; print_color "$BLUE" "${servers[*]}"
    echo ""

    for server in "${servers[@]}"; do
        if [ -d "src/$server" ]; then
            printf "%s " "🔹 Instalando servidor"; print_color "$BLUE" "$server..."
            echo ""
            cd "src/$server"

            # Verificar si hay archivo requirements.txt
            if [ -f "requirements.txt" ]; then
                # Verificar si estamos en un virtualenv
                if [ -z "$VIRTUAL_ENV" ]; then
                    print_color "$YELLOW" "Aviso: No se detectó un entorno virtual activo"
                    echo ""
                    read -p "¿Desea crear un entorno virtual para $server? (s/n): " create_venv

                    if [[ $create_venv == [sS]* ]]; then
                        printf "%s " "Creando entorno virtual para"; print_color "$BLUE" "$server..."
                        echo ""
                        python -m venv venv
                        
                        # Activar el entorno virtual
                        source venv/bin/activate || source venv/Scripts/activate
                        print_color "$GREEN" "Entorno virtual activado"
                        echo ""
                    fi
                fi

                printf "%s " "Instalando dependencias de"; print_color "$BLUE" "$server..."
                echo ""
                pip install -r requirements.txt
                printf "%s " "✅ Dependencias instaladas para"; print_color "$GREEN" "$server"
                echo ""
            else
                printf "%s " "No se encontró requirements.txt para"; print_color "$YELLOW" "$server"; printf ", omitiendo instalación de dependencias"
                echo ""
            fi

            # Ejecutar setup.py si existe
            if [ -f "setup.py" ]; then
                printf "%s " "Ejecutando setup.py para"; print_color "$BLUE" "$server..."
                echo ""
                pip install -e .
                printf "%s " "✅ Setup completado para"; print_color "$GREEN" "$server"
                echo ""
            fi

            # Volver al directorio principal
            cd "$project_dir"
            printf "%s " "✅ Servidor"; print_color "$GREEN" "$server"; printf " instalado"
            echo ""
        else
            printf "%s " "Error: No se encontró el directorio para el servidor"; print_color "$RED" "$server"
            echo ""
        fi
    done
    
    print_color "$GREEN" "✅ Servidores Python instalados"
    echo ""
}

# Procesar argumentos de línea de comandos
INSTALL_ALL=false
INSTALL_INTERACTIVE=false
LIST_ONLY=false
SPECIFIC_SERVERS=()

# Si no hay argumentos, mostrar ayuda
if [ $# -eq 0 ]; then
    show_help
fi

# Procesar argumentos
while [ $# -gt 0 ]; do
    case $1 in
        -h|--help)
            show_help
            shift
            ;;
        -a|--all)
            INSTALL_ALL=true
            shift
            ;;
        -i|--interactive)
            INSTALL_INTERACTIVE=true
            shift
            ;;
        -l|--list)
            LIST_ONLY=true
            shift
            ;;
        -*)
            print_color "$RED" "Error: Opción desconocida: $1"
            echo ""
            echo ""
            show_help
            exit 1
            ;;
        *)
            SPECIFIC_SERVERS+=("$1")
            shift
            ;;
    esac
done

# Encontrar servidores disponibles
find_servers

# Simplemente listar y salir si se solicitó
if [ "$LIST_ONLY" = true ]; then
    list_servers
    exit 0
fi

# Modo interactivo
if [ "$INSTALL_INTERACTIVE" = true ]; then
    select_servers_interactive
    # Continuar con instalación después de selección
fi

# Determinar qué servidores instalar
TO_INSTALL_PY=()
TO_INSTALL_TS=()

if [ "$INSTALL_ALL" = true ]; then
    print_color "$BLUE" "🔹 Instalando todos los servidores MCP..."
    echo ""
    TO_INSTALL_PY=("${python_servers[@]}")
    TO_INSTALL_TS=("${ts_servers[@]}")
fi

if [ ${#SPECIFIC_SERVERS[@]} -gt 0 ]; then
    for server in "${SPECIFIC_SERVERS[@]}"; do
        if [[ " ${python_servers[*]} " =~ " ${server} " ]]; then
            TO_INSTALL_PY+=("$server")
        elif [[ " ${ts_servers[*]} " =~ " ${server} " ]]; then
            TO_INSTALL_TS+=("$server")
        else
            printf "Advertencia: Servidor desconocido: "; print_color "$RED" "$server"; echo ""
        fi
    done
fi

if [ "$INSTALL_INTERACTIVE" = true ]; then
    TO_INSTALL_PY=("${selected_python_servers[@]}")
    TO_INSTALL_TS=("${selected_ts_servers[@]}")
fi

# Instalar los servidores seleccionados
install_typescript_servers "${TO_INSTALL_TS[@]}"
install_python_servers "${TO_INSTALL_PY[@]}"

# Resumen de instalación
echo ""
print_color "$GREEN" "=== Instalación completada ==="
echo ""

if [ ${#TO_INSTALL_PY[@]} -gt 0 ] || [ ${#TO_INSTALL_TS[@]} -gt 0 ]; then
    print_color "$BLUE" "Servidores instalados:"
    echo ""
    if [ ${#TO_INSTALL_PY[@]} -gt 0 ]; then
        print_color "$BLUE" "  Python:" 
        echo ""
        for server in "${TO_INSTALL_PY[@]}"; do
            printf "    - "; print_color "$GREEN" "$server"; echo ""
        done
    fi
    if [ ${#TO_INSTALL_TS[@]} -gt 0 ]; then
        print_color "$BLUE" "  TypeScript:" 
        echo ""
        for server in "${TO_INSTALL_TS[@]}"; do
            printf "    - "; print_color "$GREEN" "$server"; echo ""
        done
    fi
else
    print_color "$YELLOW" "No se instaló ningún servidor."
    echo ""
    print_color "$YELLOW" "Ejecuta '$0 --help' para ver las opciones disponibles."
    echo ""
fi

