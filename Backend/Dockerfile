FROM node:24-alpine

WORKDIR /usr/src/app

# Copiamo i file di gestione delle dipendenze
COPY package*.json ./

# Installiamo solo le dipendenze di produzione (evitando nodemon in container)
RUN npm ci --only=production

# Copiamo tutto il resto del codice del backend
COPY . .

EXPOSE 3000

# Avviamo il server in modalità produzione stagna
CMD ["npm", "start"]