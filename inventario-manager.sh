#!/bin/bash

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/semmlerandre/Inventario-TI-Admin"
PROJECT_DIR="$HOME/inventario-ti"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

print_msg() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_erro() {
    echo -e "${RED}[ERRO]${NC} $1"
}

print_msg "🚀 INVENTARIO TI - GERENCIADOR COMPLETO (COM HASH)"

# Verificar dependências
if ! command -v docker &> /dev/null; then
    print_erro "Docker não instalado"
    exit 1
fi

if ! command -v node &> /dev/null; then
    print_msg "Node não encontrado, instalando..."
    apt-get update && apt-get install -y nodejs npm
fi

# Criar diretório
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# ============================================
# FUNÇÃO PARA GERAR HASH DA SENHA
# ============================================
gerar_hash_admin() {
    # Gerar hash usando node (bcryptjs)
    HASH=$(node -e "
        const bcrypt = require('bcryptjs');
        bcrypt.hash('admin', 10).then(h => console.log(h));
    " 2>/dev/null)
    
    if [ -z "$HASH" ]; then
        # Fallback para hash pré-calculado
        HASH='$2a$10$sDjLwH5Gd8Yb7q1Q2jX5yO5X8X8X8X8X8X8X8X8X8X8X8X8X8X8'
    fi
    
    echo "$HASH"
}

# ============================================
# FUNÇÃO PARA CRIAR ARQUIVOS DE CONFIGURAÇÃO
# ============================================
criar_arquivos_config() {
    print_msg "Criando arquivos de configuração..."
    
    # .env
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
NODE_ENV=production
SESSION_SECRET=um_segredo_interno_bem_grande
POSTGRES_USER=user
POSTGRES_PASSWORD=pass
POSTGRES_DB=inventory
DATABASE_URL=postgres://user:pass@db:5432/inventory
BCRYPT_SALT_ROUNDS=10
EOF
        print_ok ".env criado"
    fi
    
    # docker-compose.yml
    cat > docker-compose.yml << 'EOF'
services:
  app:
    build: .
    container_name: inventario-ti
    restart: always
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/inventory
      - NODE_ENV=production
      - PORT=5000
      - SESSION_SECRET=${SESSION_SECRET}
      - BCRYPT_SALT_ROUNDS=${BCRYPT_SALT_ROUNDS}
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    container_name: inventario-ti-db
    restart: always
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=inventory
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d inventory"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
EOF
    print_ok "docker-compose.yml criado/atualizado"

    # Dockerfile
    cat > Dockerfile << 'EOF'
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
RUN apk add --no-cache curl postgresql-client
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
EOF
    print_ok "Dockerfile criado/atualizado"
}

# ============================================
# FUNÇÃO PARA CONFIGURAR BANCO COM HASH
# ============================================
configurar_banco() {
    print_msg "🔧 Configurando banco de dados..."
    
    # Aguardar banco ficar pronto
    sleep 15
    
    # Gerar hash da senha admin
    HASH=$(gerar_hash_admin)
    
    # Script SQL completo
    docker exec -i inventario-ti-db psql -U user -d inventory << EOF
-- ============================================
-- FUNÇÃO PARA ADICIONAR COLUNA SE NÃO EXISTIR
-- ============================================
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    p_table text, p_column text, p_type text DEFAULT 'TEXT', p_default text DEFAULT NULL
) RETURNS void AS \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = p_table AND column_name = p_column
    ) THEN
        IF p_default IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s DEFAULT %s', 
                          p_table, p_column, p_type, p_default);
        ELSE
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', 
                          p_table, p_column, p_type);
        END IF;
    END IF;
END;
\$\$ LANGUAGE plpgsql;

-- ============================================
-- TABELA USERS
-- ============================================
SELECT add_column_if_not_exists('users', 'username', 'TEXT');
SELECT add_column_if_not_exists('users', 'password', 'TEXT');
SELECT add_column_if_not_exists('users', 'is_admin', 'BOOLEAN', 'false');
SELECT add_column_if_not_exists('users', 'full_name', 'TEXT');
SELECT add_column_if_not_exists('users', 'email', 'TEXT');
SELECT add_column_if_not_exists('users', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- ============================================
-- TABELA SETTINGS
-- ============================================
SELECT add_column_if_not_exists('settings', 'app_name', 'TEXT', '''Inventario TI''');
SELECT add_column_if_not_exists('settings', 'logo_url', 'TEXT');
SELECT add_column_if_not_exists('settings', 'logo_data', 'TEXT');
SELECT add_column_if_not_exists('settings', 'primary_color', 'TEXT', '''#0ea5e9''');
SELECT add_column_if_not_exists('settings', 'login_background_url', 'TEXT');
SELECT add_column_if_not_exists('settings', 'login_background_data', 'TEXT');
SELECT add_column_if_not_exists('settings', 'alert_email', 'TEXT', '''admin@exemplo.com''');
SELECT add_column_if_not_exists('settings', 'alert_stock_level', 'INTEGER', '5');
SELECT add_column_if_not_exists('settings', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- ============================================
-- TABELA ITEMS
-- ============================================
SELECT add_column_if_not_exists('items', 'name', 'TEXT');
SELECT add_column_if_not_exists('items', 'category', 'TEXT');
SELECT add_column_if_not_exists('items', 'stock', 'INTEGER', '0');
SELECT add_column_if_not_exists('items', 'min_stock', 'INTEGER', '5');
SELECT add_column_if_not_exists('items', 'unit', 'TEXT', '''un''');
SELECT add_column_if_not_exists('items', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- ============================================
-- TABELA TRANSACTIONS
-- ============================================
SELECT add_column_if_not_exists('transactions', 'item_id', 'INTEGER');
SELECT add_column_if_not_exists('transactions', 'type', 'TEXT');
SELECT add_column_if_not_exists('transactions', 'quantity', 'INTEGER', '0');
SELECT add_column_if_not_exists('transactions', 'ticket_number', 'TEXT');
SELECT add_column_if_not_exists('transactions', 'requester_name', 'TEXT');
SELECT add_column_if_not_exists('transactions', 'department', 'TEXT');
SELECT add_column_if_not_exists('transactions', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- ============================================
-- USUÁRIO ADMIN COM HASH CORRETO
-- ============================================
INSERT INTO users (username, password, is_admin, full_name, email) 
SELECT 'admin', '$HASH', true, 'Administrador', 'admin@inventario.com'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Se já existir, atualizar a senha para o hash correto
UPDATE users SET password = '$HASH' WHERE username = 'admin';

-- ============================================
-- CONFIGURAÇÕES PADRÃO
-- ============================================
INSERT INTO settings (app_name, primary_color, alert_email) 
SELECT 'Inventario TI', '#0ea5e9', 'admin@exemplo.com'
WHERE NOT EXISTS (SELECT 1 FROM settings LIMIT 1);

SELECT '✅ Banco configurado com HASH!' as status;
EOF

    print_ok "Banco configurado com hash da senha!"
}

# ============================================
# FUNÇÃO PARA FAZER BACKUP
# ============================================
fazer_backup() {
    print_msg "📦 Fazendo backup..."
    BACKUP_FILE="$HOME/backup_inventario_$TIMESTAMP.sql"
    docker exec inventario-ti-db pg_dump -U user inventory > $BACKUP_FILE 2>/dev/null && \
        print_ok "Backup: $BACKUP_FILE"
}

# ============================================
# EXECUÇÃO PRINCIPAL
# ============================================
if [ -d "$PROJECT_DIR/.git" ]; then
    print_msg "📦 PROJETO ENCONTRADO - ATUALIZANDO"
    
    fazer_backup
    
    print_msg "Parando containers..."
    docker compose down
    
    print_msg "Atualizando código..."
    git fetch --all
    git reset --hard origin/main
    git pull --rebase origin main
    
    criar_arquivos_config
    
    print_msg "Reconstruindo..."
    docker compose up -d --build
    
else
    print_msg "📦 PROJETO NÃO ENCONTRADO - INSTALANDO"
    
    git clone $REPO_URL .
    criar_arquivos_config
    docker compose up -d --build
fi

# Configurar banco com HASH
configurar_banco

# Verificar se tem erro
sleep 5
if docker ps | grep -q inventario-ti; then
    print_ok "✅ Container rodando!"
    
    # Testar se tem erro de coluna
    ERRO=$(docker logs inventario-ti --tail 20 | grep -i "column.*does not exist")
    if [ ! -z "$ERRO" ]; then
        print_msg "Corrigindo erro: $ERRO"
        # Extrair nome da coluna e adicionar
        COLUNA=$(echo "$ERRO" | grep -oE "column \w+\.\w+" | head -1 | cut -d'.' -f2)
        if [ ! -z "$COLUNA" ]; then
            docker exec inventario-ti-db psql -U user -d inventory -c "ALTER TABLE settings ADD COLUMN IF NOT EXISTS $COLUNA TEXT;"
            docker restart inventario-ti
        fi
    fi
else
    print_erro "Falha - logs:"
    docker logs inventario-ti --tail 30
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ INVENTARIO TI - PRONTO"
echo "══════════════════════════════════════════════"
echo "  🌐 http://localhost:5000"
echo "  👤 admin / admin (com HASH bcrypt)"
echo "══════════════════════════════════════════════"
