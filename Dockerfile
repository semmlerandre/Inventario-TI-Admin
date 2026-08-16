# ---------- BUILD STAGE ----------
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

ENV NODE_ENV=development

RUN npm install --production=false

RUN npm rebuild

COPY . .

RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-openbsd \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
