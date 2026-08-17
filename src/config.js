import dotenv from 'dotenv';
dotenv.config();

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  port: parseInt(process.env.PORT || '3000', 10),
  business: {
    name: process.env.BUSINESS_NAME || 'Comelonches',
    slogan: process.env.BUSINESS_SLOGAN || '¡El auténtico sabor y los mejores lonches!',
    website: process.env.BUSINESS_WEBSITE || 'https://comelonches.com',
    phone: process.env.BUSINESS_PHONE || '',
    address: process.env.BUSINESS_ADDRESS || 'Av. Principal #123',
    hours: process.env.BUSINESS_HOURS || 'Lunes a Sábado: 9:00 AM - 10:00 PM, Domingos: 10:00 AM - 8:00 PM',
  },
  bot: {
    typingDelayMs: parseInt(process.env.BOT_TYPING_DELAY_MS || '1500', 10),
  },
};
