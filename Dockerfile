# Utilizar Node.js versión 22 LTS liviana
FROM node:22-slim

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias para producción
RUN npm install --omit=dev

# Copiar el resto del código del bot
COPY . .

# Exponer el puerto configurado
EXPOSE 3000

# Comando para arrancar el bot en la nube
CMD ["npm", "start"]
