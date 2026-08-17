import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { BUSINESS_KNOWLEDGE } from './knowledge.js';

// Mapa para almacenar los chats en memoria por cada usuario (número de teléfono)
const userSessions = new Map();
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas de inactividad

// Lista de modelos optimizados y de alta cuota con respaldo automático
const AVAILABLE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

let genAI = null;
if (config.geminiApiKey && config.geminiApiKey !== 'tu_gemini_api_key_aqui') {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
}

/**
 * Obtiene o crea una sesión de chat para un usuario específico con un modelo dado
 */
function getOrCreateSession(userId, userName = 'Cliente', modelName = AVAILABLE_MODELS[0]) {
  const now = Date.now();
  const sessionKey = `${userId}_${modelName}`;
  
  if (userSessions.has(sessionKey)) {
    const session = userSessions.get(sessionKey);
    if (now - session.lastActivity < SESSION_TIMEOUT_MS) {
      session.lastActivity = now;
      return session.chat;
    }
  }

  const systemInstruction = `
Eres "Lonchy", el asistente virtual oficial de "${config.business.name}".
Tu misión es atender a los clientes en WhatsApp con amabilidad, rapidez y simpatía, brindando información exacta del menú, precios, horarios, formas de pago y ubicación.

${BUSINESS_KNOWLEDGE}

Nombre del cliente actual: ${userName || 'Cliente'}.
Responde de forma clara, natural y concisa (ideal para WhatsApp). Usa negritas en platillos y precios.

🛡️ ENFOQUE Y REGLAS:
1. Tu enfoque es 100% Comelonches. Si te preguntan cosas completamente ajenas o bromas absurdas, responde con humor simpático y breve, y redirige a los lonches y al menú en www.comelonches.com.
2. Si te piden chistes o saludos, responde amablemente y con buena vibra.
3. Recuerda siempre que NO hay servicio a domicilio, pero pueden ordenar en línea para recoger en sucursal en www.comelonches.com.
`;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 600,
    },
  });

  const chat = model.startChat({
    history: [],
  });

  userSessions.set(sessionKey, {
    chat,
    lastActivity: now,
  });

  return chat;
}

/**
 * Genera una respuesta con IA para un mensaje entrante con reintentos automáticos
 * @param {string} userId - Identificador único de WhatsApp del remitente
 * @param {string} userMessage - Texto del mensaje enviado por el cliente
 * @param {string} userName - Nombre de perfil de WhatsApp del cliente
 * @returns {Promise<string>} - Respuesta generada por la IA
 */
export async function getAiResponse(userId, userMessage, userName = 'Cliente') {
  if (!config.geminiApiKey || config.geminiApiKey === 'tu_gemini_api_key_aqui' || !genAI) {
    console.warn('⚠️ [Gemini AI] GEMINI_API_KEY no está configurada en .env.');
    return (
      `¡Hola ${userName}! 🥖 Gracias por comunicarte con *${config.business.name}*.\n\n` +
      `📌 Consulta nuestro menú y haz tu pedido aquí: ${config.business.website}\n` +
      `⏰ Horario: ${config.business.hours}\n` +
      `📍 Ubicación: ${config.business.address}`
    );
  }

  // Intentar con la lista de modelos disponibles en caso de saturación o límite de cuota
  for (const modelName of AVAILABLE_MODELS) {
    try {
      const chat = getOrCreateSession(userId, userName, modelName);
      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      const text = response.text();

      if (text && text.trim()) {
        return text.trim();
      }
    } catch (error) {
      console.warn(`⚠️ [Gemini AI] Error con modelo ${modelName}:`, error.message);
      // Limpiar sesión fallida
      userSessions.delete(`${userId}_${modelName}`);
      // Continuar al siguiente modelo del array
    }
  }

  // Si todos los modelos de chat fallan, intentar llamada directa simple
  try {
    const fallbackModel = genAI.getGenerativeModel({ model: AVAILABLE_MODELS[0] });
    const prompt = `Actúa como Lonchy de Comelonches. El cliente ${userName} dice: "${userMessage}". Responde brevemente con datos de Comelonches (horario: Martes a Domingo 12-6pm, ubicación: Blvd. de la Senda 381 local 14, menú en www.comelonches.com, sin servicio a domicilio):`;
    const simpleResult = await fallbackModel.generateContent(prompt);
    return simpleResult.response.text().trim();
  } catch (finalError) {
    console.error('❌ Error crítico en todos los modelos de Gemini:', finalError.message);
    return (
      `¡Hola ${userName}! 🥖 Gracias por comunicarte con *${config.business.name}*.\n\n` +
      `Estamos a tu servicio de Martes a Domingo de 12:00 PM a 6:00 PM.\n` +
      `📍 Blvd. de la Senda 381 Local 14, Residencial Senderos (Frente a restaurante San Miguel).\n` +
      `👉 Puedes consultar nuestro menú completo y hacer tu pedido para recoger en: www.comelonches.com\n\n` +
      `En unos momentos un miembro del equipo te atenderá con gusto.`
    );
  }
}

/**
 * Función para recargar la API Key dinámicamente si se actualiza .env
 */
export function reloadApiKey(newKey) {
  if (newKey && newKey !== 'tu_gemini_api_key_aqui') {
    config.geminiApiKey = newKey;
    genAI = new GoogleGenerativeAI(newKey);
    userSessions.clear();
    console.log('✅ [Gemini AI] API Key de Gemini actualizada correctamente.');
    return true;
  }
  return false;
}
