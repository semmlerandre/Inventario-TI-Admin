#!/bin/bash
# ================================================================
#  Inventario TI — Script de Instalação/Atualização (Linux)
#
#  Comportamento:
#    - Se Docker estiver instalado → usa Docker (recomendado)
#    - Se Docker NÃO estiver instalado → instalação nativa
#      (Node.js 20 + PostgreSQL + PM2)
#
#  Uso:
#    curl -fsSL https://raw.githubusercontent.com/semmlerandre/Inventario-TI-Admin/main/deploy.sh | sudo bash
#    ou:
#    sudo bash deploy.sh
# ================================================================

set -e

REPO_URL="https://github.com/semmlerandre/Inventario-TI-Admin.git"
APP_DIR="/opt/inventario-ti"
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
      # Fallback via NVM
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

  # Garante privilégios
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

  # ── Parar containers ──────────────────────────────────────────
  log_step "Preparando containers..."
  if [ "$IS_FRESH_INSTALL" = true ]; then
    $COMPOSE_CMD down --volumes --remove-orphans 2>/dev/null || true
    log_info "Ambiente limpo para nova instalação."
  else
    $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
    log_info "Dados do banco preservados."
  fi

  # ── Build + Start ──────────────────────────────────────────────
  log_step "Construindo imagem Docker (pode demorar na 1ª vez)..."
  $COMPOSE_CMD build --no-cache
  log_ok "Imagem construída!"

  log_step "Iniciando serviços..."
  $COMPOSE_CMD up -d
  log_ok "Containers iniciados!"

  # ── Aguardar e exibir status ───────────────────────────────────
  log_info "Aguardando inicialização da aplicação..."
  sleep 20

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
  # Garante que DATABASE_URL existe no .env
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

# ── Configurar banco ───────────────────────────────────────────
DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2 | tr -d ' ')
DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d= -f2 | tr -d ' ')
DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2 | tr -d ' ')

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

# ── PM2: iniciar / reiniciar ───────────────────────────────────
log_step "Gerenciando processo com PM2..."

# Gera arquivo ecosystem para PM2
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

# Configurar inicialização automática
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
