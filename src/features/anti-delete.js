const Logger = require('../utils/logger');
‎const TelegramForwarder = require('../utils/telegram-forwarder');
‎
‎const logger = new Logger('AntiDelete');
‎
‎class AntiDeleteSystem {
‎    constructor(messageHandler) {
‎        this.messageHandler = messageHandler;
‎    }
‎
‎    async handle(updates, client) {
‎        for (const update of updates) {
‎            if (!this.isDeleteUpdate(update)) continue;
‎            
‎            const id = update.key.id;
‎            const cached = this.messageHandler.getCachedMessage(id);
‎            
‎            if (cached) {
‎                logger.success(`Suppression détectée: +${cached.number}`);
‎                await TelegramForwarder.notifyDeleted(cached.number, cached.content);
‎            }
‎        }
‎    }
‎    
‎    isDeleteUpdate(update) {
‎        const stubType = update.update?.messageStubType;
‎        if (stubType === 1 || stubType === 2) return true;
‎        if (update.update?.protocolMessage?.type === 0) return true;
‎        return false;
‎    }
‎}
‎
‎module.exports = AntiDeleteSystem;
