# WhatsApp Status Reactor

Auto-reacts to WhatsApp statuses from your contacts, with a web dashboard to
control who gets reacted to, which emojis are used, and to review a log of
every reaction sent.

## What it does

- Connects to WhatsApp via `@whiskeysockets/baileys` (multi-device, no
  Selenium/Puppeteer needed).
- Listens for status updates (`status@broadcast`) and reacts with an emoji
  (random from a pool, or a fixed one).
- Dashboard (Express + plain HTML/JS) at `http://localhost:3000`:
  - Connection status + in-browser QR scan (no need to read the terminal)
  - On/off master switch
  - All / whitelist / blacklist mode
  - Emoji pool editor
  - Randomized delay range before reacting (keeps it looking human, reduces
    rate-limit risk)
  - Live stats (today / this week / all-time) and a reaction log

## Setup (Termux)

```bash
pkg install nodejs -y
cd whatsapp-status-reactor
npm install
cp .env.example .env
node src/index.js
```

Then open `http://localhost:3000` in your phone's browser (Chrome works
fine on the same device), and scan the QR code shown there via
**WhatsApp → Linked Devices → Link a Device**.

Session credentials are saved to `auth_info/` after the first scan, so you
won't need to re-scan on restart unless you unlink the device.

## Notes / things to be aware of

- **Rate limits & account risk**: WhatsApp doesn't publish official limits
  for automated reactions, but reacting to a large volume of statuses in a
  short window can look automated and risk a temporary restriction. The
  randomized delay (`minDelayMs`/`maxDelayMs`) helps, but keep it
  conservative if you're watching a lot of contacts.
- **Whitelist/blacklist JIDs**: contacts are identified as
  `<countrycode><number>@s.whatsapp.net`, e.g. `254712345678@s.whatsapp.net`.
  The dashboard log shows the contact name; you can cross-reference their
  number from your WhatsApp contacts to build the list.
- **Data storage**: settings and logs are plain JSON files under `data/` —
  no database setup needed, and it's easy to inspect/edit by hand if you
  want to seed a whitelist manually.
- **Single process**: the bot and dashboard run in the same Node process,
  so `node src/index.js` is all you need — convenient for keeping it alive
  in a single Termux session (pair with `termux-wake-lock` to stop Android
  from killing it).

## Project structure

```
whatsapp-status-reactor/
  src/
    index.js      # Express server + wiring
    whatsapp.js    # Baileys connection + reaction logic
    db.js         # JSON-file settings/logs/stats
  public/
    index.html    # Dashboard UI
  data/           # settings.json + logs.json (created on first run)
  auth_info/      # WhatsApp session credentials (created after QR scan)
```
