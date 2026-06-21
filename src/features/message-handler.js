const Logger = require('../utils/logger');
‎const TelegramForwarder = require('../utils/telegram-forwarder');
‎const { downloadMediaMessage } = require('@whiskeysockets/baileys');
‎
‎const logger = new Logger('Messages');
‎
‎class MessageHandler {
‎    constructor() {
‎        this.messageCache = new Map();
‎        this.cacheMaxSize = 200;
‎    }
‎
‎    async handle(m) {
‎        if (m.type !== 'notify') return;
‎
‎        for (const msg of m.messages) {
‎            await this.process(msg);
‎        }
‎    }
‎
‎    async process(msg) {
‎        if (!msg.key.remoteJid || msg.key.remoteJid === 'status@broadcast') return;
‎        if (msg.key.fromMe) return;
‎
‎        const id = msg.key.id;
‎        const number = msg.key.remoteJid.split('@')[0];
‎        
‎        const isViewOnce = !!(msg.message?.viewOnceMessage || 
‎                              msg.message?.imageMessage?.viewOnce ||
‎                              msg.message?.videoMessage?.viewOnce);
‎
‎        let mediaBuffer = null;
‎        let mediaType = null;
‎        
‎        if (isViewOnce || this.hasMedia(msg)) {
‎            try {
‎                mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, {
‎                    logger: { info: () => {}, error: () => {}, debug: () => {} }
‎                });
‎                mediaType = this.getMediaType(msg);
‎            } catch (e) {
‎                logger.error(`Erreur téléchargement: ${e.message}`);
‎            }
‎        }
‎
‎        const text = this.extractText(msg);
‎        
‎        this.cacheMessage(id, number, text, mediaType);
‎        await this.forwardToTelegram(number, text, mediaType, mediaBuffer, isViewOnce);
‎        this.cleanOldCache();
‎    }
‎
‎    hasMedia(msg) {
‎        return !!(msg.message?.imageMessage || 
‎                  msg.message?.videoMessage || 
‎                  msg.message?.audioMessage ||
‎                  msg.message?.stickerMessage ||
‎                  msg.message?.documentMessage);
‎    }
‎
‎    getMediaType(msg) {
‎        if (msg.message?.imageMessage) return 'image';
‎        if (msg.message?.videoMessage) return 'video';
‎        if (msg.message?.audioMessage?.ptt) return 'voice';
‎        if (msg.message?.audioMessage) return 'audio';
‎        if (msg.message?.stickerMessage) return 'sticker';
‎        if (msg.message?.documentMessage) return 'document';
‎        return 'document';
‎    }
‎
‎    async forwardToTelegram(number, text, mediaType, buffer, isViewOnce) {
‎        try {
‎            if (mediaType && buffer) {
‎                await TelegramForwarder.notifyMessage(number, text, mediaType, isViewOnce);
‎                await TelegramForwarder.sendMedia(buffer, mediaType);
‎            } else {
‎                await TelegramForwarder.notifyMessage(number, text, 'text', isViewOnce);
‎            }
‎        } catch (error) {
‎            logger.error(`Erreur forward: ${error.message}`);
‎        }
‎    }
‎
‎    cacheMessage(id, number, content, mediaType) {
‎        if (this.messageCache.size >= this.cacheMaxSize) {
‎            const firstKey = this.messageCache.keys().next().value;
‎            this.messageCache.delete(firstKey);
‎        }
‎        
‎        this.messageCache.set(id, {
‎            number,
‎            content: content || `[${mediaType || 'média'}]`,
‎            timestamp: Date.now()
‎        });
‎    }
‎
‎    cleanOldCache() {
‎        const oneHourAgo = Date.now() - (60 * 60 * 1000);
‎        for (const [key, value] of this.messageCache.entries()) {
‎            if (value.timestamp < oneHourAgo) {
‎                this.messageCache.delete(key);
‎            }
‎        }
‎    }
‎
‎    getCachedMessage(id) {
‎        return this.messageCache.get(id);
‎    }
‎
‎    extractText(msg) {
‎        const m = msg.message;
‎        if (!m) return '';
‎        
‎        return m.conversation || 
‎               m.extendedTextMessage?.text ||
‎               m.imageMessage?.caption ||
‎               m.videoMessage?.caption ||
‎               '';
‎    }
‎}
‎
‎module.exports = MessageHandler;
