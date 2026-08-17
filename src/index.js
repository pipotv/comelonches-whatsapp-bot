import { createServer, startSelfPing } from './server.js';
import { startWhatsAppBot } from './bot.js';
import { config } from './config.js';

async function main() {
  console.log('========================================================');
  console.log('🥖 INICIANDO BOT DE WHATSAPP CON IA - COMELONCHES 🥖');
  console.log('========================================================');

  // 1. Iniciar el servidor web para ver el QR
  const app = createServer();
  const server = app.listen(config.port, () => {
    console.log(`🌐 Panel de control web disponible en: http://localhost:${config.port}`);
    console.log(`   (Abre ese enlace en tu navegador para ver el código QR con facilidad)`);
    
    // Iniciar auto-ping en la nube para mantener activo el servidor 24/7
    startSelfPing();
  });

  // 2. Iniciar el cliente de WhatsApp
  startWhatsAppBot();
}

main().catch((err) => {
  console.error('Error fatal al iniciar la aplicación:', err);
});
