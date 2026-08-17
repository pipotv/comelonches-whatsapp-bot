import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAiResponse } from './gemini.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FOLDER = path.resolve(__dirname, '../auth_info_baileys');

// Estado global de la conexión del bot
export const botState = {
  status: 'disconnected', // 'disconnected' | 'waiting_qr' | 'connected'
  qrString: null,
  qrDataUrl: null,
  user: null,
  lastActivity: null,
  messagesCount: 0,
  logs: [],
};

export function addBotLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);
  botState.logs.unshift(logEntry);
  if (botState.logs.length > 50) botState.logs.pop();
}

let sock = null;

/**
 * Inicia o reinicia la conexión con WhatsApp Web
 */
export async function startWhatsAppBot() {
  try {
    addBotLog('🔄 Inicializando cliente de WhatsApp...');
    botState.status = 'disconnected';

    // Cargar credenciales guardadas
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    addBotLog(`📦 Usando Baileys v${version.join('.')} (Última versión: ${isLatest})`);

    // Crear socket de conexión con logger silencioso para mantener la consola limpia
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false, // Lo manejamos nosotros para mayor control
      auth: state,
      browser: ['Comelonches Bot', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    // Guardar credenciales automáticamente en cada actualización
    sock.ev.on('creds.update', saveCreds);

    // Manejador de eventos de conexión y código QR
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        botState.status = 'waiting_qr';
        botState.qrString = qr;
        
        try {
          botState.qrDataUrl = await QRCode.toDataURL(qr);
        } catch (err) {
          console.error('Error generando QR data URL:', err);
        }

        console.log('\n======================================================');
        console.log('📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:');
        console.log('   (WhatsApp > Ajustes/Tres Puntos > Dispositivos Vinculados > Vincular)');
        console.log(`   O abre en tu navegador: http://localhost:${config.port}`);
        console.log('======================================================\n');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        botState.status = 'disconnected';
        botState.qrString = null;
        botState.qrDataUrl = null;
        botState.user = null;

        addBotLog(`⚠️ Conexión cerrada. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => startWhatsAppBot(), 3000);
        } else {
          addBotLog('❌ Sesión cerrada permanentemente. Por favor reinicia para generar un nuevo QR.');
        }
      } else if (connection === 'open') {
        botState.status = 'connected';
        botState.qrString = null;
        botState.qrDataUrl = null;
        botState.user = sock.user;

        addBotLog(`✅ ¡Bot de WhatsApp CONECTADO exitosamente!`);
        addBotLog(`📱 Conectado como: ${sock.user?.name || 'Comelonches'} (${sock.user?.id?.split(':')[0]})`);
        addBotLog(`🚀 Listo para responder mensajes de clientes automáticamente.`);
      }
    });

    // Manejador de mensajes entrantes
    sock.ev.on('messages.upsert', async (m) => {
      // Solo nos interesan mensajes nuevos en tiempo real ('notify')
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        // Ignorar mensajes enviados por el propio bot para evitar bucles
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;

        // Ignorar actualizaciones de estados o broadcasts
        if (!jid || jid === 'status@broadcast') continue;

        // Si es un grupo, opcionalmente ignorar para solo responder chats individuales
        if (jid.endsWith('@g.us')) {
          // Ignorar mensajes de grupo por defecto para no saturar grupos
          continue;
        }

        // Extraer texto del mensaje
        const messageContent =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption;

        if (!messageContent || typeof messageContent !== 'string') {
          continue;
        }

        const cleanText = messageContent.trim();
        if (!cleanText) continue;

        const senderName = msg.pushName || 'Cliente';
        const senderPhone = jid.split('@')[0];

        addBotLog(`📩 Mensaje recibido de ${senderName} (${senderPhone}): "${cleanText}"`);
        botState.messagesCount++;
        botState.lastActivity = new Date().toLocaleTimeString();

        try {
          // 1. Indicar que el bot está escribiendo
          await sock.sendPresenceUpdate('composing', jid);

          // 2. Pequeño retardo natural para simular escritura humana
          if (config.bot.typingDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, config.bot.typingDelayMs));
          }

          // 3. Obtener respuesta inteligente desde Gemini AI
          const replyText = await getAiResponse(jid, cleanText, senderName);

          // 4. Detener indicador de escribiendo
          await sock.sendPresenceUpdate('paused', jid);

          // 5. Enviar mensaje de respuesta al cliente
          await sock.sendMessage(jid, { text: replyText });
          addBotLog(`🤖 Respuesta enviada a ${senderName}: "${replyText.substring(0, 60)}..."`);
        } catch (error) {
          console.error(`❌ Error enviando respuesta a ${jid}:`, error);
        }
      }
    });
  } catch (error) {
    console.error('❌ Error al iniciar el bot de WhatsApp:', error);
    setTimeout(() => startWhatsAppBot(), 5000);
  }
}
