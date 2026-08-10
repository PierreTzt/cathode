# syntax=docker/dockerfile:1

# Sous-chemin de publication. Vide par défaut : l'appli est servie à la racine.
# Derrière un reverse proxy qui la publie sous un sous-chemin, passer par exemple
# --build-arg BASE_PATH=/cathode (voir docker-compose.yml). Le basePath est baké
# dans les assets au build : le fournir au runtime seul ne suffit pas.
ARG BASE_PATH=""

# ---- Étape build ----
FROM node:24-slim AS builder
ARG BASE_PATH
WORKDIR /app
ENV BASE_PATH=$BASE_PATH
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Étape runtime ----
FROM node:24-slim AS runner
ARG BASE_PATH
WORKDIR /app
ENV NODE_ENV=production
ENV BASE_PATH=$BASE_PATH
ENV PORT=3000
# node:sqlite est un module intégré (Node 24) ; aucune dépendance native à compiler.
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
