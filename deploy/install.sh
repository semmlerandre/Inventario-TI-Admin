#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_NAME="inventario-ti-admin"
MIN_APP_PORT=5000
MAX_APP_PORT=5999

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
DOCKER_IS_SNAP=false

log() {
    echo
    echo "[$1] $2"
}

fail() {
    echo
    echo "ERRO: $1" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

require_root() {
    if [ "${EUID}" -ne 0 ]; then
        fail "Execute com sudo: sudo ./deploy/install.sh"
    fi
}

detect_os() {
    [ -f /etc/os-release ] || fail "Não foi possível identificar o Linux."

    . /etc/os-release

    DISTRO_ID="${ID:-}"
    DISTRO_CODENAME="${VERSION_CODENAME:-}"

    case "$DISTRO_ID" in
        ubuntu|debian) ;;
        *) fail "Distribuição não suportada: ${DISTRO_ID}. Nesta versão são suportados Ubuntu e Debian." ;;
    esac

    [ -n "$DISTRO_CODENAME" ] || fail "Não foi possível identificar a versão da distribuição."
    log "OK" "Sistema detectado: ${PRETTY_NAME:-$DISTRO_ID}"
}

install_base_dependencies() {
    log "INFO" "Verificando dependências básicas..."

    local packages=()
    command_exists curl || packages+=("curl")
    command_exists git || packages+=("git")
    command_exists openssl || packages+=("openssl")
    command_exists ss || packages+=("iproute2")
    dpkg -s ca-certificates >/dev/null 2>&1 || packages+=("ca-certificates")

    if [ "${#packages[@]}" -gt 0 ]; then
        log "INFO" "Instalando dependências ausentes: ${packages[*]}"
        apt-get update
        DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
    else
        log "OK" "Dependências básicas já instaladas."
    fi
}

install_docker() {
    if command_exists docker && docker info >/dev/null 2>&1; then
        log "OK" "Docker já está instalado e funcionando."
        return
    fi

    log "INFO" "Docker não encontrado. Instalando..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${DISTRO_ID}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    ARCH="$(dpkg --print-architecture)"
    cat > /etc/apt/sources.list.d/docker.sources <<DOCKERREPO
Types: deb
URIs: https://download.docker.com/linux/${DISTRO_ID}
Suites: ${DISTRO_CODENAME}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
DOCKERREPO

    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    docker info >/dev/null 2>&1 || fail "Docker foi instalado, mas o serviço não está funcionando."
    log "OK" "Docker instalado e iniciado."
}

check_compose() {
    if docker compose version >/dev/null 2>&1; then
        log "OK" "Docker Compose disponível."
        return
    fi

    log "INFO" "Instalando Docker Compose Plugin..."
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin
    docker compose version >/dev/null 2>&1 || fail "Não foi possível instalar Docker Compose."
    log "OK" "Docker Compose instalado."
}

detect_docker_snap() {
    local docker_path
    docker_path="$(readlink -f "$(command -v docker)")"

    if [[ "$docker_path" == /snap/* ]] || [[ "$(command -v docker)" == /snap/* ]]; then
        DOCKER_IS_SNAP=true
        log "INFO" "Docker instalado via Snap detectado (${docker_path})."
    fi
}

find_install_user() {
    local candidate="${SUDO_USER:-}"

    if [ -n "$candidate" ] && [ "$candidate" != "root" ]; then
        getent passwd "$candidate" >/dev/null 2>&1 && {
            echo "$candidate"
            return 0
        }
    fi

    candidate="$(getent passwd | awk -F: '$3 >= 1000 && $3 < 65534 && $6 ~ /^\/home\// {print $1; exit}')"
    [ -n "$candidate" ] || return 1
    echo "$candidate"
}

prepare_snap_compatible_location() {
    [ "$DOCKER_IS_SNAP" = true ] || return 0

    # O Docker Snap é confinado e não consegue acessar normalmente projetos em /opt.
    # Se o projeto já estiver em /home, não é necessário relocá-lo.
    if [[ "$PROJECT_DIR" == /home/* ]]; then
        log "OK" "Projeto já está em caminho compatível com Docker Snap: ${PROJECT_DIR}"
        return 0
    fi

    local install_user
    local install_home
    local target_parent
    local target_dir

    install_user="$(find_install_user)" || \
        fail "Docker Snap detectado, mas não foi possível identificar um usuário com HOME em /home."

    install_home="$(getent passwd "$install_user" | cut -d: -f6)"
    [ -n "$install_home" ] && [ -d "$install_home" ] || \
        fail "HOME do usuário '${install_user}' não foi encontrado."

    target_parent="${install_home}/apps"
    target_dir="${target_parent}/${PROJECT_NAME}"

    echo
    echo "=================================================="
    echo "       COMPATIBILIDADE COM DOCKER SNAP"
    echo "=================================================="
    echo
    echo "O Docker desta máquina foi instalado via Snap."
    echo "O Snap possui confinamento de acesso ao sistema de arquivos"
    echo "e pode não conseguir ler projetos armazenados em /opt."
    echo
    echo "A instalação será executada em um caminho compatível:"
    echo "  ${target_dir}"
    echo
    echo "Os containers Docker já existentes NÃO serão alterados."
    echo "O diretório original NÃO será removido."
    echo "=================================================="

    if [ -e "$target_dir" ]; then
        fail "O diretório de destino já existe: ${target_dir}. Revise-o antes de continuar."
    fi

    mkdir -p "$target_parent"
    cp -a "$PROJECT_DIR" "$target_dir"
    chown -R "$install_user":"$(id -gn "$install_user")" "$target_dir"

    PROJECT_DIR="$target_dir"
    SCRIPT_DIR="${PROJECT_DIR}/deploy"
    ENV_FILE="${PROJECT_DIR}/.env"
    COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"

    [ -f "$COMPOSE_FILE" ] || fail "docker-compose.yml não foi copiado para ${PROJECT_DIR}."

    log "OK" "Projeto preparado para Docker Snap em ${PROJECT_DIR}."
}

compose() {
    docker compose \
        -f "$COMPOSE_FILE" \
        --project-directory "$PROJECT_DIR" \
        -p "$PROJECT_NAME" \
        "$@"
}

load_compose_environment() {
    [ -f "$ENV_FILE" ] || fail "Arquivo .env não encontrado: ${ENV_FILE}"

    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a

    # Evita que o Compose Snap precise abrir diretamente o arquivo oculto .env.
    # As variáveis já foram exportadas pelo shell acima.
    export COMPOSE_DISABLE_ENV_FILE=1
}

show_existing_containers() {
    log "INFO" "Verificando containers existentes..."

    if [ -n "$(docker ps -q 2>/dev/null)" ]; then
        echo
        docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
        echo
        log "OK" "Containers existentes não serão alterados."
    else
        log "OK" "Nenhum container em execução."
    fi
}

port_in_use() {
    local port="$1"

    if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)$port$"; then
        return 0
    fi

    if [ -n "$(docker ps -a --filter "publish=${port}" -q 2>/dev/null)" ]; then
        return 0
    fi

    return 1
}

find_free_port() {
    local port
    for ((port=MIN_APP_PORT; port<=MAX_APP_PORT; port++)); do
        if ! port_in_use "$port"; then
            echo "$port"
            return 0
        fi
    done
    fail "Nenhuma porta livre entre ${MIN_APP_PORT} e ${MAX_APP_PORT}."
}

check_existing_installation() {
    log "INFO" "Verificando instalação existente..."
    cd "$PROJECT_DIR"

    if [ ! -f "$ENV_FILE" ]; then
        log "OK" "Nenhuma configuração existente detectada."
        return
    fi

    if grep -q '^COMPOSE_PROJECT_NAME=' "$ENV_FILE"; then
        local configured_project
        configured_project="$(grep '^COMPOSE_PROJECT_NAME=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
        [ "$configured_project" = "$PROJECT_NAME" ] || \
            fail "O .env pertence ao projeto Compose '$configured_project', não '$PROJECT_NAME'."
    fi

    local existing_containers
    existing_containers="$(docker ps -a \
        --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
        --format '{{.Names}}' 2>/dev/null || true)"

    if [ -n "$existing_containers" ]; then
        echo
        echo "=================================================="
        echo "       INSTALACAO EXISTENTE DETECTADA"
        echo "=================================================="
        echo
        echo "Este servidor já possui uma instalação do Inventário TI."
        echo
        echo "Containers encontrados:"
        echo "$existing_containers"
        echo
        echo "O instalador NÃO fará nenhuma alteração."
        echo "Para futuras atualizações utilize:"
        echo "sudo ./deploy/update.sh"
        echo
        echo "=================================================="
        exit 0
    fi

    log "INFO" ".env do Inventário TI encontrado, mas nenhum container existente foi localizado."
    log "INFO" "O instalador continuará usando a configuração existente."
}

create_env() {
    if [ -f "$ENV_FILE" ]; then
        log "OK" ".env existente encontrado."
        log "OK" "O arquivo existente NÃO será sobrescrito."
        return
    fi

    log "INFO" "Criando configuração inicial..."
    APP_PORT="$(find_free_port)"
    DB_PASSWORD="$(openssl rand -hex 24)"
    SESSION_SECRET="$(openssl rand -hex 48)"

    cat > "$ENV_FILE" <<ENVFILE
COMPOSE_PROJECT_NAME=${PROJECT_NAME}
APP_PORT=${APP_PORT}

DB_USER=inventario
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=inventario

SESSION_SECRET=${SESSION_SECRET}
ENVFILE

    chmod 600 "$ENV_FILE"
    log "OK" ".env criado."
    log "OK" "Porta selecionada para aplicação: ${APP_PORT}"
}

validate_compose() {
    log "INFO" "Validando configuração Docker..."
    cd "$PROJECT_DIR"
    compose config >/dev/null || fail "docker-compose.yml inválido."
    log "OK" "docker-compose.yml válido."
}

build_application() {
    log "INFO" "Construindo imagens..."
    cd "$PROJECT_DIR"
    compose build || fail "Falha no build."
    log "OK" "Build concluído."
}

start_application() {
    log "INFO" "Iniciando aplicação..."
    cd "$PROJECT_DIR"
    compose up -d || fail "Falha ao iniciar containers."
    log "OK" "Containers iniciados."
}

wait_for_application() {
    local app_port
    app_port="$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)"
    log "INFO" "Aguardando aplicação responder na porta ${app_port}..."

    for attempt in {1..60}; do
        if curl -fsS "http://127.0.0.1:${app_port}/" >/dev/null 2>&1; then
            log "OK" "Aplicação respondeu."
            return 0
        fi
        sleep 2
    done

    echo
    echo "Status dos containers:"
    compose ps || true
    echo
    echo "Últimos logs:"
    compose logs --tail=100 app || true
    fail "A aplicação não respondeu dentro do tempo esperado."
}

show_result() {
    local app_port
    local server_ip
    app_port="$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)"
    server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"

    echo
    echo "=================================================="
    echo "       INVENTARIO TI INSTALADO COM SUCESSO"
    echo "=================================================="
    echo
    echo "Diretório da instalação: ${PROJECT_DIR}"
    echo "Porta da aplicação: ${app_port}"

    if [ -n "$server_ip" ]; then
        echo "Acesso:"
        echo "http://${server_ip}:${app_port}"
    else
        echo "Acesso:"
        echo "http://IP_DO_SERVIDOR:${app_port}"
    fi

    echo
    echo "Configuração:"
    echo "${ENV_FILE}"
    echo
    echo "Containers:"
    compose ps
    echo
    echo "=================================================="
}

main() {
    echo
    echo "=================================================="
    echo "        INVENTARIO TI - INSTALADOR LINUX"
    echo "=================================================="

    require_root
    detect_os
    install_base_dependencies
    install_docker
    check_compose
    detect_docker_snap
    prepare_snap_compatible_location
    show_existing_containers
    check_existing_installation
    create_env
    load_compose_environment
    validate_compose
    build_application
    start_application
    wait_for_application
    show_result
}

main "$@"
