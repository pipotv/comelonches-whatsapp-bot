import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from './config.js';
import { BUSINESS_KNOWLEDGE } from './knowledge.js';

// Historiales de chat en memoria por usuario
const chatHistories = new Map();
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas

let genAI = null;
let openaiClient = null;

function getOpenAIClient() {
  const keys = [
    config.openaiApiKey,
    process.env.OPENAI_API_KEY,
    config.geminiApiKey,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
  ];
  const validKey = keys.find(k => k && typeof k === 'string' && k.startsWith('sk-'));
  if (validKey) {
    if (!openaiClient) {
      openaiClient = new OpenAI({ apiKey: validKey });
    }
    return openaiClient;
  }
  return null;
}

function getGoogleGenAI() {
  const keys = [
    config.geminiApiKey,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
  ];
  const validKey = keys.find(k => k && typeof k === 'string' && !k.startsWith('sk-') && k !== 'tu_gemini_api_key_aqui');
  if (validKey) {
    if (!genAI) {
      genAI = new GoogleGenerativeAI(validKey);
    }
    return genAI;
  }
  return null;
}

/**
 * Obtiene el historial de mensajes formateado para un usuario
 */
function getUserHistory(userId) {
  const now = Date.now();
  if (chatHistories.has(userId)) {
    const session = chatHistories.get(userId);
    if (now - session.lastActivity < SESSION_TIMEOUT_MS) {
      session.lastActivity = now;
      return session.messages;
    }
  }
  const newMessages = [];
  chatHistories.set(userId, { messages: newMessages, lastActivity: now });
  return newMessages;
}

/**
 * Crea el prompt de sistema oficial y limpio de Comelonches
 */
function getSystemPrompt(userName = 'Cliente') {
  return `
Eres "Lonchy", el asistente virtual oficial de "${config.business.name}".
Tu misión es atender a los clientes en WhatsApp de forma cálida, amable, clara y muy servicial, guiándolos siempre con amabilidad a pedir por nuestra página web oficial.

${BUSINESS_KNOWLEDGE}

Nombre del cliente: ${userName || 'Cliente'}.

PAUTAS DE ATENCIÓN Y PERSUASIÓN SUTIL:
1. **Saludo Inicial:** Cuando el cliente salude ("Hola", "Buenas tardes", etc.), responde con calidez y simpatía, preséntate como Lonchy de Comelonches, ofrécele consultar el menú y ordenar en línea.
2. **Persuasión Sutil hacia la Web (www.comelonches.com):**
   - Cuando pregunten por pedidos, menú, precios o quieran ordenar, resalta con amabilidad que **la forma más rápida de pedir es en la web**, porque su orden **entra directo al sistema de cocina** y se prepara al instante mientras van en camino.
   - Sutilmente aclara que por WhatsApp el equipo suele estar ocupado en la plancha y puede tardar en leer los mensajes, por lo que en la web su pedido queda asegurado y listo al llegar.
3. **Servicio a Domicilio:** Recuerda siempre con amabilidad que no contamos con servicio a domicilio, pero pueden ordenar en línea para recoger en sucursal sin esperas.
4. **Formato:** Mantén las respuestas bien estructuradas, con emojis agradables, precios en **negritas** y el enlace destacado 👉 *www.comelonches.com*.

ESTRUCTURA EXACTA DE MENSAJES (Sigue este tono y formato):

Ejemplo 1 (Saludo):
"¡Hola, ${userName}! 👋 Soy Lonchy, tu asistente virtual de Comelonches. ¡Es un gusto saludarte!

Estoy aquí para ayudarte con nuestro menú y resolver tus dudas. 😊

Para que tu pedido entre directo a nuestro sistema de cocina y lo tengamos listo calientito en cuanto llegues, te recomendamos ordenar en línea desde nuestra página:
👉 *www.comelonches.com*

¿En qué puedo ayudarte hoy?"

Ejemplo 2 (Pregunta de Horarios):
"¡Hola, ${userName}! Nuestro horario de atención es:

📅 *Martes a Domingo:* de 12:00 PM a 6:00 PM
🚫 *Lunes:* CERRADO

Puedes ver nuestro menú y hacer tu pedido en cualquier momento a través de nuestra web para que pase directo a cocina: 👉 *www.comelonches.com*

¡Te esperamos! 😊"

Ejemplo 3 (Pregunta de un Lonche o Precio):
"¡Hola, ${userName}! El lonche **Mejicana** lleva *Top Sirloin, Aguacate, Queso, Tocino y Frijol* y cuesta **$149 MXN**. 🥖😋

Te recomiendo ordenarlo directamente por nuestra página 👉 *www.comelonches.com* para que tu pedido entre de inmediato al sistema y esté listo calientito cuando pases por él.

¿Te gustaría ordenar uno?"

Ejemplo 4 (Cuando el cliente quiere hacer un pedido por chat):
"¡Con mucho gusto, ${userName}! 🥖✨ Para atenderte más rápido y que tu orden pase directo a cocina sin esperas (ya que por aquí a veces tardamos un poquito por estar en la plancha), haz tu pedido directo en:
👉 *www.comelonches.com*

¡Ahí seleccionas tus lonches favoritos y te los tenemos listos para recoger!"

Ejemplo 5 (Pregunta por Lonche Mixto):
"¡Hola, ${userName}! ¡Sí tenemos lonche **Mixto**! Es el clásico de *Carnitas con Aguacate* y cuesta **$109 MXN**. 🥖🥑

Puedes pedirlo directo en nuestra web para que empiece a prepararse al instante: 👉 *www.comelonches.com*

¿Se te antoja uno?"

Ejemplo 6 (Pregunta de Ubicación o Domicilio):
"¡Hola, ${userName}! Estamos ubicados en:
📍 *Blvd. de la Senda 381, Local 14, Residencial Senderos* (frente al restaurante San Miguel).

No contamos con servicio a domicilio, pero puedes hacer tu pedido en línea para que entre directo a cocina y pasar a recogerlo listo: 👉 *www.comelonches.com*

¡Te esperamos! 😊"
`;
}

/**
 * Respuesta usando OpenAI (ChatGPT gpt-4o-mini)
 */
async function getOpenAiResponse(userId, userMessage, userName = 'Cliente') {
  const openai = getOpenAIClient();
  if (!openai) return null;

  const history = getUserHistory(userId);
  history.push({ role: 'user', content: userMessage });
  
  // Limitar historial a los últimos 10 mensajes
  const recentHistory = history.slice(-10);

  const messages = [
    { role: 'system', content: getSystemPrompt(userName) },
    ...recentHistory,
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.7,
    max_tokens: 500,
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (reply) {
    history.push({ role: 'assistant', content: reply });
    return reply;
  }
  return null;
}

/**
 * Respuesta usando Google Gemini (Modelos gratuitos y rápidos)
 */
async function getGeminiResponse(userId, userMessage, userName = 'Cliente') {
  const googleAI = getGoogleGenAI();
  if (!googleAI) return null;

  const modelsToTry = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];

  for (const modelName of modelsToTry) {
    try {
      const model = googleAI.getGenerativeModel({
        model: modelName,
        systemInstruction: getSystemPrompt(userName),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
        },
      });

      const history = getUserHistory(userId);
      
      // Convertir historial a formato Gemini
      const geminiHistory = history.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(userMessage);
      const text = (await result.response).text().trim();

      if (text) {
        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: text });
        return text;
      }
    } catch (err) {
      console.warn(`[Gemini ${modelName}] Aviso:`, err.message);
      // Continuar al siguiente modelo
    }
  }

  return null;
}

/**
 * Función principal para generar respuesta de IA (admite OpenAI y Gemini con fallback)
 */
export async function getAiResponse(userId, userMessage, userName = 'Cliente') {
  const hasOpenAi = !!(config.openaiApiKey && config.openaiApiKey.startsWith('sk-'));
  const hasGemini = !!(config.geminiApiKey && config.geminiApiKey !== 'tu_gemini_api_key_aqui');

  // Si no hay ninguna clave configurada
  if (!hasOpenAi && !hasGemini) {
    return (
      `¡Hola ${userName}! 🥖 Gracias por comunicarte con *${config.business.name}*.\n\n` +
      `📌 Consulta nuestro menú y haz tu pedido aquí: ${config.business.website}\n` +
      `⏰ Horario: ${config.business.hours}\n` +
      `📍 Ubicación: ${config.business.address}`
    );
  }

  // 1. Si el usuario configuró OpenAI o modo auto con OpenAI
  if (hasOpenAi && (config.aiProvider === 'openai' || config.aiProvider === 'auto')) {
    try {
      const reply = await getOpenAiResponse(userId, userMessage, userName);
      if (reply) return reply;
    } catch (err) {
      console.error('Error con OpenAI:', err.message);
    }
  }

  // 2. Usar Google Gemini
  if (hasGemini) {
    try {
      const reply = await getGeminiResponse(userId, userMessage, userName);
      if (reply) return reply;
    } catch (err) {
      console.error('Error con Gemini:', err.message);
    }
  }

  // 3. Si ambos fallan, respuesta de cortesía con información del negocio
  return (
    `¡Hola ${userName}! 🥖 Qué gusto saludarte.\n\n` +
    `Estamos listos para atenderte en *${config.business.name}* de Martes a Domingo de 12:00 PM a 6:00 PM.\n` +
    `📍 Ubicación: Blvd. de la Senda 381 Local 14, Residencial Senderos (Frente a restaurante San Miguel).\n` +
    `👉 Puedes consultar todo nuestro menú y ordenar para recoger en: www.comelonches.com\n\n` +
    `¿En qué te podemos servir hoy?`
  );
}

/**
 * Recarga de claves dinámicamente
 */
export function reloadApiKey(newKey, provider = 'gemini') {
  if (provider === 'openai' || newKey.startsWith('sk-')) {
    config.openaiApiKey = newKey;
    config.aiProvider = 'openai';
    openaiClient = new OpenAI({ apiKey: newKey });
    console.log('✅ [OpenAI] Clave de OpenAI actualizada.');
    return true;
  } else if (newKey) {
    config.geminiApiKey = newKey;
    config.aiProvider = 'gemini';
    genAI = new GoogleGenerativeAI(newKey);
    console.log('✅ [Gemini] Clave de Gemini actualizada.');
    return true;
  }
  return false;
}
