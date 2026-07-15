const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const db = require('./db');

const AUTH_DIR = path.join(__dirname, '../auth_info');

async function initWhatsApp({ onQr, onConnected, onDisconnected, onReact }) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // QR is shown on the dashboard instead
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) onQr(qr);
    if (connection === 'open') onConnected();
    if (connection === 'close') {
      onDisconnected();
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => initWhatsApp({ onQr, onConnected, onDisconnected, onReact }), 2000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        // Only status broadcasts, only from others, must have a participant (sender)
        if (msg.key.remoteJid !== 'status@broadcast') continue;
        if (msg.key.fromMe) continue;
        if (!msg.key.participant) continue;

        const settings = db.getSettings();
        if (!settings.enabled) continue;

        const sender = msg.key.participant;
        if (settings.mode === 'whitelist' && !settings.whitelist.includes(sender)) continue;
        if (settings.mode === 'blacklist' && settings.blacklist.includes(sender)) continue;

        const emoji = settings.reactionMode === 'fixed'
          ? settings.fixedEmoji
          : settings.emojis[Math.floor(Math.random() * settings.emojis.length)];

        const spread = Math.max(0, settings.maxDelayMs - settings.minDelayMs);
        const delay = settings.minDelayMs + Math.floor(Math.random() * spread);
        await new Promise(r => setTimeout(r, delay));

        await sock.sendMessage(
          msg.key.remoteJid,
          { react: { text: emoji, key: msg.key } },
          { statusJidList: [sender] }
        );

        let name = sender.split('@')[0];
        try {
          const contact = sock.contacts?.[sender];
          if (contact?.notify) name = contact.notify;
          else if (contact?.name) name = contact.name;
        } catch (_) { /* ignore lookup failures */ }

        const statusType = Object.keys(msg.message || {})[0] || 'unknown';

        onReact({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          from: sender,
          fromName: name,
          emoji,
          statusType,
          success: true
        });
      } catch (err) {
        console.error('Reaction error:', err.message);
        onReact({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          from: msg.key.participant || 'unknown',
          fromName: 'unknown',
          emoji: null,
          statusType: 'error',
          success: false,
          error: err.message
        });
      }
    }
  });

  return sock;
}

module.exports = { initWhatsApp };
