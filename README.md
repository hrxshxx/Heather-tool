# Heather

Heather keeps your Discord bots online 24/7 and sitting in voice channels. You control everything from a live terminal: paste tokens and channel IDs while it runs, and a separate **manager bot** lets you move the bots around from Discord with prefix commands and a button panel.

```
        ██╗  ██╗███████╗ █████╗ ████████╗██╗  ██╗███████╗██████╗
       ██║  ██║██╔════╝██╔══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██╗
      ███████║█████╗  ███████║   ██║   ███████║█████╗  ██████╔╝
     ██╔══██║██╔══╝  ██╔══██║   ██║   ██╔══██║██╔══╝  ██╔══██╗
    ██║  ██║███████╗██║  ██║   ██║   ██║  ██║███████╗██║  ██║
   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
```

## Features

- Run many bots from one process
- Each bot joins a voice channel on startup (unmuted, undeafened) and rejoins if it gets kicked or moved
- Live terminal: add/remove bots and move them between channels without restarting
- Tokens are hidden (`•••`) while you paste them and never printed in logs
- Manager bot with `!panel`: pick a bot → server → voice channel from dropdown menus
- Channel choices are saved to `channels.json` and restored after a restart

## Requirements

- [Node.js](https://nodejs.org) 16.9 or newer
- A Discord bot application for every bot you want to keep online, plus one more for the manager (optional)

## Setup

### 1. Install

```bash
git clone https://github.com/hrxshxx/Heather-tool.git
cd Heather-tool
npm install
```

### 2. Create the bots

For every bot (and the manager):

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Open **Bot** → **Reset Token** and copy the token. Keep it secret: anyone with it controls the bot.
3. **Manager only:** on the same **Bot** page, turn on **Message Content Intent**. Prefix commands don't work without it.
4. Open **OAuth2 → URL Generator**, tick `bot`, then the permissions **View Channels**, **Connect** (and for the manager **Send Messages**, **Embed Links**). Open the generated URL to invite the bot to your server.

### 3. Get IDs

In Discord, turn on **User Settings → Advanced → Developer Mode**. Then right-click a voice channel → **Copy Channel ID**, or right-click yourself → **Copy User ID**.

### 4. Start Heather

```bash
npm start
```

## Using the terminal

Type commands at the `heather ❯` prompt:

| Command | What it does |
|---|---|
| `add` | Paste a bot token, then a voice channel ID (Enter to skip). The bot starts immediately. |
| `manager` | Paste the manager bot token. Starts it, or restarts it if it's running. |
| `owner <user id>[,<user id>...]` | Who may use the manager. If no owners are set, any server admin can. |
| `prefix <prefix>` | Manager command prefix (default `!`). |
| `vc <bot> <channel id>` | Move a bot to a voice channel. |
| `vc all <channel id>` | Move every bot to one voice channel. |
| `vc <bot> off` | Take a bot out of voice. |
| `remove <bot>` | Log a bot out and remove it. |
| `list` | Show the manager and every bot: online / connecting / login failed, and its channel. |
| `clear` | Clear the screen. |
| `exit` | Log everything out and quit (Ctrl+C works too). |

`<bot>` is the bot's number from `list`.

A quick first run:

```
heather ❯ manager
Manager token (hidden): ••••••••••••••••
heather ❯ owner 123456789012345678
heather ❯ add
Bot token (hidden): ••••••••••••••••
Voice channel ID (enter to skip): 987654321098765432
heather ❯ list
```

Tokens pasted in the terminal only last while Heather is running. To start bots automatically, use one of the options below.

## Manager bot commands (in Discord)

| Command | What it does |
|---|---|
| `!panel` | Opens the control panel: pick a bot → server → voice channel. Has **Leave voice** and **Back** buttons. |
| `!bots` | Lists every bot and where it is. |
| `!join <bot number> <channel id>` | Move a bot to a voice channel. |
| `!leave <bot number>` | Take a bot out of voice. |
| `!help` | Shows these commands. |

Only owners (or server admins when no owners are set) can use these. Others get a private "not allowed" reply.

Discord menus show at most 25 options, so with more than 25 bots, servers or voice channels only the first 25 appear. Use `!join` for the rest.

## Starting bots automatically (optional)

**Environment variables** (recommended, e.g. a `.env` loader or Replit Secrets):

| Variable | Example | Meaning |
|---|---|---|
| `token` | `TOKEN1,TOKEN2` | Bot tokens, comma-separated |
| `channel_id` | `111` or `111,222` | One channel for all bots, or one per token in order |
| `manager_token` | `TOKEN` | Manager bot token |
| `owner_ids` | `123,456` | User IDs allowed to use the manager |
| `prefix` | `!` | Manager prefix |

**Or in the code**: fill in the `bots` list at the top of `index.js`:

```js
const bots = [
  { token: "BOT_TOKEN_1", channel_id: "VOICE_CHANNEL_ID_1" },
  { token: "BOT_TOKEN_2", channel_id: "VOICE_CHANNEL_ID_2" },
];
```

⚠️ Never commit real tokens to a public repo. If a token leaks, reset it in the Developer Portal right away.

## Hosting

`keep_alive.js` starts a small web server on port 8080 that replies "I'm alive", so uptime pingers can keep free hosts (like Replit) awake. When Heather has no interactive terminal (most hosts), it skips the prompt and just runs the bots from environment variables / the `bots` list.

## Files

| File | Purpose |
|---|---|
| `index.js` | Heather terminal and startup config |
| `bots.js` | Starts a bot, keeps it in its voice channel |
| `manager.js` | Manager bot: prefix commands and panel |
| `banner.js` | Banner and terminal colors |
| `keep_alive.js` | Keep-alive web server |

## Notes

- Bots join voice through a gateway voice state update, so they appear in the channel without streaming audio. They can't play sound.
- A bot can only be in one voice channel per server. Moving it to another server's channel makes it leave the old one.
- If a bot shows as muted, a server admin muted it; the bot can't undo that.
