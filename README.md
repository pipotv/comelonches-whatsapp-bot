# 🥖 Bot de WhatsApp con IA (Google Gemini) - Comelonches

Este proyecto permite automatizar la atención a clientes en WhatsApp mediante un asistente con **Inteligencia Artificial (Google Gemini)**. Tus clientes recibirán respuestas inmediatas a cualquier hora sobre el menú, precios, horarios, servicio a domicilio y toma de pedidos.

---

## 🚀 Pasos Rápidos para Usarlo

### 1. Obtener tu API Key de Google Gemini (Gratis)
1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Inicia sesión con tu cuenta de Google.
3. Haz clic en **"Create API key"** y copia la clave.
4. Pega tu clave en el archivo `.env` en `GEMINI_API_KEY=tu_clave_aqui` (o puedes ingresarla directamente en la pantalla web del bot).

### 2. Instalar dependencias
Abre tu terminal en esta carpeta (`whattsap`) y ejecuta:
```bash
npm install
```

### 3. Iniciar el Bot
Ejecuta:
```bash
npm start
```

### 4. Vincular con tu WhatsApp (Solo 1 vez)
1. Al iniciar, se abrirá el servidor web en: [http://localhost:3000](http://localhost:3000).
2. También verás el código QR en la consola / terminal.
3. Abre **WhatsApp** en tu teléfono celular:
   - Ve a **Ajustes** (o los 3 puntos ⋮ en Android / Configuración ⚙️ en iPhone).
   - Toca en **Dispositivos vinculados**.
   - Toca en **Vincular un dispositivo**.
   - Escanea el código QR que aparece en pantalla.
4. **¡Listo!** El bot quedará conectado.

---

## 🍽️ ¿Cómo personalizar el Menú y los Datos del Negocio?

- Puedes editar los precios, platillos y promociones en el archivo:
  [`src/knowledge.js`](file:///d:/workspace/QR%20LANDING%20COMELONCHES/whattsap/src/knowledge.js)
- Puedes cambiar el nombre del negocio, sitio web y horarios en el archivo:
  [`.env`](file:///d:/workspace/QR%20LANDING%20COMELONCHES/whattsap/.env)

---

## 🔒 Privacidad y Seguridad
- Las credenciales de sesión se guardan de forma local en la carpeta `auth_info_baileys/`.
- No necesitas compartir contraseñas ni dejar tu WhatsApp desatendido: tú siempre puedes ver y contestar los mensajes desde tu propio celular cuando quieras.
