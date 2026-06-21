const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const Pino = require('pino');
const QRCode = require('qrcode');
const config = require('../config/config');
const Logger = require('../utils/logger');
const SessionManager = require('./session-manager');
const MessageHandler = require('../features/message-handler');
const AntiDeleteSystem = require('../features/anti-delete');
const StatusWatcher = require('../features/status-watcher');
const TelegramForwarder = require('../utils/telegram-forwarder');
const AntiDetect = require('../utils/anti-detect');

const logger = new Logger('WhatsApp');

class WhatsAppClient {
    constructor(io) {
        this.io = io;
        this.sock = null;
        this.connected = false;
        this.qr = null;
        this.attempts = 0;
        this.keepAliveInterval = null;
        this.sessionManager = new SessionManager(config.auth.path);
        this.messageHandler = new MessageHandler();
        this.antiDelete = new AntiDeleteSystem(this.messageHandler);
        this.statusWatcher = new StatusWatcher(this);
        this.statusQueue = [];
        this.processingStatuses = false;
    }

    async initialize() {
        const { state, saveCreds } = await useMultiFileAuthState(config.auth.path);

        this.sock = makeWASocket({
            auth: state,
            logger: Pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['Chrome (Linux)', '', ''],
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        this.sock.ev.on('messages.upsert', async (m) => {
            await AntiDetect.humanDelay(100, 2000);
            await this.messageHandler.handle(m);

            if (m.messages) {
                m.messages.forEach(msg => this.queueStatus(msg));
            }
        });

        this.sock.ev.on('messages.update', (updates) => {
            this.antiDelete.handle(updates, this);
        });
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            this.qr = await QRCode.toDataURL(qr);
            logger.info('QR Code généré');

            await TelegramForwarder.notifyQR();

            if (this.io) {
                this.io.emit('qr', this.qr);
            }
        }

        if (connection === 'close') {
            this.connected = false;

            await TelegramForwarder.notifyDisconnected();

            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
                this.keepAliveInterval = null;
            }

            const shouldReconnect =
                (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut;

            if (shouldReconnect && this.attempts < 5) {
                this.attempts++;

                const delay =
                    (10000 * this.attempts) + (Math.random() * 10000);

                logger.warn(
                    `Reconnexion dans ${Math.floor(delay / 1000)}s`
                );

                setTimeout(() => this.initialize(), delay);
            }
        } else if (connection === 'open') {
            this.connected = true;
            this.attempts = 0;

            logger.success('Connecté !');

            await TelegramForwarder.notifyConnected();

            if (this.io) {
                this.io.emit('connected');
            }

            this.startVariablePresence();
        }
    }

    startVariablePresence() {
        const varyPresence = async () => {
            if (!this.sock || !this.connected) {
                return;
            }

            if (AntiDetect.shouldSleep()) {
                await this.sock.sendPresenceUpdate('unavailable');

                logger.info('Mode sommeil (offline)');

                const sleepTime = 30 + Math.random() * 30;

                setTimeout(
                    varyPresence,
                    sleepTime * 60 * 1000
                );

                return;
            }

            const presence = AntiDetect.getRandomPresence();

            await this.sock.sendPresenceUpdate(presence);

            const nextChange =
                (2 + Math.random() * 3) * 60 * 1000;

            setTimeout(varyPresence, nextChange);
        };

        setTimeout(varyPresence, 10000);
    }

    queueStatus(msg) {
        if (msg.key.remoteJid !== 'status@broadcast') {
            return;
        }

        this.statusQueue.push(msg);

        if (!this.processingStatuses) {
            this.processStatusQueue();
        }
    }

    async processStatusQueue() {
        this.processingStatuses = true;

        while (this.statusQueue.length > 0) {
            const msg = this.statusQueue.shift();

            await AntiDetect.viewStatusWithDelay(
                this.statusQueue.length
            );

            await this.statusWatcher.handle(msg);
        }

        this.processingStatuses = false;
    }

    async sendMessage(jid, text) {
        if (!this.sock || !this.connected) {
            return;
        }

        if (!AntiDetect.canPerformAction()) {
            logger.warn('Limite quotidienne atteinte');
            return;
        }

        await AntiDetect.beforeReply();

        return await AntiDetect.simulateRealTyping(
            this.sock,
            jid,
            text
        );
    }

    async disconnect() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }

        if (this.sock) {
            await this.sock.logout();
        }
    }
}

module.exports = WhatsAppClient;
