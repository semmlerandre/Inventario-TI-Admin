#!/bin/bash
# ============================================================
#  Inventario TI - Script de Deploy (Linux)
#  Compatível com: Ubuntu, Debian, CentOS, RHEL, Amazon Linux
# ============================================================

set -e

REPO_URL="https://github.com/semmlerandre/Inventario-TI-Admin.git"
APP_DIR="/opt/inventario-ti"
COMPOSE_CMD=""

# ---- Cores ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Inventario TI - Deploy Automatico    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ---- Verificar root ----
if [ "$EUID" -ne 0 ]; then
  log_warn "Este script precisa de permissões de administrador."
  exec sudo bash "$0" "$@"
fi

# ============================================================
# PASSO 1: Instalar Docker se não existir
# ============================================================
install_docker() {
  log_info "Instalando Docker..."

  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
  fi

  case "$OS" in
    ubuntu|debian)
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl gnupg lsb-release
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
      apt-get update -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    centos|rhel|amzn|fedora|rocky|almalinux)
      yum install -y yum-utils
      yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    *)
      log_error "Sistema operacional não suportado. Instale o Docker manualmente: https://docs.docker.com/engine/install/"
      ;;
  esac

  systemctl enable docker
  systemctl start docker
  log_success "Docker instalado com sucesso!"
}

if ! command -v docker &>/dev/null; then
  log_warn "Docker não encontrado. Instalando..."
  install_docker
else
  log_success "Docker encontrado: $(docker --version)"
fi

# ============================================================
# PASSO 2: Verificar Docker Compose
# ============================================================
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  log_success "Docker Compose (plugin) encontrado."
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  log_success "Docker Compose (standalone) encontrado."
else
  log_info "Instalando Docker Compose plugin..."
  apt-get install -y docker-compose-plugin 2>/dev/null || \
  yum install -y docker-compose-plugin 2>/dev/null || \
  log_error "Não foi possível instalar o Docker Compose. Instale manualmente: https://docs.docker.com/compose/install/"
  COMPOSE_CMD="docker compose"
  log_success "Docker Compose instalado!"
fi

# ============================================================
# PASSO 3: Verificar Git
# ============================================================
if ! command -v git &>/dev/null; then
  log_info "Instalando Git..."
  apt-get install -y -qq git 2>/dev/null || yum install -y git 2>/dev/null
  log_success "Git instalado!"
fi

# ============================================================
# PASSO 4: Clonar ou atualizar repositório
# ============================================================
if [ -d "$APP_DIR/.git" ]; then
  log_info "Projeto já existe em $APP_DIR. Atualizando..."
  cd "$APP_DIR"
  git pull origin main || git pull origin master
  log_success "Código atualizado!"
else
  log_info "Clonando repositório para $APP_DIR..."
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  log_success "Repositório clonado!"
fi

cd "$APP_DIR"

# ============================================================
# PASSO 5: Configurar .env se não existir
# ============================================================
if [ ! -f ".env" ]; then
  log_info "Criando arquivo de configuração .env..."
  cp .env.example .env

  SESSION_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#$%' | head -c 64)
  sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|g" .env

  log_warn "Arquivo .env criado com configurações padrão."
  log_warn "Edite $APP_DIR/.env para personalizar as configurações antes de continuar."
  echo ""
  echo -e "${YELLOW}Pressione ENTER para continuar com as configurações padrão, ou Ctrl+C para editar o .env primeiro.${NC}"
  read -r
else
  log_success "Arquivo .env já existe, mantendo configurações atuais."
fi

# ============================================================
# PASSO 6: Build e inicialização dos containers
# ============================================================
log_info "Verificando se há containers em execução..."
if $COMPOSE_CMD ps --services --filter "status=running" 2>/dev/null | grep -q .; then
  log_info "Parando containers antigos..."
  $COMPOSE_CMD down
fi

log_info "Construindo imagem Docker (pode demorar alguns minutos na primeira vez)..."
$COMPOSE_CMD build --no-cache

log_info "Iniciando containers..."
$COMPOSE_CMD up -d

# ============================================================
# PASSO 7: Aguardar app inicializar e exibir status
# ============================================================
log_info "Aguardando a aplicação inicializar..."
sleep 15

APP_PORT=$(grep "APP_PORT" .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "5000")
APP_PORT=${APP_PORT:-5000}

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}========================================"
echo -e "   Deploy concluído com sucesso!"
echo -e "========================================${NC}"
echo ""
echo -e "  ${GREEN}Aplicação:${NC} http://localhost:$APP_PORT"
echo -e "  ${GREEN}Rede local:${NC} http://$SERVER_IP:$APP_PORT"
echo ""
echo -e "  ${BLUE}Login padrão:${NC}"
echo -e "    Usuário: admin"
echo -e "    Senha:   admin123"
echo ""
echo -e "  ${YELLOW}Comandos úteis:${NC}"
echo -e "    Ver logs:      cd $APP_DIR && $COMPOSE_CMD logs -f app"
echo -e "    Reiniciar:     cd $APP_DIR && $COMPOSE_CMD restart"
echo -e "    Parar:         cd $APP_DIR && $COMPOSE_CMD down"
echo -e "    Atualizar:     sudo bash $APP_DIR/deploy.sh"
echo ""

$COMPOSE_CMD ps
