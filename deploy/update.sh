#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_NAME="inventario-ti-admin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${PROJECT_DIR}/backups"

log() {
    echo
    echo "[$1] $2"
}

fail() {
    echo
    echo "ERRO: $1" >&2
    exit 1
}

require_root() {
    if [ "${EUID}" -ne 0 ]; then
        fail "Execute este script com sudo: sudo ./deploy/update.sh"
    fi
}

check_dependencies() {
    command -v git >/dev/null 2>&1 ||
        fail "Git não encontrado."

    command -v docker >/dev/null 2>&1 ||
        fail "Docker não encontrado."

    docker compose version >/dev/null 2>&1 ||
        fail "Docker Compose Plugin não encontrado."
}

check_installation() {
    cd "$PROJECT_DIR"

    [ -d ".git" ] ||
        fail "Este diretório não é um repositório Git."

    [ -f "$ENV_FILE" ] ||
        fail "Arquivo .env não encontrado."

    # Instalações antigas podem não possuir COMPOSE_PROJECT_NAME no .env.
    # Se existir, entretanto, ele precisa corresponder ao projeto esperado.
    if grep -q '^COMPOSE_PROJECT_NAME=' "$ENV_FILE"; then
        local configured_project
        configured_project="$(grep '^COMPOSE_PROJECT_NAME=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"

        if [ "$configured_project" != "$PROJECT_NAME" ]; then
            fail "O .env pertence ao projeto Compose '$configured_project', não '$PROJECT_NAME'."
        fi
    fi

    local db_container
    db_container="$(
        docker ps -a             --filter "label=com.docker.compose.project=${PROJECT_NAME}"             --filter "label=com.docker.compose.service=db"             --format '{{.ID}}' |
            head -n1
    )"

    if [ -z "$db_container" ]; then
        fail "Banco da instalação '${PROJECT_NAME}' não encontrado."
    fi
}

wait_for_database() {
    log "INFO" "Aguardando PostgreSQL..."

    local tries=0

    until docker compose -p "$PROJECT_NAME" exec -T db pg_isready >/dev/null 2>&1; do
        tries=$((tries + 1))

        if [ "$tries" -ge 30 ]; then
            fail "PostgreSQL não ficou disponível."
        fi

        sleep 2
    done

    log "OK" "PostgreSQL disponível."
}

backup_database() {
    mkdir -p "$BACKUP_DIR"

    local timestamp
    local backup_file

    timestamp="$(date +%Y%m%d_%H%M%S)"
    backup_file="${BACKUP_DIR}/inventario_${timestamp}.dump"

    log "INFO" "Criando backup antes da atualização..."

    docker compose -p "$PROJECT_NAME" exec -T db \
        pg_dump \
        -U "${DB_USER:-inventario}" \
        -d "${DB_NAME:-inventario}" \
        --format=custom \
        > "$backup_file"

    if [ ! -s "$backup_file" ]; then
        rm -f "$backup_file"
        fail "Backup do banco ficou vazio. Atualização cancelada."
    fi

    # Valida se o arquivo é realmente um archive PostgreSQL legível.
    if ! docker compose -p "$PROJECT_NAME" exec -T db         pg_restore --list < "$backup_file" >/dev/null 2>&1; then
        rm -f "$backup_file"
        fail "Backup criado, mas falhou na validação. Atualização cancelada."
    fi

    log "OK" "Backup criado e validado: ${backup_file}"

    LAST_BACKUP="$backup_file"
}

load_environment() {
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
}

check_worktree() {
    log "INFO" "Verificando alterações locais..."

    local changes

    changes="$(git status --porcelain --untracked-files=normal)"

    if [ -n "$changes" ]; then
        echo
        echo "=================================================="
        echo "       ATUALIZACAO CANCELADA"
        echo "=================================================="
        echo
        echo "Foram encontradas alterações locais no projeto:"
        echo
        echo "$changes"
        echo
        echo "Nenhum arquivo foi alterado pelo atualizador."
        echo
        echo "Revise essas alterações antes de atualizar."
        echo
        echo "=================================================="
        exit 1
    fi

    log "OK" "Nenhuma alteração local encontrada."
}

show_version() {
    CURRENT_COMMIT="$(git rev-parse HEAD)"
    log "INFO" "Versão atual: ${CURRENT_COMMIT}"
}

fetch_update() {
    log "INFO" "Consultando atualizações no Git..."

    git fetch origin

    TARGET_COMMIT="$(git rev-parse origin/main)"

    if [ "$CURRENT_COMMIT" = "$TARGET_COMMIT" ]; then
        log "OK" "O sistema já está atualizado."
        exit 0
    fi

    echo
    echo "Versão instalada:"
    echo "  ${CURRENT_COMMIT}"
    echo
    echo "Nova versão:"
    echo "  ${TARGET_COMMIT}"
    echo

    read -r -p "Deseja continuar com a atualização? [s/N]: " answer

    case "$answer" in
        s|S|sim|SIM|Sim)
            ;;
        *)
            log "INFO" "Atualização cancelada."
            exit 0
            ;;
    esac
}

update_source() {
    log "INFO" "Atualizando código-fonte..."

    # Mantém a instalação em uma branch local própria de produção,
    # apontando exatamente para o commit publicado em origin/main.
    #
    # O check_worktree executado anteriormente garante que não existam
    # alterações locais ou arquivos não rastreados antes desta operação.
    git switch -C production "$TARGET_COMMIT" ||
        fail "Não foi possível trocar para a nova versão."

    log "OK" "Código atualizado para ${TARGET_COMMIT}."
}

rebuild_application() {
    log "INFO" "Construindo nova imagem da aplicação..."

    docker compose -p "$PROJECT_NAME" build app

    log "OK" "Imagem construída."
}

start_application() {
    log "INFO" "Atualizando containers..."

    # IMPORTANTE:
    # Nunca utilizar:
    #
    #
    # O banco deve permanecer no volume persistente.

    docker compose -p "$PROJECT_NAME" up -d

    log "OK" "Containers atualizados."
}

verify_application() {
    log "INFO" "Verificando aplicação após atualização..."

    local app_port
    local attempt

    app_port="${APP_PORT:-5000}"

    # Primeiro confirma o estado dos containers.
    docker compose -p "$PROJECT_NAME" ps

    # Depois testa a aplicação de verdade via HTTP.
    for attempt in {1..60}; do
        if curl -fsS \
            "http://127.0.0.1:${app_port}/" \
            >/dev/null 2>&1; then

            log "OK" "Aplicação respondeu em http://127.0.0.1:${app_port}/"
            return 0
        fi

        sleep 2
    done

    echo
    echo "=================================================="
    echo "       FALHA APOS ATUALIZACAO"
    echo "=================================================="
    echo
    echo "A aplicação não respondeu na porta ${app_port}."
    echo
    echo "O banco de dados NÃO foi apagado."
    echo "Os volumes persistentes NÃO foram removidos."
    echo
    echo "Backup disponível em:"
    echo "  ${LAST_BACKUP}"
    echo
    echo "Últimos logs da aplicação:"
    echo

    docker compose -p "$PROJECT_NAME" logs --tail=100 app || true

    fail "A nova versão não respondeu ao teste HTTP."
}

show_result() {
    echo
    echo "=================================================="
    echo "          ATUALIZACAO CONCLUIDA"
    echo "=================================================="
    echo
    echo "Versão anterior:"
    echo "  ${CURRENT_COMMIT}"
    echo
    echo "Versão atual:"
    git rev-parse HEAD
    echo
    echo "Backup:"
    echo "  ${LAST_BACKUP}"
    echo
    echo "Os volumes do PostgreSQL e uploads foram preservados."
    echo
    echo "=================================================="
}

main() {
    require_root

    cd "$PROJECT_DIR"

    check_dependencies
    check_installation
    load_environment
    wait_for_database
    check_worktree
    show_version
    fetch_update

    backup_database
    update_source
    rebuild_application
    start_application
    verify_application
    show_result
}

main "$@"
