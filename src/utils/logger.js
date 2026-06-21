const pino = require('pino');

class Logger {
    constructor(name) {
        this.name = name;
        this.logger = pino({
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname'
                }
            }
        });
    }

    info(msg) {
        this.logger.info(`[${this.name}] ${msg}`);
    }

    success(msg) {
        this.logger.info(`\x1b[32m[${this.name}] ✅ ${msg}\x1b[0m`);
    }

    error(msg) {
        this.logger.error(`[${this.name}] ❌ ${msg}`);
    }

    warn(msg) {
        this.logger.warn(`[${this.name}] ⚠️ ${msg}`);
    }
}

module.exports = Logger;
