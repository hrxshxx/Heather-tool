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

- Step-by-step setup when it starts
- All bot tokens loaded from one `tokens.txt` file
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

### 4. Put your bot tokens in `tokens.txt`

Copy `tokens.example.txt` to `tokens.txt` (or let Heather create it on first start) and paste your bot tokens, **one per line**. To give a bot its own voice channel, put the channel ID after its token:

```
BOT_TOKEN_1
BOT_TOKEN_2 987654321098765432
BOT_TOKEN_3
```

Lines starting with `#` are ignored. `tokens.txt` is in `.gitignore`, so it's never uploaded.

### 5. Start Heather

```bash
npm start
```

Heather walks you through setup step by step (press Enter to skip any step):

| Step | What you enter |
|---|---|
| 1. Manager bot token | Paste the manager token (hidden as `•••`). Skip to run without a manager. |
| 2. Manager owners | Your Discord user ID(s), comma-separated. Only they can use the manager. |
| 3. Manager prefix | The command prefix, Enter for `!`. |
| 4. Bot tokens | Heather reads `tokens.txt`. If it's missing or empty, it creates it and waits until you've saved your tokens. |
| 5. Voice channel | The voice channel for bots that don't have their own channel in `tokens.txt`. |

Then all the bots start and you land at the `heather ❯` prompt:

```
[1/5] Manager bot token
  Manager token (hidden): ••••••••••••••••
[2/5] Manager owners
  Your Discord user ID(s) (comma-separated): 123456789012345678
[3/5] Manager prefix
  Command prefix (Enter for !):
[4/5] Bot tokens from tokens.txt
  Found 3 bot token(s), 1 with their own voice channel.
[5/5] Voice channel
  Voice channel ID for the other bots (Enter to skip): 111111111111111111

Setup done. 3 bot(s) starting.
```

## Using the terminal

After setup, type commands at the `heather ❯` prompt:

| Command | What it does |
|---|---|
| `reload` | Re-read `tokens.txt`: starts newly added tokens and logs out bots whose token you removed. |
| `add` | Paste one extra bot token, then a voice channel ID (Enter to skip). The bot starts immediately. |
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

The manager token and anything typed in the terminal only last while Heather is running; `tokens.txt` is read again on every start. To skip the manager steps, set the environment variables below.

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

## Other ways to configure (optional)

`tokens.txt` is the main way to add bots. You can also use **environment variables** (e.g. Replit Secrets); a manager token or owners set here skip those setup steps:

| Variable | Example | Meaning |
|---|---|---|
| `token` | `TOKEN1,TOKEN2` | Bot tokens, comma-separated |
| `channel_id` | `111` or `111,222` | One channel for all bots, or one per token in order |
| `manager_token` | `TOKEN` | Manager bot token |
| `owner_ids` | `123,456` | User IDs allowed to use the manager |
| `prefix` | `!` | Manager prefix |
| `headless` | `1` | Skip the setup steps and run straight from `tokens.txt` and these variables |

Names work in lowercase or uppercase (`MANAGER_TOKEN`). Without an interactive terminal Heather always runs headless.

**Or in the code**: fill in the `bots` list at the top of `index.js`:

```js
const bots = [
  { token: "BOT_TOKEN_1", channel_id: "VOICE_CHANNEL_ID_1" },
  { token: "BOT_TOKEN_2", channel_id: "VOICE_CHANNEL_ID_2" },
];
```

⚠️ Never commit real tokens to a public repo. If a token leaks, reset it in the Developer Portal right away.

## Pterodactyl panel

Heather runs on Pterodactyl without the setup steps: it reads `tokens.txt` and the egg's variables, and every bot plus the manager run in one server (one Docker container).

### 1. Import the egg (panel admin)

1. Download [`egg-heather.json`](egg-heather.json).
2. In the admin area go to **Nests** → pick or create a nest → **Import Egg**, choose the file and import.

### 2. Create the server

Create a server with the **Heather** egg. 256 MB RAM is plenty for a handful of bots. Fill in the variables:

| Variable | What to enter |
|---|---|
| Manager Bot Token | Manager bot token. Leave empty for no manager. |
| Manager Owner IDs | Your Discord user ID(s), comma-separated. |
| Manager Prefix | Command prefix, default `!`. |
| Default Voice Channel ID | Channel for bots without their own channel in `tokens.txt`. |
| Git Repo Address | Where to install Heather from. Leave empty to upload the files yourself. |
| Git Username / Git Access Token | Only for a **private** repo: your GitHub username and a [personal access token](https://github.com/settings/tokens) with read access to the repo. |
| Auto Update | `1` pulls the latest Heather from git on every start. |

The install script downloads Heather, runs `npm install` and creates `tokens.txt`.

**Without git:** leave Git Repo Address empty and upload `index.js`, `bots.js`, `manager.js`, `banner.js`, `keep_alive.js`, `package.json`, `package-lock.json` and `tokens.txt` in the **Files** tab. Dependencies are installed on start.

### 3. Add tokens and start

1. In **Files**, open `tokens.txt` and paste your bot tokens, one per line (optionally followed by a voice channel ID). Save.
2. Press **Start**. The console shows `Heather is running` once it's up.

The console accepts the same commands as the terminal: `list`, `reload` (after editing `tokens.txt`), `vc`, `remove`, `help`. **Stop** sends `exit`, which logs all bots out cleanly.

## Docker

Everything runs in one container:

```bash
docker build -t heather .
docker run -d --name heather --restart unless-stopped \
  -v "$PWD/tokens.txt:/app/tokens.txt" \
  -e MANAGER_TOKEN=your_manager_token -e OWNER_IDS=your_user_id -e CHANNEL_ID=voice_channel_id \
  heather
```

`docker logs -f heather` shows the output. Add `-it` to `docker run` and use `docker attach heather` if you want to type console commands.

## Hosting

`keep_alive.js` starts a small web server on port 8080 that replies "I'm alive", so uptime pingers can keep free hosts (like Replit) awake. When Heather has no interactive terminal (most hosts), it skips the setup steps and just runs the bots from `tokens.txt`, environment variables and the `bots` list. Set `PORT` to change the keep-alive port.

## Files

| File | Purpose |
|---|---|
| `index.js` | Heather terminal and startup config |
| `bots.js` | Starts a bot, keeps it in its voice channel |
| `manager.js` | Manager bot: prefix commands and panel |
| `banner.js` | Banner and terminal colors |
| `keep_alive.js` | Keep-alive web server |
| `tokens.example.txt` | Template for `tokens.txt` |
| `egg-heather.json` | Pterodactyl egg |
| `Dockerfile` | Single-container Docker image |

## Notes

- Bots join voice through a gateway voice state update, so they appear in the channel without streaming audio. They can't play sound.
- A bot can only be in one voice channel per server. Moving it to another server's channel makes it leave the old one.
- If a bot shows as muted, a server admin muted it; the bot can't undo that.
