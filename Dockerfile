# Stage 1: Build Frontend Vite
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Nginx Runtime
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Copiar bundle de producción generado por Vite
COPY --from=build /app/dist .

# Copiar configuración Nginx para SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar script de inyección de variables de entorno de CapRover
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
