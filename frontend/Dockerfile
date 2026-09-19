# Image du frontend React : construction (Vite) puis service par Nginx.
# Deux etapes : l'image finale ne contient que les fichiers compiles, pas Node.js.

# ---- Etape 1 : compilation ----
FROM node:22-alpine AS build
WORKDIR /app

# Optionnel : certificat racine (base64) d'un antivirus/proxy qui inspecte le HTTPS.
# Vide par defaut. La verification TLS reste TOUJOURS active.
ARG EXTRA_CA_B64=""
RUN if [ -n "$EXTRA_CA_B64" ]; then echo "$EXTRA_CA_B64" | base64 -d > /usr/local/share/extra-ca.pem; fi

COPY package*.json ./
RUN if [ -f /usr/local/share/extra-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem; fi \
    && npm ci

COPY . .

# URL des APIs, figees au moment du build (Vite les integre dans le JavaScript).
# Vides = le frontend deduit l'hote depuis l'adresse de la page (usage local).
ARG VITE_API_URL=
ARG VITE_ABONNEMENTS_API_URL=
ARG VITE_BILLETTERIE_API_URL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_ABONNEMENTS_API_URL=$VITE_ABONNEMENTS_API_URL \
    VITE_BILLETTERIE_API_URL=$VITE_BILLETTERIE_API_URL

RUN npm run build

# ---- Etape 2 : serveur web ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
