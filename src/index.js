require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');

const { initWhatsApp } = require('./whatsapp');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let currentQr = null;
let connectionState = 'connecting'; // connecting | qr | connected | disconnected

async function start() {
  await initWhatsApp({
    onQr: (qr) => {
      currentQr = qr;
      connectionState = 'qr';
    },
    onConnected: () => {
      connectionState = 'connected';
      currentQr = null;
      console.log('WhatsApp connected.');
    },
    onDisconnected: () => {
      connectionState = 'disconnected';
    },
    onReact: (entry) => {
      db.addLog(entry);
    }
  });
}

// ---- Dashboard API ----

app.get('/api/status', async (req, res) => {
  let qrImage = null;
  if (currentQr) qrImage = await QRCode.toDataURL(currentQr);
  res.json({
    connectionState,
    qr: qrImage,
    settings: db.getSettings()
  });
});

app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = db.updateSettings(req.body || {});
  res.json(updated);
});

app.get('/api/logs', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  res.json(db.getLogs(limit, offset));
});

app.post('/api/logs/clear', (req, res) => {
  db.clearLogs();
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
  console.log('Open it in a browser to scan the QR code and manage reactions.');
});

start().catch((err) => {
  console.error('Failed to start WhatsApp connection:', err);
});
