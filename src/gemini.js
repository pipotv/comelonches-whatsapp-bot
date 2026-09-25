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
 * Obtiene la sesión activa y el historial de mensajes de un usuario
 */
function getUserSession(userId) {
  const now = Date.now();
  if (chatHistories.has(userId)) {
    const session = chatHistories.get(userId);
    if (now - session.lastActivity < SESSION_TIMEOUT_MS) {
      session.lastActivity = now;
      return session;
    }
  }
  const newSession = { messages: [], lastActivity: now, lastGreetingAt: 0 };
  chatHistories.set(userId, newSession);
  return newSession;
}

function getUserHistory(userId) {
  return getUserSession(userId).messages;
}

/**
 * Obtiene el estado operativo actual (día y hora en zona horaria de La Laguna)
 * Inmune a diferencias de locale en servidores Linux/Docker
 */
export function getBusinessStatus() {
  const now = new Date();
  
  // Detección universal del día en La Laguna (independiente de locale del SO)
  let weekdayEn = 'Mon';
  try {
    weekdayEn = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Monterrey', weekday: 'short' }).format(now);
  } catch (e) {
    weekdayEn = 'Mon';
  }
  
  const isMonday = weekdayEn === 'Mon';

  let timeStr = '12:00 PM';
  try {
    timeStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Monterrey', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    timeStr = now.toTimeString().substring(0, 5);
  }

  return { weekday: isMonday ? 'Lunes' : weekdayEn, timeStr, isMonday };
}

/**
 * Crea el prompt de sistema oficial y limpio de Comelonches
 */
function getSystemPrompt(userName = 'Cliente') {
  const { weekday, timeStr, isMonday } = getBusinessStatus();

  return `
Eres "Lonchy", el asistente virtual oficial de "${config.business.name}".
Tu misión es atender a los clientes en WhatsApp de forma cálida, amable, clara y muy servicial, guiándolos siempre con amabilidad a pedir por nuestra página web oficial cuando aún no han pedido.

${BUSINESS_KNOWLEDGE}

DÍA Y HORA ACTUAL: ${weekday.toUpperCase()}, ${timeStr} (Hora de La Laguna).
Nombre del cliente: ${userName || 'Cliente'}.
${isMonday ? `
🚨 REGLA SUPREMA DE HOY (LUNES):
- ¡HOY ES LUNES Y ESTAMOS TOTALMENTE CERRADOS!
- ESTÁ TERMINANTEMENTE PROHIBIDO DECIR QUE ESTAMOS ABIERTOS O QUE SE PUEDEN HACER PEDIDOS HOY.
- En cualquier respuesta debes aclarar con amabilidad que HOY LUNES ESTAMOS CERRADOS por descanso, pero que mañana martes abrimos a las 12:00 PM (horario: Martes a Domingo de 12:00 PM a 6:00 PM).
- Invítalos a checar el menú en www.comelonches.com para que lo conozcan.
` : ''}

PAUTAS DE ATENCIÓN Y PERSUASIÓN SUTIL:
1. **Saludo Inicial:** Cuando el cliente salude ("Hola", "Buenas tardes", etc.), responde con calidez y simpatía, preséntate como Lonchy de Comelonches, ofrécele consultar el menú y ordenar en línea.
2. **Persuasión Sutil hacia la Web (www.comelonches.com):**
   - Cuando pregunten por pedidos, menú, precios o quieran ordenar, resalta con amabilidad que **la forma más rápida de pedir es en la web**, porque su orden **entra directo al sistema de cocina** y se prepara al instante mientras van en camino.
   - Sutilmente aclara que por WhatsApp el equipo suele estar ocupado en la plancha y puede tardar en leer los mensajes, por lo que en la web su pedido queda asegurado y listo al llegar.
3. **Servicio a Domicilio:** Recuerda siempre con amabilidad que no contamos con servicio a domicilio, pero pueden ordenar en línea para recoger en sucursal sin esperas.
4. **REGLA DE ORO DEL PAN (OBLIGATORIA Y ESTRICTA):**
   - Siempre que pregunten "¿Qué pan usan?", "¿De cuál pan es?", "¿Qué tipo de pan usan?" o cualquier duda sobre el pan, **ES OBLIGATORIO** responder explícitamente: **Pan Francés de La Laguna** (doradito y calientito a la plancha).
   - NUNCA uses frases genéricas como "pan fresco", y **PROHIBIDO TOTALMENTE** decir "bolillo", "telera" o "birote". Es **100% Pan Francés Lagunero**.
5. **REGLA CRÍTICA DE COMANDAS Y PEDIDOS YA REALIZADOS EN LA WEB:**
   - Si el cliente envía o comparte un ticket o comanda de pedido (ej. "NUEVO PEDIDO — COME LONCHE'S"), **NUNCA le pidas que vuelva a hacer el pedido en la web**, porque ¡EL CLIENTE YA LO HIZO!
   - En su lugar: Agradécele con entusiasmo, confirma que su orden fue recibida en cocina para tenerla lista a su hora de recogida en la sucursal (Blvd. de la Senda 381, Local 14).
   - Si el cliente ya envió su pedido y hace preguntas posteriores (como "¿dónde están?", "¿aceptan tarjeta?"), respóndele directamente sin volver a invitarlo a hacer un pedido.
6. **SOLICITUD DE MENÚ O FOTO DEL MENÚ:**
   - Si el cliente pide el menú o foto de la carta ("me pasas foto de tu menú", "tienen menú", etc.):
   - **NUNCA digas "lamentablemente no puedo enviar fotos" ni uses tono de disculpa.**
   - Invítalo con entusiasmo a consultar nuestro **menú completo con fotos, ingredientes y precios** directamente en nuestra página web: 👉 *www.comelonches.com*.
7. **Formato:** Mantén las respuestas bien estructuradas, con emojis agradables, precios en **negritas** y el enlace destacado 👉 *www.comelonches.com*.

ESTRUCTURA EXACTA DE MENSAJES (Sigue este tono y formato):

Ejemplo 1 (Saludo en día regular de Martes a Domingo):
"¡Hola, ${userName}! 👋 Soy Lonchy, tu asistente virtual de Comelonches. ¡Es un gusto saludarte!

Estoy aquí para ayudarte con nuestro menú y resolver tus dudas. 😊

Para que tu pedido entre directo a nuestro sistema de cocina y lo tengamos listo calientito en cuanto llegues, te recomendamos ordenar en línea desde nuestra página:
👉 *www.comelonches.com*

¿En qué puedo ayudarte hoy?"

Ejemplo 1B (Cuando preguntan o quieren pedir en LUNES CERRADO):
"¡Hola, ${userName}! Te comento con cariño que hoy **lunes estamos cerrados** descansando 🚫😴, pero con muchísimo gusto te esperamos mañana **martes de 12:00 PM a 6:00 PM**.

Puedes ir conociendo todo nuestro menú y planear tu pedido en: 👉 *www.comelonches.com*

¡Mañana te lo preparamos bien calientito!"

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
"¡Hola, ${userName}! ¡Sí tenemos lonche **Mixto**! Se le llama mixto tanto al de **Carnitas con Aguacate** como al de **Adobada con Aguacate**, ambos cuestan **$109 MXN** cada uno. 🥖🥑

Puedes pedir tu favorito directo en nuestra web para que empiece a prepararse al instante: 👉 *www.comelonches.com*

¿Cuál se te antoja más, de Carnitas o de Adobada?"

Ejemplo 6 (Pregunta por el lonche más barato o económico):
"¡Hola, ${userName}! Nuestros lonches más económicos son los sencillos de **Queso**, **Jamón** o **Aguacate** por solo **$79 MXN** cada uno. 🥖😋

Puedes checar todo el menú y ordenar para recoger en: 👉 *www.comelonches.com*"

Ejemplo 7 (Pregunta "¿Qué pan usan?" o sobre el tipo de pan):
"¡Hola, ${userName}! En Comelonches utilizamos exclusivamente el auténtico y tradicional **Pan Francés de La Laguna**, doradito y calientito a la plancha. 🥖✨ (¡Puro pan francés lagunero original!).

Puedes hacer tu pedido para pasar a recogerlo calientito en: 👉 *www.comelonches.com*"

Ejemplo 8 (Pregunta de Ubicación o Domicilio):
"¡Hola, ${userName}! Estamos ubicados en:
📍 *Blvd. de la Senda 381, Local 14, Residencial Senderos* (frente al restaurante San Miguel).

No contamos con servicio a domicilio, pero puedes hacer tu pedido en línea para que entre directo a cocina y pasar a recogerlo listo: 👉 *www.comelonches.com*

¡Te esperamos! 😊"

Ejemplo 9 (Cuando el cliente envía su comanda / NUEVO PEDIDO de la página web):
"¡Muchas gracias por tu pedido, Sabine! 🥖🎉

✅ Hemos recibido tu comanda con éxito en nuestro sistema de cocina.
⏰ Hora estimada de recogida: 14:15
💵 Total a pagar: $417
📍 Te esperamos para entregártelo calientito en:
*Blvd. de la Senda 381, Local 14, Residencial Senderos* (frente al restaurante San Miguel).

¡Ya lo mandamos a la plancha para tenerlo listo a tu llegada! ¡Buen provecho! 😊✨"

Ejemplo 10 (Pregunta por el menú o foto del menú):
"¡Hola, ${userName}! 🥖✨ Puedes consultar nuestro **menú completo con fotos, ingredientes y precios** directamente en nuestra página web:

👉 *www.comelonches.com*

Desde ahí mismo puedes hacer tu pedido para que pase directo al sistema de cocina y te lo tengamos listo calientito en cuanto pases por él. 😋

¿Te gustaría saber los ingredientes o precio de algún lonche en específico? Con gusto te ayudo. 😊"
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
  
  // Limitar historial a los últimos 10 mensajes y sanitizar cualquier mención incorrecta
  const sanitizedHistory = history.slice(-10).map(msg => {
    if (msg.role === 'assistant' && /bolillo|telera|birote|pan fresco/i.test(msg.content)) {
      return {
        ...msg,
        content: msg.content.replace(/bolillo|telera|birote|pan fresco y delicioso|pan fresco/gi, 'Pan Francés de La Laguna')
      };
    }
    return msg;
  });

  const messages = [
    { role: 'system', content: getSystemPrompt(userName) },
    ...sanitizedHistory,
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    temperature: 0.5,
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

function isWebsiteOrderTicket(text) {
  const upper = text.toUpperCase();
  return (
    (upper.includes('NUEVO PEDIDO') && (upper.includes('COME LONCHE') || upper.includes('HORA DE RECOGIDA') || upper.includes('PRODUCTOS:'))) ||
    (upper.includes('HORA DE RECOGIDA:') && upper.includes('TOTAL:')) ||
    (upper.includes('NUEVO PEDIDO') && upper.includes('TOTAL:'))
  );
}

function handleWebsiteOrderTicket(text, senderName) {
  const clientMatch = text.match(/(?:Cliente|Nombre):\s*([^\n\r]+)/i);
  const timeMatch = text.match(/Hora de Recogida:\s*([^\n\r]+)/i);
  const totalMatch = text.match(/TOTAL:\s*([^\n\r]+)/i);

  const clientName = clientMatch ? clientMatch[1].trim() : (senderName && senderName !== 'Cliente' ? senderName : 'Cliente');
  const pickupTime = timeMatch ? timeMatch[1].trim() : null;
  const total = totalMatch ? totalMatch[1].trim() : null;

  return (
    `¡Muchas gracias por tu pedido, *${clientName}*! 🥖🎉\n\n` +
    `✅ *Hemos recibido tu comanda en nuestro sistema con éxito.*\n` +
    (pickupTime ? `⏰ *Hora estimada de recogida:* ${pickupTime}\n` : '') +
    (total ? `💵 *Total a pagar:* ${total}\n` : '') +
    `📍 *Lugar de entrega:* Blvd. de la Senda 381, Local 14, Residencial Senderos (Frente a restaurante San Miguel).\n\n` +
    `👨‍🍳 Ya tenemos tu orden programada en la cocina para que tus lonches estén recién hechos y calientitos a tu llegada.\n\n` +
    `¡Muchas gracias por tu preferencia! Si necesitas hacer algún cambio o tienes alguna indicación especial sobre tus lonches, avísanos con toda confianza por aquí. 😊✨`
  );
}

function isPureGreeting(text) {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[!¡?¿.,\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Quita acentos (dias -> dias)
    
  const greetingPatterns = [
    'hola', 'buenos dias', 'buen dia', 'buenas tardes', 'buenas noches',
    'hola buenos dias', 'hola buen dia', 'hola buenas tardes', 'hola buenas noches',
    'hola buenas', 'buenas', 'que tal', 'hola que tal', 'hey', 'saludos', 'hola lonchy',
    'hola buenas tardes', 'hola buenas noches', 'hola buenos dias'
  ];
  return greetingPatterns.includes(normalized.trim());
}

function isAskingIfOpenOrOrdering(text) {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const openKeywords = [
    'abierto', 'abiertos', 'abren', 'abren hoy', 'estan abiertos', 'estan abierto',
    'esta abierto', 'estan dando servicio', 'hay servicio', 'tienen servicio',
    'horario', 'a que hora', 'cierran', 'hasta que hora', 'puedo ordenar', 'puedo pedir'
  ];

  return openKeywords.some(kw => norm.includes(kw));
}

function isAskingForMenuOrPhoto(text) {
  const norm = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  return (
    (norm.includes('foto') && (norm.includes('menu') || norm.includes('carta'))) ||
    norm.includes('pasar foto') ||
    norm.includes('pasar el menu') ||
    norm.includes('pasame el menu') ||
    norm.includes('pasan el menu') ||
    norm.includes('pasar tu menu') ||
    norm.includes('ver el menu') ||
    norm.includes('su menu') ||
    norm.includes('tienen menu') ||
    norm.includes('mandar el menu') ||
    norm.includes('mandar tu menu') ||
    norm.includes('manda el menu') ||
    norm.includes('compartir el menu')
  );
}

/**
 * Función principal para generar respuesta de IA (admite OpenAI y Gemini con fallback)
 */
export async function getAiResponse(userId, userMessage, userName = 'Cliente') {
  const cleanMsg = (userMessage || '').trim();
  const { isMonday } = getBusinessStatus();
  const session = getUserSession(userId);

  // 1. Si el cliente envía una comanda o ticket de pedido de la página web (NUEVO PEDIDO)
  if (isWebsiteOrderTicket(cleanMsg)) {
    const orderReply = handleWebsiteOrderTicket(cleanMsg, userName);
    session.messages.push({ role: 'user', content: cleanMsg });
    session.messages.push({ role: 'assistant', content: orderReply });
    session.hasActiveOrder = true;
    return orderReply;
  }

  // 2. Si el cliente pide el menú o foto del menú
  if (isAskingForMenuOrPhoto(cleanMsg)) {
    const menuReply = (
      `¡Hola, ${userName}! 🥖✨ Puedes consultar nuestro **menú completo con fotos de cada lonche, ingredientes y precios actualizados** directamente en nuestra página web:\n\n` +
      `👉 *www.comelonches.com*\n\n` +
      `Desde ahí mismo puedes hacer tu pedido para que pase directo al sistema de cocina y te lo tengamos listo calientito en cuanto pases por él. 😋\n\n` +
      `¿Te gustaría saber los ingredientes o precio de algún lonche en específico? Con gusto te ayudo. 😊`
    );
    session.messages.push({ role: 'user', content: cleanMsg });
    session.messages.push({ role: 'assistant', content: menuReply });
    return menuReply;
  }

  // 3. Si es un saludo puro, entregar la bienvenida adecuada sin duplicar
  if (isPureGreeting(cleanMsg)) {
    const now = Date.now();
    const greetedRecently = session.lastGreetingAt && (now - session.lastGreetingAt < 10 * 60 * 1000);
    session.lastGreetingAt = now;

    // Si ya lo saludamos hace menos de 10 minutos, responder cortésmente sin repetir todo el discurso
    if (greetedRecently) {
      const shortReply = `¡Hola de nuevo, ${userName}! 😊 ¿En qué te podemos ayudar? ¿Deseas consultar algún lonche, precio o tienes alguna duda?`;
      session.messages.push({ role: 'user', content: cleanMsg });
      session.messages.push({ role: 'assistant', content: shortReply });
      return shortReply;
    }

    // Si es primera vez o nueva conversación, saludo oficial completo
    session.messages = []; // Reiniciar mensajes para saludo fresco
    const greetingReply = isMonday
      ? (
          `¡Hola, ${userName}! 👋 Soy Lonchy, tu asistente virtual de Comelonches. ¡Es un gusto saludarte!\n\n` +
          `Te comento con cariño que hoy *LUNES estamos cerrados* descansando 🚫😴, pero con muchísimo gusto te esperamos mañana *martes a partir de las 12:00 PM*.\n\n` +
          `Puedes ir conociendo todo nuestro menú y planear tu pedido en nuestra página web:\n` +
          `👉 *www.comelonches.com*\n\n` +
          `¿Tienes alguna duda sobre nuestros lonches o precios? ¡Aquí estoy para ayudarte! 😊`
        )
      : (
          `¡Hola, ${userName}! 👋 Soy Lonchy, tu asistente virtual de Comelonches. ¡Es un gusto saludarte!\n\n` +
          `Estoy aquí para ayudarte con nuestro menú y resolver todas tus dudas. 😊\n\n` +
          `Para que tu pedido entre directo a nuestro sistema de cocina y lo tengamos listo calientito en cuanto llegues, te recomendamos ordenar en línea desde nuestra página:\n` +
          `👉 *www.comelonches.com*\n\n` +
          `¿En qué puedo ayudarte hoy?`
        );

    session.messages.push({ role: 'user', content: cleanMsg });
    session.messages.push({ role: 'assistant', content: greetingReply });
    return greetingReply;
  }

  // 4. Si es lunes y preguntan si está abierto, horarios o si pueden pedir hoy
  if (isMonday && isAskingIfOpenOrOrdering(cleanMsg)) {
    const mondayReply = (
      `¡Hola, ${userName}! 🥖 Te comento con cariño que hoy *LUNES estamos cerrados* descansando para recargar pilas 🚫😴.\n\n` +
      `¡Con muchísimo gusto te esperamos mañana *martes a partir de las 12:00 PM* (nuestro horario es de Martes a Domingo de 12:00 PM a 6:00 PM)!\n\n` +
      `Puedes ir revisando todo nuestro menú y precios en nuestra página web:\n` +
      `👉 *www.comelonches.com*\n\n` +
      `¡Mañana te preparamos tus lonches bien calientitos!`
    );
    session.messages.push({ role: 'user', content: cleanMsg });
    session.messages.push({ role: 'assistant', content: mondayReply });
    return mondayReply;
  }

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
      const reply = await getOpenAiResponse(userId, cleanMsg, userName);
      if (reply) return reply;
    } catch (err) {
      console.error('Error con OpenAI:', err.message);
    }
  }

  // 2. Usar Google Gemini
  if (hasGemini) {
    try {
      const reply = await getGeminiResponse(userId, cleanMsg, userName);
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
