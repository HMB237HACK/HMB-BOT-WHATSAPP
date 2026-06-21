require('dotenv').config();

const WhatsAppClient = require('./core/whatsapp-client');
const WebServer = require('./web/server');
const Logger = require('./utils/logger');

const logger = new Logger('Main');

async function main() {
    try {
        logger.info('🚀 Démarrage...');

        const server = new WebServer();
        await server.start();

        const whatsapp = new WhatsAppClient(server.io);
        await whatsapp.initialize();

        process.on('SIGTERM', async () => {
            logger.info('Arrêt...');
            await whatsapp.disconnect();
            await server.stop();
            process.exit(0);
        });

    } catch (error) {
        logger.error(`Erreur: ${error.message}`);
        process.exit(1);
    }
}

main();
