import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { BUSINESS_KNOWLEDGE } from './knowledge.js';

// Mapa para almacenar los chats en memoria por cada usuario (número de teléfono)
const userSessions = new Map();
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas de inactividad

let genAI = null;
if (config.geminiApiKey && config.geminiApiKey !== 'tu_gemini_api_key_aqui') {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
}

/**
 * Obtiene o crea una sesión de chat para un usuario específico
 */
function getOrCreateSession(userId, userName = 'Cliente') {
  const now = Date.now();
  
  if (userSessions.has(userId)) {
    const session = userSessions.get(userId);
    // Si la sesión no ha expirado, actualizamos última actividad
    if (now - session.lastActivity < SESSION_TIMEOUT_MS) {
      session.lastActivity = now;
      return session.chat;
    }
  }

  // Inicializar nuevo modelo y chat con la instrucción de sistema
  const systemInstruction = `
Eres "Lonchy", el asistente virtual inteligente de "${config.business.name}".
Tu misión es atender a los clientes en WhatsApp con amabilidad, rapidez y profesionalismo, ayudándoles a conocer el menú, resolver dudas, tomar sus pedidos y brindar información de envíos y horarios.

${BUSINESS_KNOWLEDGE}

Nombre del cliente actual: ${userName || 'Cliente'}.
Responde de manera concisa pero cálida, lista para WhatsApp. No uses títulos gigantes con Markdown excesivo. Usa negritas para destacar platillos o precios.
`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemInstruction,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  });

  const chat = model.startChat({
    history: [],
  });

  userSessions.set(userId, {
    chat,
    lastActivity: now,
  });

  return chat;
}

/**
 * Genera una respuesta con IA para un mensaje entrante
 * @param {string} userId - Identificador único de WhatsApp del remitente
 * @param {string} userMessage - Texto del mensaje enviado por el cliente
 * @param {string} userName - Nombre de perfil de WhatsApp del cliente
 * @returns {Promise<string>} - Respuesta generada por la IA
 */
export async function getAiResponse(userId, userMessage, userName = 'Cliente') {
  // Si no hay API Key configurada
  if (!config.geminiApiKey || config.geminiApiKey === 'tu_gemini_api_key_aqui' || !genAI) {
    console.warn('⚠️ [Gemini AI] GEMINI_API_KEY no está configurada en .env.');
    return (
      `¡Hola ${userName}! 🥖 Gracias por comunicarte con *${config.business.name}*.\n\n` +
      `¡Bienvenido! Estamos preparando deliciosos lonches para ti.\n` +
      `📌 Consulta nuestro menú digital aquí: ${config.business.website}\n` +
      `⏰ Horario: ${config.business.hours}\n\n` +
      `_(Nota: Configura tu GEMINI_API_KEY en el archivo .env para habilitar respuestas completas con IA)_`
    );
  }

  try {
    const chat = getOrCreateSession(userId, userName);
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const text = response.text();

    return text.trim();
  } catch (error) {
    console.error(`❌ Error en Gemini AI al procesar mensaje de ${userId}:`, error.message);
    
    // Si falla el chat existente (por tokens o límite), reseteamos la sesión y reintentamos una vez
    try {
      userSessions.delete(userId);
      const newChat = getOrCreateSession(userId, userName);
      const retryResult = await newChat.sendMessage(userMessage);
      const retryResponse = await retryResult.response;
      return retryResponse.text().trim();
    } catch (retryError) {
      console.error('❌ Error en reintento de Gemini:', retryError.message);
      return (
        `¡Hola ${userName}! 🥖 Disculpa, tuvimos un pequeño problema técnico procesando tu mensaje.\n\n` +
        `Puedes consultar nuestro menú directamente en: ${config.business.website}\n` +
        `En unos momentos un miembro de nuestro equipo te atenderá personalmente.`
      );
    }
  }
}

/**
 * Función para recargar la API Key dinámicamente si se actualiza .env
 */
export function reloadApiKey(newKey) {
  if (newKey && newKey !== 'tu_gemini_api_key_aqui') {
    config.geminiApiKey = newKey;
    genAI = new GoogleGenerativeAI(newKey);
    userSessions.clear(); // Limpiar sesiones para reiniciar con nueva key
    console.log('✅ [Gemini AI] API Key de Gemini actualizada correctamente.');
    return true;
  }
  return false;
}
