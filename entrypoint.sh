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
until nc -z "$DB_HOST" "$DB_PORT"; do
  echo "  Banco ainda indisponivel, aguardando 2s..."
  sleep 2
done
echo "Banco de dados disponivel!"

echo "Executando migrações do banco de dados..."
npx drizzle-kit push --force 2>&1 || {
  echo "AVISO: drizzle-kit push falhou, tentando continuar..."
}
echo "Migrações concluídas!"

echo "Iniciando aplicação na porta $PORT..."
exec node dist/index.cjs
