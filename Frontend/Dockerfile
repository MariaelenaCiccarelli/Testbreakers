# Compilazione dell'applicazione Angular
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Esegue il build di produzione di Angular
RUN npm run build --configuration=production

# Servire l'applicazione con Nginx
FROM nginx:alpine

# Copiamo i file compilati di Angular nella cartella pubblica di Nginx
COPY --from=build /app/dist/*/browser /usr/share/nginx/html

# Copiamo una configurazione base per gestire il routing di Angular (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]