const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const LOGS_PATH = path.join(DATA_DIR, 'logs.json');

const DEFAULT_SETTINGS = {
  enabled: true,           // master on/off switch
  mode: 'all',             // 'all' | 'whitelist' | 'blacklist'
  whitelist: [],           // array of jids, e.g. "2547xxxxxxx@s.whatsapp.net"
  blacklist: [],
  reactionMode: 'random',  // 'random' | 'fixed'
  fixedEmoji: '🔥',
  emojis: ['🔥', '❤️', '😂', '👏', '💯', '😍', '🙌', '👀'],
  minDelayMs: 1000,        // random delay before reacting (avoids looking robotic / rate limits)
  maxDelayMs: 6000
};

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_PATH)) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }
  if (!fs.existsSync(LOGS_PATH)) {
    fs.writeFileSync(LOGS_PATH, JSON.stringify([], null, 2));
  }
}
ensureFiles();

function getSettings() {
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
}

function updateSettings(patch) {
  const current = getSettings();
  const updated = { ...current, ...patch };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

function getLogs(limit = 50, offset = 0) {
  const logs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
  const sorted = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return { total: sorted.length, entries: sorted.slice(offset, offset + limit) };
}

function addLog(entry) {
  const logs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
  logs.push(entry);
  // cap history so the file doesn't grow forever
  if (logs.length > 5000) logs.splice(0, logs.length - 5000);
  fs.writeFileSync(LOGS_PATH, JSON.stringify(logs, null, 2));
}

function clearLogs() {
  fs.writeFileSync(LOGS_PATH, JSON.stringify([], null, 2));
}

function getStats() {
  const logs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
  const now = new Date();
  const today = logs.filter(l => new Date(l.timestamp).toDateString() === now.toDateString());
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const week = logs.filter(l => new Date(l.timestamp) > weekAgo);

  const byContact = {};
  const byEmoji = {};
  for (const l of logs) {
    byContact[l.fromName] = (byContact[l.fromName] || 0) + 1;
    byEmoji[l.emoji] = (byEmoji[l.emoji] || 0) + 1;
  }
  const topContacts = Object.entries(byContact)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const topEmojis = Object.entries(byEmoji)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([emoji, count]) => ({ emoji, count }));

  return { total: logs.length, today: today.length, week: week.length, topContacts, topEmojis };
}

module.exports = { getSettings, updateSettings, getLogs, addLog, clearLogs, getStats };
