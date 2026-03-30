#!/bin/sh
set -e

echo "========================================"
echo "  Inventario TI - Inicializando..."
echo "========================================"

# Extrai host e porta do DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_PORT=${DB_PORT:-5432}

echo "Aguardando banco de dados em $DB_HOST:$DB_PORT..."

# Aguarda banco REALMENTE pronto
until pg_isready -h "$DB_HOST" -p "$DB_PORT"; do
  echo "  Banco ainda não está pronto..."
  sleep 2
done

echo "Banco pronto!"

# Evita race condition
sleep 5

echo "Rodando migrations..."

# Retry automático (blindagem)
for i in 1 2 3 4 5; do
  node dist/migrate.cjs && break || {
    echo "Tentativa $i falhou, tentando novamente..."
    sleep 5
  }
done

echo "Migrations finalizadas!"

echo "Iniciando aplicação..."
exec node dist/index.cjs
