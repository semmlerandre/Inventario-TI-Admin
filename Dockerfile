FROM node:20-slim

# Diretório da aplicação
WORKDIR /app

# Copiar apenas package primeiro (melhora cache)
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar restante do projeto
COPY . .

# Build da aplicação
RUN npm run build

# Definir variável de ambiente da porta
ENV PORT=7000

# Expor porta 7000
EXPOSE 7000

# Iniciar aplicação
CMD ["npm", "start"]
