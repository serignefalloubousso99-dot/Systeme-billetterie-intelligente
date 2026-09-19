# Image du Service Billetterie (API Express + PostgreSQL)
FROM node:22-alpine

WORKDIR /app

# Optionnel : certificat racine (base64) d'un antivirus/proxy qui inspecte le HTTPS.
# Vide par defaut. La verification TLS reste TOUJOURS active.
ARG EXTRA_CA_B64=""
RUN if [ -n "$EXTRA_CA_B64" ]; then echo "$EXTRA_CA_B64" | base64 -d > /usr/local/share/extra-ca.pem; fi

COPY package*.json ./
RUN if [ -f /usr/local/share/extra-ca.pem ]; then export NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem; fi \
    && npm ci --omit=dev

COPY . .

# Le logger ecrit dans /app/logs (error.log, combined.log)
RUN mkdir -p logs && chown -R node:node /app
USER node

EXPOSE 5070
CMD ["npm", "start"]
