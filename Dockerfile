FROM node:20-alpine
WORKDIR /app

# Instalar dependencias del proyecto
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar proyecto Vite
RUN npm run build

EXPOSE 80

# Inyectar variables de entorno de CapRover en tiempo de ejecución y arrancar con npm
CMD ["sh", "-c", "echo \"window._env_ = { VITE_API_URL: '${VITE_API_URL}', VITE_SIGNALR_URL: '${VITE_SIGNALR_URL}' };\" > dist/env-config.js && npm run start"]
