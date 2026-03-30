# ---------- BUILD STAGE ----------
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:20-slim

WORKDIR /app

# 🔥 Instala dependências necessárias (pg_isready + nc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-openbsd \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia build
COPY --from=builder /app/dist ./dist

# Cria pasta de uploads
RUN mkdir -p /app/uploads

# Copia entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
