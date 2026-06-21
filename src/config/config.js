require('dotenv').config();
‎
‎const config = {
‎    port: process.env.PORT || 3000,
‎    
‎    telegram: {
‎        botToken: process.env.TELEGRAM_BOT_TOKEN,
‎        chatId: process.env.TELEGRAM_CHAT_ID
‎    },
‎    
‎    auth: {
‎        path: process.env.AUTH_PATH || '/tmp/auth'
‎    },
‎    
‎    limits: {
‎        maxDailyMessages: parseInt(process.env.MAX_DAILY_MESSAGES) || 100,
‎        nightMode: process.env.NIGHT_MODE === 'true'
‎    }
‎};
‎
‎module.exports = config;
