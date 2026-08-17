import express from 'express';
import { botState, addBotLog } from './bot.js';
import { config } from './config.js';
import { getAiResponse, reloadApiKey } from './gemini.js';

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Endpoint de estado JSON
  app.get('/api/status', (req, res) => {
    res.json({
      status: botState.status,
      hasQr: !!botState.qrDataUrl,
      qrDataUrl: botState.qrDataUrl,
      user: botState.user,
      messagesCount: botState.messagesCount,
      lastActivity: botState.lastActivity,
      logs: botState.logs,
      geminiConfigured: !!(config.geminiApiKey && config.geminiApiKey !== 'tu_gemini_api_key_aqui'),
    });
  });

  // Endpoint para guardar o actualizar la API Key de Gemini
  app.post('/api/config/gemini', (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'La API Key no puede estar vacía' });
    }
    const success = reloadApiKey(apiKey.trim());
    if (success) {
      addBotLog('🔑 API Key de Gemini actualizada desde el panel web.');
      return res.json({ success: true, message: 'API Key actualizada exitosamente' });
    }
    res.status(400).json({ error: 'Clave inválida' });
  });

  // Endpoint para probar el cerebro de la IA directamente desde la web
  app.post('/api/test-ai', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    try {
      const response = await getAiResponse('test_web_user', message, 'Usuario de Prueba');
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Página web principal (Panel de control del Bot)
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel de WhatsApp Bot - Comelonches</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --primary: #f26419;
      --primary-hover: #dd5610;
      --success: #10b981;
      --warning: #f59e0b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      padding: 24px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .header h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .header h1 span {
      color: var(--primary);
    }
    .header p {
      color: var(--text-muted);
      margin-top: 6px;
      font-size: 1rem;
    }
    .container {
      width: 100%;
      max-width: 1000px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    @media (max-width: 768px) {
      .container {
        grid-template-columns: 1fr;
      }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 16px;
    }
    .status-badge.connected {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-badge.waiting {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .status-badge.disconnected {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      background: #0b1120;
      border-radius: 12px;
      padding: 20px;
      border: 2px dashed var(--card-border);
    }
    .qr-container img {
      max-width: 250px;
      width: 100%;
      border-radius: 10px;
      background: white;
      padding: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    .instructions {
      margin-top: 14px;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .instructions ol {
      margin-left: 20px;
      margin-top: 6px;
    }
    .input-group {
      margin-bottom: 16px;
    }
    .input-group label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .input-group input, .input-group textarea {
      width: 100%;
      padding: 10px 14px;
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: #fff;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .input-group input:focus, .input-group textarea:focus {
      outline: none;
      border-color: var(--primary);
    }
    .btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.95rem;
      transition: background 0.2s;
    }
    .btn:hover {
      background: var(--primary-hover);
    }
    .log-box {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 0.8rem;
      color: #cbd5e1;
      height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .test-box {
      margin-top: 16px;
      padding: 14px;
      background: #0b1120;
      border-radius: 8px;
      border: 1px solid var(--card-border);
    }
    .ai-reply {
      margin-top: 10px;
      padding: 10px 12px;
      background: #1e293b;
      border-left: 3px solid var(--primary);
      border-radius: 4px;
      font-size: 0.9rem;
      color: #e2e8f0;
      white-space: pre-line;
      display: none;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>🥖 <span>Comelonches</span> WhatsApp AI Bot</h1>
    <p>Atención al cliente y toma de pedidos inteligente con Google Gemini</p>
  </div>

  <div class="container">
    <!-- Columna Izquierda: Estado de Conexión y QR -->
    <div class="card">
      <div class="card-title">📱 Vinculación de WhatsApp</div>
      
      <div id="statusBadge" class="status-badge waiting">
        <span>●</span> <span id="statusText">Cargando estado...</span>
      </div>

      <div class="qr-container" id="qrWrapper">
        <div id="qrContent" style="text-align: center;">
          <p style="color: var(--text-muted);">Esperando código QR...</p>
        </div>
      </div>

      <div class="instructions">
        <strong>¿Cómo vincular tu WhatsApp?</strong>
        <ol>
          <li>Abre WhatsApp en tu teléfono celular.</li>
          <li>Toca los tres puntos ⋮ (Android) o Configuración ⚙️ (iPhone).</li>
          <li>Selecciona <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
          <li>Apunta la cámara de tu celular al código QR de arriba.</li>
        </ol>
      </div>
    </div>

    <!-- Columna Derecha: Configuración y Logs -->
    <div class="card">
      <div class="card-title">⚙️ Configuración de Google Gemini</div>
      
      <div class="input-group">
        <label for="geminiKey">API Key de Google Gemini (Gratis en AI Studio)</label>
        <input type="password" id="geminiKey" placeholder="Pega tu clave AIzaSy..." />
      </div>
      <button class="btn" onclick="saveGeminiKey()">Guardar Clave</button>
      <span id="keyStatus" style="font-size: 0.85rem; margin-left: 10px; color: var(--success);"></span>

      <div class="test-box">
        <div class="card-title" style="font-size: 1rem; margin-bottom: 8px;">🧪 Probar Respuesta de la IA</div>
        <div class="input-group" style="margin-bottom: 8px;">
          <input type="text" id="testQuestion" placeholder="Ej: ¿Qué lonches tienen y cuánto cuesta el de pierna?" onkeypress="if(event.key==='Enter') testAi()" />
        </div>
        <button class="btn" style="background:#3b82f6;" onclick="testAi()">Enviar Pregunta</button>
        <div id="aiReplyBox" class="ai-reply"></div>
      </div>

      <div style="margin-top: 20px;">
        <div class="card-title" style="font-size: 1rem; margin-bottom: 8px;">📜 Registro de Actividad</div>
        <div id="logBox" class="log-box">Iniciando logs...</div>
      </div>
    </div>
  </div>

  <script>
    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const badge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const qrContent = document.getElementById('qrContent');
        const logBox = document.getElementById('logBox');

        // Actualizar logs
        if (data.logs && data.logs.length > 0) {
          logBox.textContent = data.logs.join('\\n');
        }

        // Actualizar Estado
        if (data.status === 'connected') {
          badge.className = 'status-badge connected';
          statusText.textContent = 'CONECTADO (' + (data.user?.name || data.user?.id?.split(':')[0] || 'Activo') + ')';
          qrContent.innerHTML = '<div style="color: #10b981; font-size: 3rem; margin-bottom: 10px;">✅</div><h3 style="color:#10b981;">¡WhatsApp Vinculado!</h3><p style="color: var(--text-muted); margin-top:6px;">El bot está respondiendo mensajes de clientes en tiempo real.</p><p style="margin-top: 10px; font-size: 0.9rem;">Mensajes atendidos: <strong>' + data.messagesCount + '</strong></p>';
        } else if (data.status === 'waiting_qr' && data.qrDataUrl) {
          badge.className = 'status-badge waiting';
          statusText.textContent = 'ESPERANDO ESCANEO DE QR';
          qrContent.innerHTML = '<img src="' + data.qrDataUrl + '" alt="QR Code WhatsApp" /><p style="color: var(--text-muted); margin-top: 8px; font-size: 0.85rem;">El código se actualiza automáticamente</p>';
        } else {
          badge.className = 'status-badge disconnected';
          statusText.textContent = 'DESCONECTADO / INICIANDO';
          qrContent.innerHTML = '<p style="color: var(--text-muted);">Iniciando cliente de WhatsApp...</p>';
        }
      } catch (err) {
        console.error('Error al actualizar estado:', err);
      }
    }

    async function saveGeminiKey() {
      const key = document.getElementById('geminiKey').value;
      const statusSpan = document.getElementById('keyStatus');
      if (!key) return alert('Por favor escribe tu API Key');

      try {
        const res = await fetch('/api/config/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key })
        });
        const data = await res.json();
        if (data.success) {
          statusSpan.textContent = '✅ Guardada correctamente';
          setTimeout(() => { statusSpan.textContent = ''; }, 4000);
        } else {
          alert(data.error || 'Error al guardar');
        }
      } catch (e) {
        alert('Error conectando al servidor');
      }
    }

    async function testAi() {
      const question = document.getElementById('testQuestion').value;
      const replyBox = document.getElementById('aiReplyBox');
      if (!question) return;

      replyBox.style.display = 'block';
      replyBox.textContent = 'Pensando respuesta con Gemini...';

      try {
        const res = await fetch('/api/test-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question })
        });
        const data = await res.json();
        replyBox.textContent = data.response || 'Sin respuesta';
      } catch (e) {
        replyBox.textContent = 'Error consultando la IA: ' + e.message;
      }
    }

    // Polling cada 2.5 segundos para refrescar estado y QR
    setInterval(updateStatus, 2500);
    updateStatus();
  </script>
</body>
</html>`);
  });

  return app;
}
