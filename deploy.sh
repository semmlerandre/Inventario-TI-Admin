#!/bin/bash
# ================================================================
#  Inventario TI — Script de Instalação/Atualização (Linux)
#
#  Comportamento:
#    - Se Docker estiver instalado → usa Docker (recomendado)
#    - Se Docker NÃO estiver instalado → instalação nativa
#      (Node.js 20 + PostgreSQL + PM2)
#
#  Proteção de dados:
#    - Backup automático antes de qualquer operação no banco
#    - Restauração automática se dados forem perdidos
#    - Nunca apaga dados sem confirmação explícita do usuário
#
#  Uso:
#    curl -fsSL https://raw.githubusercontent.com/semmlerandre/Inventario-TI-Admin/main/deploy.sh | sudo bash
#    ou:
#    sudo bash deploy.sh
# ================================================================

set -e

REPO_URL="https://github.com/semmlerandre/Inventario-TI-Admin.git"
APP_DIR="/opt/inventario-ti"
BACKUP_DIR="${APP_DIR}/db-backup"
APP_PORT=5000
IS_FRESH_INSTALL=false
USE_DOCKER=false
COMPOSE_CMD=""

# ── Cores ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC}  $1"; exit 1; }
log_step()    { echo -e "\n${CYAN}${BOLD}>>> $1${NC}"; }
log_backup()  { echo -e "${GREEN}[BACKUP]${NC} $1"; }

# ── Banner ──────────────────────────────────────────────────────
clear
echo -e "${BLUE}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       Inventario TI — Deploy Automático      ║"
echo "  ║         Linux · Instalação / Atualização     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Repositório: ${CYAN}${REPO_URL}${NC}"
echo -e "  Diretório:   ${CYAN}${APP_DIR}${NC}"
echo ""

# ── Root ────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  log_warn "Executando com sudo..."
  exec sudo bash "$0" "$@"
fi

# ================================================================
# FUNÇÕES DE BACKUP E RESTAURAÇÃO (Docker)
# ================================================================

# Realiza backup completo via container Docker
backup_database_docker() {
  local db_user="$1" db_name="$2"
  mkdir -p "$BACKUP_DIR"

  log_step "Fazendo backup do banco de dados antes de atualizar..."

  # Inicia só o container do banco se necessário
  if ! docker exec inventario-ti-db psql -U "$db_user" -d "$db_name" -c "SELECT 1" &>/dev/null 2>&1; then
    log_info "Iniciando container do banco para backup..."
    $COMPOSE_CMD up -d db 2>/dev/null || true
    local tries=0
    while [ $tries -lt 12 ]; do
      sleep 5
      if docker exec inventario-ti-db psql -U "$db_user" -d "$db_name" -c "SELECT 1" &>/dev/null 2>&1; then
        break
      fi
      tries=$((tries + 1))
    done
  fi

  if docker exec inventario-ti-db psql -U "$db_user" -d "$db_name" -c "SELECT 1" &>/dev/null 2>&1; then
    local backup_file="$BACKUP_DIR/latest.sql"
    local backup_ts="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

    # Dump completo de dados (sem schema, sem DROP)
    docker exec inventario-ti-db pg_dump \
      -U "$db_user" \
      -d "$db_name" \
      --data-only \
      --column-inserts \
      --no-privileges \
      2>/dev/null > "$backup_file"

    cp "$backup_file" "$backup_ts"
    echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$BACKUP_DIR/timestamp"

    local size
    size=$(wc -c < "$backup_file" 2>/dev/null || echo 0)
    if [ "$size" -gt 100 ]; then
      log_backup "Backup realizado com sucesso → ${backup_file} (${size} bytes)"
      log_backup "Cópia histórica → ${backup_ts}"
      return 0
    else
      log_warn "Backup gerado mas parece vazio — banco pode estar sem dados ainda."
      return 0
    fi
  else
    log_warn "Não foi possível conectar ao banco para backup (pode ser instalação nova)."
    return 0
  fi
}

# Restaura backup se o banco estiver vazio após migrações (Docker)
restore_database_docker() {
  local db_user="$1" db_name="$2"
  local backup_file="$BACKUP_DIR/latest.sql"

  if [ ! -f "$backup_file" ]; then
    log_info "Nenhum backup encontrado — usando dados padrão."
    return 0
  fi

  local size
  size=$(wc -c < "$backup_file" 2>/dev/null || echo 0)
  if [ "$size" -le 100 ]; then
    log_info "Arquivo de backup vazio — pulando restauração."
    return 0
  fi

  log_step "Verificando necessidade de restauração de dados..."

  # Aguarda banco ficar disponível
  local tries=0
  while [ $tries -lt 12 ]; do
    sleep 5
    if docker exec inventario-ti-db psql -U "$db_user" -d "$db_name" -c "SELECT 1" &>/dev/null 2>&1; then
      break
    fi
    tries=$((tries + 1))
  done

  # Verifica se a tabela settings tem dados
  local count
  count=$(docker exec inventario-ti-db psql -U "$db_user" -d "$db_name" -t -c \
    "SELECT COUNT(*) FROM settings;" 2>/dev/null | tr -d ' \n' || echo "0")

  if [ "$count" = "0" ] || [ -z "$count" ]; then
    log_backup "Banco vazio detectado — restaurando dados do backup..."
    docker cp "$backup_file" "inventario-ti-db:/tmp/restore.sql" 2>/dev/null

    # Restaura ignorando erros de conflito (ON CONFLICT silencioso)
    docker exec inventario-ti-db psql -U "$db_user" -d "$db_name" \
      -c "SET session_replication_role = replica;" \
      -f "/tmp/restore.sql" \
      2>/dev/null && \
      log_backup "Dados restaurados com sucesso do backup de $(cat "$BACKUP_DIR/timestamp" 2>/dev/null || echo 'data desconhecida')!" || \
      log_warn "Restauração com avisos (conflitos ignorados — dados existentes foram mantidos)."
  else
    log_ok "Banco de dados com ${count} configuração(ões) — dados preservados, restauração não necessária."
  fi
}

# ================================================================
# FUNÇÕES DE BACKUP E RESTAURAÇÃO (Nativo / sem Docker)
# ================================================================

backup_database_native() {
  local db_user="$1" db_pass="$2" db_name="$3"
  mkdir -p "$BACKUP_DIR"

  log_step "Fazendo backup do banco de dados antes de atualizar..."

  if ! PGPASSWORD="$db_pass" psql -U "$db_user" -h localhost -d "$db_name" -c "SELECT 1" &>/dev/null 2>&1; then
    log_warn "Banco não acessível — pulando backup (pode ser nova instalação)."
    return 0
  fi

  local backup_file="$BACKUP_DIR/latest.sql"
  local backup_ts="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

  PGPASSWORD="$db_pass" pg_dump \
    -U "$db_user" \
    -h localhost \
    -d "$db_name" \
    --data-only \
    --column-inserts \
    --no-privileges \
    2>/dev/null > "$backup_file"

  cp "$backup_file" "$backup_ts"
  echo "$(date '+%Y-%m-%d %H:%M:%S')" > "$BACKUP_DIR/timestamp"

  local size
  size=$(wc -c < "$backup_file" 2>/dev/null || echo 0)
  if [ "$size" -gt 100 ]; then
    log_backup "Backup realizado → ${backup_file} (${size} bytes)"
    return 0
  else
    log_warn "Backup vazio — banco sem dados ainda."
    return 0
  fi
}

restore_database_native() {
  local db_user="$1" db_pass="$2" db_name="$3"
  local backup_file="$BACKUP_DIR/latest.sql"

  if [ ! -f "$backup_file" ]; then
    log_info "Nenhum backup encontrado — usando dados padrão."
    return 0
  fi

  local size
  size=$(wc -c < "$backup_file" 2>/dev/null || echo 0)
  if [ "$size" -le 100 ]; then
    return 0
  fi

  log_step "Verificando necessidade de restauração de dados..."

  local count
  count=$(PGPASSWORD="$db_pass" psql -U "$db_user" -h localhost -d "$db_name" -t \
    -c "SELECT COUNT(*) FROM settings;" 2>/dev/null | tr -d ' \n' || echo "0")

  if [ "$count" = "0" ] || [ -z "$count" ]; then
    log_backup "Restaurando dados do backup..."
    PGPASSWORD="$db_pass" psql -U "$db_user" -h localhost -d "$db_name" \
      -f "$backup_file" 2>/dev/null && \
      log_backup "Dados restaurados do backup de $(cat "$BACKUP_DIR/timestamp" 2>/dev/null || echo 'data desconhecida')!" || \
      log_warn "Restauração com avisos (conflitos ignorados)."
  else
    log_ok "Banco já tem dados — restauração não necessária."
  fi
}

# ================================================================
# DETECTAR MODO: DOCKER ou NATIVO
# ================================================================
log_step "Detectando modo de instalação..."

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  USE_DOCKER=true
  log_ok "Docker detectado → instalação via Docker"

  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    log_warn "Docker Compose não encontrado. Instalando..."
    apt-get install -y docker-compose-plugin 2>/dev/null || \
    yum install -y docker-compose-plugin 2>/dev/null || \
    log_error "Não foi possível instalar o Docker Compose."
    COMPOSE_CMD="docker compose"
  fi
  log_ok "Modo: Docker ($COMPOSE_CMD)"
else
  USE_DOCKER=false
  log_warn "Docker não encontrado → instalação nativa (Node.js + PostgreSQL + PM2)"
fi

# ================================================================
# INSTALAR DEPENDÊNCIAS NATIVAS (quando não há Docker)
# ================================================================
install_node() {
  log_step "Instalando Node.js 20..."
  if command -v node &>/dev/null && [[ "$(node -v)" == v20* ]]; then
    log_ok "Node.js 20 já instalado: $(node -v)"
    return
  fi

  . /etc/os-release 2>/dev/null || true
  case "${ID}" in
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
      ;;
    centos|rhel|amzn|rocky|almalinux|fedora)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      yum install -y nodejs
      ;;
    *)
      log_warn "Distribuição não reconhecida. Instalando Node.js via NVM..."
      export NVM_DIR="/root/.nvm"
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      # shellcheck disable=SC1090
      source "$NVM_DIR/nvm.sh"
      nvm install 20
      nvm use 20
      nvm alias default 20
      ln -sf "$(which node)" /usr/local/bin/node
      ln -sf "$(which npm)"  /usr/local/bin/npm
      ;;
  esac
  log_ok "Node.js instalado: $(node -v)"
}

install_postgresql() {
  log_step "Instalando PostgreSQL..."
  if command -v psql &>/dev/null; then
    log_ok "PostgreSQL já instalado: $(psql --version)"
    return
  fi

  . /etc/os-release 2>/dev/null || true
  case "${ID}" in
    ubuntu|debian)
      apt-get update -qq
      apt-get install -y postgresql postgresql-contrib
      ;;
    centos|rhel|amzn|rocky|almalinux|fedora)
      yum install -y postgresql-server postgresql-contrib
      postgresql-setup --initdb 2>/dev/null || postgresql-setup initdb 2>/dev/null || true
      ;;
    *)
      log_error "Instale PostgreSQL manualmente para sua distribuição."
      ;;
  esac

  systemctl enable postgresql
  systemctl start postgresql
  log_ok "PostgreSQL instalado e iniciado."
}

install_pm2() {
  log_step "Instalando PM2 (gerenciador de processos)..."
  if command -v pm2 &>/dev/null; then
    log_ok "PM2 já instalado: $(pm2 --version)"
    return
  fi
  npm install -g pm2
  log_ok "PM2 instalado."
}

setup_postgres_db() {
  local db_user="$1" db_pass="$2" db_name="$3"
  log_step "Configurando banco de dados PostgreSQL..."

  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" 2>/dev/null | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${db_user} WITH PASSWORD '${db_pass}';" && \
    log_ok "Usuário '${db_user}' criado."

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" 2>/dev/null | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${db_name} OWNER ${db_user};" && \
    log_ok "Banco '${db_name}' criado."

  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${db_name} TO ${db_user};" 2>/dev/null || true
  log_ok "Banco de dados configurado."
}

# ================================================================
# INSTALAR GIT
# ================================================================
install_git() {
  if command -v git &>/dev/null; then
    log_ok "Git já instalado: $(git --version)"
    return
  fi
  log_step "Instalando Git..."
  apt-get install -y git 2>/dev/null || yum install -y git 2>/dev/null || \
    log_error "Não foi possível instalar o Git."
  log_ok "Git instalado."
}

install_git

# ================================================================
# CLONAR OU ATUALIZAR REPOSITÓRIO
# ================================================================
log_step "Verificando repositório..."

if [ -d "$APP_DIR/.git" ]; then
  IS_FRESH_INSTALL=false
  log_info "Projeto já existe em ${APP_DIR}. Atualizando código..."
  cd "$APP_DIR"
  git fetch --all
  git reset --hard origin/main 2>/dev/null || git reset --hard origin/master
  log_ok "Código atualizado para a versão mais recente!"
else
  IS_FRESH_INSTALL=true
  log_info "Clonando repositório para ${APP_DIR}..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  log_ok "Repositório clonado!"
fi

cd "$APP_DIR"

# ================================================================
# MODO DOCKER
# ================================================================
if [ "$USE_DOCKER" = true ]; then

  # ── .env ──────────────────────────────────────────────────────
  log_step "Configurando variáveis de ambiente..."
  if [ ! -f ".env" ]; then
    cp .env.example .env
    SESSION_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
    sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|g" .env
    log_warn "Arquivo .env criado com configurações padrão em: ${APP_DIR}/.env"
    echo ""
    echo -e "  ${YELLOW}Pressione ENTER para usar as configurações padrão,"
    echo -e "  ou Ctrl+C para editar o .env primeiro.${NC}"
    read -r
  else
    log_ok "Arquivo .env já existe, mantendo configurações."
  fi

  # ── Detectar volume existente do banco (fonte de verdade) ─────
  # IMPORTANTE: O nome do projeto Docker Compose preserva hífens.
  # Ex: diretório "inventario-ti" → volume "inventario-ti_postgres_data"
  log_step "Verificando volumes do banco de dados..."
  PROJECT_NAME=$(basename "$APP_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
  POSTGRES_VOLUME="${PROJECT_NAME}_postgres_data"
  DB_VOLUME_EXISTS=false

  if docker volume inspect "$POSTGRES_VOLUME" &>/dev/null 2>&1; then
    DB_VOLUME_EXISTS=true
    log_ok "Volume do banco encontrado: ${POSTGRES_VOLUME} (dados serão preservados)"
  else
    DB_VOLUME_EXISTS=false
    log_info "Nenhum volume de banco existente — instalação limpa."
  fi

  # ── Carregar credenciais do .env ──────────────────────────────
  DB_USER_ENV=$(grep "^DB_USER="     .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "inventario")
  DB_PASS_ENV=$(grep "^DB_PASSWORD=" .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "inventario123")
  DB_NAME_ENV=$(grep "^DB_NAME="     .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "inventario")

  # ── Verificar conflito de credenciais ─────────────────────────
  if [ "$DB_VOLUME_EXISTS" = true ]; then
    log_info "Verificando credenciais do banco de dados..."
    $COMPOSE_CMD up -d db 2>/dev/null || true
    sleep 8

    CRED_OK=false
    if docker exec inventario-ti-db \
        psql -U "$DB_USER_ENV" -d "$DB_NAME_ENV" -c "SELECT 1;" &>/dev/null 2>&1; then
      CRED_OK=true
      log_ok "Credenciais verificadas — banco acessível."
    fi

    if [ "$CRED_OK" = false ]; then
      $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
      echo ""
      echo -e "${RED}${BOLD}"
      echo "  ╔══════════════════════════════════════════════════════╗"
      echo "  ║   CONFLITO DE CREDENCIAIS DETECTADO                  ║"
      echo "  ╠══════════════════════════════════════════════════════╣"
      echo "  ║  O banco de dados já existe com credenciais          ║"
      echo "  ║  diferentes das que estão no arquivo .env.           ║"
      echo "  ╚══════════════════════════════════════════════════════╝"
      echo -e "${NC}"
      echo -e "  ${YELLOW}Escolha uma opção:${NC}"
      echo ""
      echo -e "  ${GREEN}[1]${NC} Corrigir o .env para usar as credenciais antigas"
      echo -e "      (recomendado se você tem dados importantes)"
      echo ""
      echo -e "  ${RED}[2]${NC} Apagar o banco e reinstalar do zero"
      echo -e "      ${RED}ATENÇÃO: todos os dados serão perdidos!${NC}"
      echo ""
      echo -e "  ${YELLOW}[3]${NC} Cancelar"
      echo ""
      echo -n "  Digite 1, 2 ou 3 e pressione ENTER: "
      read -r CHOICE

      case "$CHOICE" in
        1)
          echo ""
          log_warn "Abra o arquivo .env e ajuste DB_USER, DB_PASSWORD e DB_NAME"
          log_warn "para corresponder às credenciais usadas na instalação anterior."
          echo ""
          echo -e "  Arquivo: ${CYAN}${APP_DIR}/.env${NC}"
          echo ""
          echo -e "  ${YELLOW}Após editar o .env, execute o script novamente:${NC}"
          echo -e "    sudo bash ${APP_DIR}/deploy.sh"
          exit 0
          ;;
        2)
          echo ""
          log_warn "Removendo volume do banco de dados (dados serão perdidos)..."
          docker volume rm "$POSTGRES_VOLUME" 2>/dev/null || true
          DB_VOLUME_EXISTS=false
          log_ok "Volume removido. Continuando com instalação limpa..."
          ;;
        *)
          log_info "Operação cancelada."
          exit 0
          ;;
      esac
    fi
  fi

  # ── BACKUP antes de qualquer operação destrutiva ──────────────
  if [ "$DB_VOLUME_EXISTS" = true ]; then
    backup_database_docker "$DB_USER_ENV" "$DB_NAME_ENV"
  fi

  # ── Parar containers ──────────────────────────────────────────
  log_step "Preparando containers..."
  if [ "$DB_VOLUME_EXISTS" = false ]; then
    $COMPOSE_CMD down --volumes --remove-orphans 2>/dev/null || true
    log_info "Ambiente limpo para nova instalação."
  else
    $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
    log_info "Dados do banco preservados no volume ${POSTGRES_VOLUME}."
  fi

  # ── Build + Start ──────────────────────────────────────────────
  log_step "Construindo imagem Docker (pode demorar na 1ª vez)..."
  $COMPOSE_CMD build --no-cache
  log_ok "Imagem construída!"

  log_step "Iniciando serviços..."
  $COMPOSE_CMD up -d
  log_ok "Containers iniciados!"

  # ── Aguardar banco ficar pronto e aplicar migrações ──────────
  log_info "Aguardando inicialização da aplicação (banco + migrações)..."
  sleep 25

  # ── RESTAURAR backup se banco estiver vazio ───────────────────
  restore_database_docker "$DB_USER_ENV" "$DB_NAME_ENV"

  # Verifica se houve erro de autenticação
  LOGS_APP=$($COMPOSE_CMD logs --tail=60 app 2>/dev/null || true)
  if echo "$LOGS_APP" | grep -q "password authentication failed"; then
    echo ""
    echo -e "${RED}${BOLD}"
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║   ERRO: Falha de autenticação no banco de dados      ║"
    echo "  ╠══════════════════════════════════════════════════════╣"
    echo "  ║  O volume do banco foi criado com credenciais        ║"
    echo "  ║  diferentes das que estão no arquivo .env atual.     ║"
    echo "  ╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "  ${YELLOW}Como resolver:${NC}"
    echo ""
    echo -e "  ${GREEN}Opção A — Corrigir o .env:${NC}"
    echo -e "    Ajuste DB_USER, DB_PASSWORD, DB_NAME no arquivo:"
    echo -e "    ${CYAN}${APP_DIR}/.env${NC}"
    echo -e "    para as mesmas credenciais usadas na instalação anterior."
    echo -e "    Depois execute: ${GREEN}sudo bash ${APP_DIR}/deploy.sh${NC}"
    echo ""
    echo -e "  ${RED}Opção B — Reinstalar do zero (apaga todos os dados):${NC}"
    echo -e "    cd ${APP_DIR}"
    echo -e "    ${COMPOSE_CMD} down --volumes"
    echo -e "    sudo bash deploy.sh"
    echo ""
    $COMPOSE_CMD logs --tail=30 app
    exit 1
  fi

  APP_PORT_ENV=$(grep "^APP_PORT" .env 2>/dev/null | cut -d= -f2 | tr -d ' ')
  APP_PORT="${APP_PORT_ENV:-5000}"
  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

  echo ""
  if $COMPOSE_CMD ps | grep -qE "Up|running"; then
    echo -e "${GREEN}${BOLD}"
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║        Deploy Docker concluído!              ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  ${GREEN}Aplicação:${NC}  http://localhost:${APP_PORT}"
    [ -n "$SERVER_IP" ] && echo -e "  ${GREEN}Rede local:${NC} http://${SERVER_IP}:${APP_PORT}"
    echo ""
    echo -e "  ${CYAN}Backups do banco:${NC}  ${BACKUP_DIR}/"
    echo ""
    echo -e "  ${CYAN}Credenciais padrão:${NC}"
    echo -e "    Usuário: ${GREEN}admin${NC}"
    echo -e "    Senha:   ${GREEN}admin123${NC}"
    echo ""
    echo -e "  ${YELLOW}Comandos úteis:${NC}"
    echo -e "    Logs:       cd ${APP_DIR} && ${COMPOSE_CMD} logs -f app"
    echo -e "    Reiniciar:  cd ${APP_DIR} && ${COMPOSE_CMD} restart"
    echo -e "    Parar:      cd ${APP_DIR} && ${COMPOSE_CMD} down"
    echo -e "    Atualizar:  sudo bash ${APP_DIR}/deploy.sh"
    echo ""
    $COMPOSE_CMD ps
  else
    echo -e "${RED}${BOLD}"
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║   ATENÇÃO: App pode não ter iniciado!        ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  Verifique: cd ${APP_DIR} && ${COMPOSE_CMD} logs app"
    $COMPOSE_CMD ps
    $COMPOSE_CMD logs --tail=50 app
  fi

  exit 0
fi

# ================================================================
# MODO NATIVO (sem Docker)
# ================================================================
log_warn "Iniciando instalação nativa (sem Docker)..."

install_node
install_postgresql
install_pm2

# ── Configurar .env nativo ─────────────────────────────────────
log_step "Configurando variáveis de ambiente..."

if [ ! -f ".env" ]; then
  SESSION_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
  DB_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 24)

  cat > .env << EOF
# Inventario TI — Configuração (instalação nativa)
APP_PORT=${APP_PORT}
DB_USER=inventario
DB_PASSWORD=${DB_PASS}
DB_NAME=inventario
DB_PORT=5432
DATABASE_URL=postgres://inventario:${DB_PASS}@localhost:5432/inventario
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
EOF
  log_ok "Arquivo .env criado em ${APP_DIR}/.env"
  log_warn "Senha do banco gerada automaticamente. Guarde-a!"
else
  log_ok "Arquivo .env já existe, mantendo configurações."
  if ! grep -q "^DATABASE_URL=" .env; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2)
    DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d= -f2)
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2)
    echo "DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}" >> .env
    log_info "DATABASE_URL adicionada ao .env."
  fi
fi

# Carrega variáveis
set -a; source .env 2>/dev/null || true; set +a

# ── Carregar variáveis do banco ────────────────────────────────
DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d ' ')
DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d= -f2 | tr -d ' ')
DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d ' ')

# ── BACKUP antes de atualizar ──────────────────────────────────
backup_database_native "$DB_USER" "$DB_PASS" "$DB_NAME"

# ── Configurar banco ───────────────────────────────────────────
setup_postgres_db "$DB_USER" "$DB_PASS" "$DB_NAME"

# ── Instalar dependências Node ─────────────────────────────────
log_step "Instalando dependências Node.js..."
npm install --prefer-offline 2>/dev/null || npm install
log_ok "Dependências instaladas!"

# ── Build ──────────────────────────────────────────────────────
log_step "Compilando a aplicação (frontend + backend)..."
npm run build
log_ok "Build concluído!"

# ── Migrations ────────────────────────────────────────────────
log_step "Executando migrações do banco de dados..."
MAX_TRIES=5
for i in $(seq 1 $MAX_TRIES); do
  DATABASE_URL="${DATABASE_URL}" node dist/migrate.cjs && { log_ok "Migrações aplicadas!"; break; } || {
    if [ $i -eq $MAX_TRIES ]; then
      log_error "Falha nas migrações após ${MAX_TRIES} tentativas."
    fi
    log_warn "Tentativa ${i} falhou, aguardando 5s..."
    sleep 5
  }
done

# ── RESTAURAR backup se banco estiver vazio ────────────────────
restore_database_native "$DB_USER" "$DB_PASS" "$DB_NAME"

# ── PM2: iniciar / reiniciar ───────────────────────────────────
log_step "Gerenciando processo com PM2..."

cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'inventario-ti',
    script: 'dist/index.cjs',
    cwd: '${APP_DIR}',
    env: {
      NODE_ENV: 'production',
      PORT: '${APP_PORT}',
      DATABASE_URL: '${DATABASE_URL}',
      SESSION_SECRET: '${SESSION_SECRET}',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
EOF

if pm2 describe inventario-ti &>/dev/null; then
  pm2 reload ecosystem.config.cjs --update-env
  log_ok "Aplicação recarregada via PM2!"
else
  pm2 start ecosystem.config.cjs
  log_ok "Aplicação iniciada via PM2!"
fi

pm2 save

pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || \
  log_warn "Configure manualmente o startup do PM2: 'pm2 startup'"

sleep 5

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     Instalação Nativa concluída!             ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${GREEN}Aplicação:${NC}  http://localhost:${APP_PORT}"
[ -n "$SERVER_IP" ] && echo -e "  ${GREEN}Rede local:${NC} http://${SERVER_IP}:${APP_PORT}"
echo ""
echo -e "  ${CYAN}Backups do banco:${NC}  ${BACKUP_DIR}/"
echo ""
echo -e "  ${CYAN}Credenciais padrão:${NC}"
echo -e "    Usuário: ${GREEN}admin${NC}"
echo -e "    Senha:   ${GREEN}admin123${NC}"
echo ""
echo -e "  ${YELLOW}Comandos úteis:${NC}"
echo -e "    Status:     pm2 status"
echo -e "    Logs:       pm2 logs inventario-ti"
echo -e "    Reiniciar:  pm2 restart inventario-ti"
echo -e "    Parar:      pm2 stop inventario-ti"
echo -e "    Atualizar:  sudo bash ${APP_DIR}/deploy.sh"
echo ""
echo -e "  ${YELLOW}Banco de dados:${NC}"
echo -e "    Host:  localhost:5432"
echo -e "    Banco: ${DB_NAME}"
echo -e "    Usuário: ${DB_USER}"
echo ""
pm2 list
