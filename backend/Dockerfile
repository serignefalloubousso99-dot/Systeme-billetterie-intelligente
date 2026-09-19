# Image du Service Utilisateurs (API Express + MongoDB)
FROM node:22-alpine

WORKDIR /app

# 1. On copie d'abord uniquement les fichiers de dependances :
#    tant qu'ils ne changent pas, Docker reutilise cette couche (build plus rapide).
# Optionnel : certificat racine (base64) d'un antivirus/proxy qui inspecte le HTTPS.
# Vide par defaut. La verification TLS reste TOUJOURS active.
ARG EXTRA_CA_B64=""
RUN if [ -n "$EXTRA_CA_B64" ]; then echo "$EXTRA_CA_B64" | base64 -d > /usr/local/share/extra-ca.pem; fi

COPY package*.json ./
RUN if [ -f /usr/local/share/extra-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem; fi \
    && npm ci --omit=dev

# 2. Puis le code source
COPY . .

# Dossiers ecrits par l'application (photos de profil), droits pour l'utilisateur non-root
RUN mkdir -p uploads/photos && chown -R node:node /app
USER node

EXPOSE 5050
CMD ["npm", "start"]
