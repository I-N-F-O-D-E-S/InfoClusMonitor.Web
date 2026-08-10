#!/bin/sh
set -e

# Inyectar variables de entorno de CapRover en tiempo de ejecución
echo "Generando /usr/share/nginx/html/env-config.js con variables de entorno de CapRover..."

cat <<EOF > /usr/share/nginx/html/env-config.js
window._env_ = {
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_SIGNALR_URL: "${VITE_SIGNALR_URL:-}"
};
EOF

echo "Archivo env-config.js configurado:"
cat /usr/share/nginx/html/env-config.js

# Ejecutar el comando del contenedor (nginx)
exec "$@"
