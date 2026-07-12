# syntax=docker/dockerfile:1

# ---- Étape build ----
FROM node:24-slim AS builder
WORKDIR /app
# basePath baké dans le build (assets + liens sous /monsuivi)
ENV BASE_PATH=/monsuivi
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Étape runtime ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV BASE_PATH=/monsuivi
ENV PORT=3000
# node:sqlite est un module intégré (Node 24) ; aucune dépendance native à compiler.
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
