const readline = require("readline");
const fs = require("fs");
const path = require("path");
const keep_alive = require('./keep_alive.js')
const startBot = require("./bots.js");
const startManager = require("./manager.js");
const { banner, purple, pink, bold, dim, green, yellow, red } = require("./banner.js");

// Bots to start right away. Everything here can also be added live from the
// Heather terminal. channel_id is the voice channel the bot should sit in.
const bots = [
  // { token: "BOT_TOKEN_1", channel_id: "VOICE_CHANNEL_ID_1" },
  // { token: "BOT_TOKEN_2", channel_id: "VOICE_CHANNEL_ID_2" },
];

// The manager bot that controls all the bots with prefix commands.
// owner_ids: user IDs allowed to use it. If empty, server admins can use it.
const manager = {
  token: process.env.manager_token || "",
  prefix: process.env.prefix || "!",
  owner_ids: (process.env.owner_ids || "").split(",").map((id) => id.trim()).filter(Boolean),
};

// Bots can also come from environment variables:
// token=TOKEN1,TOKEN2 and channel_id=ID (shared) or channel_id=ID1,ID2 (in order)
const envTokens = (process.env.token || "").split(",").map((t) => t.trim()).filter(Boolean);
const envChannelIDs = (process.env.channel_id || "").split(",").map((c) => c.trim()).filter(Boolean);
envTokens.forEach((token, i) => {
  bots.push({ token, channel_id: envChannelIDs.length === 1 ? envChannelIDs[0] : envChannelIDs[i] });
});

// Voice channel for bots that don't have their own
let defaultChannelID = envChannelIDs.length === 1 ? envChannelIDs[0] : "";

// Running bots. The manager reads this same array, so changes show up in its panel.
const workers = bots.map(startBot);
let managerHandle = null;

function startManagerBot() {
  if (managerHandle) managerHandle.stop();
  managerHandle = startManager(manager, workers);
}

const out = process.stdout;
const say = (text = "") => out.write(text + "\n");

function looksLikeToken(token) {
  return token.split(".").length === 3 && token.length > 50;
}

const isID = (id) => /^\d{15,25}$/.test(id);

// ---------- tokens.txt ----------

// Bot tokens are read from this file, one bot per line, with an optional
// voice channel ID after the token
const tokensFile = path.join(__dirname, "tokens.txt");
const TOKENS_TEMPLATE = [
  "# Heather bot tokens: one bot per line.",
  "# Add a voice channel ID after a token to give that bot its own channel:",
  "#",
  "#   BOT_TOKEN",
  "#   BOT_TOKEN VOICE_CHANNEL_ID",
  "#",
  "# Lines starting with # are ignored.",
  "",
].join("\n");

// Returns the bots in tokens.txt, or null when the file didn't exist (it's created)
function readTokensFile() {
  if (!fs.existsSync(tokensFile)) {
    fs.writeFileSync(tokensFile, TOKENS_TEMPLATE);
    return null;
  }

  const entries = [];
  fs.readFileSync(tokensFile, "utf8").split(/\r?\n/).forEach((line, n) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const [token, channel_id] = line.split(/[\s,]+/);
    if (!looksLikeToken(token)) return say(yellow(`  tokens.txt line ${n + 1} doesn't look like a bot token, skipped.`));
    if (channel_id && !isID(channel_id)) return say(yellow(`  tokens.txt line ${n + 1} has an invalid channel ID, skipped.`));
    if (!entries.some((e) => e.token === token)) entries.push({ token, channel_id });
  });
  return entries;
}

// Start the bots in tokens.txt that aren't running yet, and with removeMissing
// stop the ones that were taken out of the file
function loadTokensFile({ removeMissing = false, entries = readTokensFile() } = {}) {
  if (entries === null) return null;

  let started = 0;
  let removed = 0;
  for (const { token, channel_id } of entries) {
    if (workers.some((w) => w.bot._token === token)) continue;
    const worker = startBot({ token, channel_id: channel_id || defaultChannelID });
    worker.fromFile = true;
    workers.push(worker);
    started++;
  }
  if (removeMissing) {
    for (const worker of workers.filter((w) => w.fromFile && !entries.some((e) => e.token === w.bot._token))) {
      worker.stop();
      workers.splice(workers.indexOf(worker), 1);
      removed++;
    }
  }
  return { total: entries.length, started, removed };
}

// ---------- Terminal interface ----------

say();
say(banner());
say();
say(`  ${bold(purple("Heather"))} ${dim("· keeps your Discord bots online and in voice")}`);
say();

// Without an interactive terminal (e.g. a hosting service), just run the bots
if (!process.stdin.isTTY) {
  say(dim("No interactive terminal, running the configured bots only."));
  if (manager.token) startManagerBot();
  const loaded = loadTokensFile();
  if (loaded) say(dim(`Loaded ${loaded.started} bot(s) from tokens.txt.`));
  return;
}

const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
rl.setPrompt(`${purple("heather")} ${pink("❯")} `);

// Hidden input for tokens: while hiddenQuery is set, typed or pasted text is
// shown as dots instead of the real characters
let hiddenQuery = null;
let asking = false;
rl._writeToOutput = (text) => {
  if (hiddenQuery === null || text === "\r\n" || text === "\n") return out.write(text);
  out.write("\r\x1b[K" + hiddenQuery + "•".repeat(rl.line.length));
};

function ask(query, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (hidden) hiddenQuery = query;
    asking = true;
    rl.question(query, (answer) => {
      hiddenQuery = null;
      asking = false;
      resolve(answer.trim());
    });
  });
}

// Bot logs arrive at any time, so print them above the prompt and redraw it
let busy = false;
for (const method of ["log", "error"]) {
  const original = console[method].bind(console);
  console[method] = (...args) => {
    out.write("\r\x1b[K");
    const time = dim(new Date().toLocaleTimeString());
    original(time, ...args.map((a) => (method === "error" && typeof a === "string" ? red(a) : a)));
    if (!busy || asking) rl.prompt(true);
  };
}

function botName(worker) {
  return worker.bot.user ? worker.bot.user.username : dim(worker.label);
}

function channelStatus(worker) {
  const id = worker.getChannel();
  if (!id) return dim("not in voice");
  const channel = worker.bot.getChannel(id);
  return channel && channel.guild ? `${pink("🔊 " + channel.name)} ${dim("— " + channel.guild.name)}` : yellow(`channel ${id} (not found yet)`);
}

function getWorker(number) {
  const worker = workers[parseInt(number, 10) - 1];
  if (!worker) say(red(`No bot number ${number}. Type ${bold("list")} to see them.`));
  return worker;
}

const commands = {
  help() {
    const row = (cmd, text) => say(`  ${pink(cmd.padEnd(26))} ${dim(text)}`);
    say(bold(purple("Commands")));
    row("manager", "paste the manager bot token (starts or restarts it)");
    row("owner <id>[,<id>...]", "user IDs allowed to use the manager");
    row("prefix <prefix>", "manager command prefix (now " + manager.prefix + ")");
    row("reload", "re-read tokens.txt (starts new bots, stops removed ones)");
    row("add", "paste one extra bot token and voice channel ID");
    row("vc <bot> <channel id>", "move a bot to a voice channel");
    row("vc all <channel id>", "move every bot to one voice channel");
    row("vc <bot> off", "take a bot out of voice");
    row("remove <bot>", "log a bot out and remove it");
    row("list", "show the bots and where they are");
    row("clear", "clear the screen");
    row("exit", "log everything out and quit");
  },

  async manager() {
    const token = await ask(`${pink("Manager token")} ${dim("(hidden)")}: `, { hidden: true });
    if (!token) return say(dim("Cancelled."));
    if (!looksLikeToken(token)) return say(red("That doesn't look like a bot token."));
    manager.token = token;
    startManagerBot();
    say(green(`Manager starting with prefix ${manager.prefix}`));
    if (manager.owner_ids.length === 0) {
      say(yellow(`No owners set, so any server admin can use it. Set yours with ${bold("owner <your user id>")}.`));
    }
  },

  owner(args) {
    const ids = args.join(",").split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return say(`Owners: ${manager.owner_ids.join(", ") || dim("none (server admins)")}`);
    if (!ids.every((id) => /^\d{15,25}$/.test(id))) return say(red("User IDs are long numbers, e.g. 123456789012345678."));
    manager.owner_ids = ids;
    say(green(`Owners set to ${ids.join(", ")}`));
    if (managerHandle) startManagerBot();
  },

  prefix([prefix]) {
    if (!prefix) return say(`Prefix: ${manager.prefix}`);
    manager.prefix = prefix;
    say(green(`Prefix set to ${prefix}`));
    if (managerHandle) startManagerBot();
  },

  reload() {
    const loaded = loadTokensFile({ removeMissing: true });
    if (!loaded) return say(yellow(`Created ${tokensFile}. Put your bot tokens in it, then type reload.`));
    say(green(`tokens.txt has ${loaded.total} bot(s): ${loaded.started} started, ${loaded.removed} removed.`));
  },

  async add() {
    const token = await ask(`${pink("Bot token")} ${dim("(hidden)")}: `, { hidden: true });
    if (!token) return say(dim("Cancelled."));
    if (!looksLikeToken(token)) return say(red("That doesn't look like a bot token."));
    if (workers.some((w) => w.bot._token === token)) return say(yellow("That bot is already running."));

    const channelID = await ask(`${pink("Voice channel ID")} ${dim("(enter to skip)")}: `);
    if (channelID && !/^\d{15,25}$/.test(channelID)) return say(red("Channel IDs are long numbers, e.g. 123456789012345678."));

    workers.push(startBot({ token, channel_id: channelID }));
    say(green(`Bot ${workers.length} starting${channelID ? `, will sit in ${channelID}` : ""}.`));
  },

  vc([number, channelID]) {
    if (!number || !channelID) return say(red("Usage: vc <bot> <channel id>, vc all <channel id> or vc <bot> off"));

    const targets = number === "all" ? workers : [getWorker(number)].filter(Boolean);
    for (const worker of targets) {
      if (channelID === "off") {
        worker.setChannel(null);
        say(`${botName(worker)} left voice.`);
        continue;
      }
      const channel = worker.bot.getChannel(channelID);
      if (!channel || (channel.type !== 2 && channel.type !== 13)) {
        say(red(`${botName(worker)} can't see a voice channel with ID ${channelID}.`));
        continue;
      }
      worker.setChannel(channelID);
    }
  },

  remove([number]) {
    const worker = getWorker(number);
    if (!worker) return;
    worker.stop();
    workers.splice(workers.indexOf(worker), 1);
    say(green(`Removed ${botName(worker)}.`));
  },

  list() {
    const managerState = !managerHandle ? dim("not set")
      : managerHandle.failed() ? red("login failed, check the token (type manager)")
      : managerHandle.bot.ready ? green(`online as ${managerHandle.bot.user.username}`) : yellow("connecting");
    say(`${bold(purple("Manager"))}  ${managerState}  ${dim(`prefix ${manager.prefix}`)}`);
    if (workers.length === 0) return say(dim(`No bots yet. Put tokens in tokens.txt and type ${bold("reload")}.`));
    workers.forEach((w, i) => {
      if (w.failed()) {
        return say(`  ${red("●")} ${bold(String(i + 1))}. ${botName(w)}  ${red(`login failed, check the token (remove ${i + 1})`)}`);
      }
      const state = w.bot.ready ? green("● online") : yellow("● connecting");
      say(`  ${state}  ${bold(String(i + 1))}. ${botName(w)}  ${channelStatus(w)}`);
    });
  },

  clear() {
    console.clear();
    say(banner());
    say();
  },

  exit() {
    rl.close();
  },
};

rl.on("line", async (line) => {
  const [name, ...args] = line.trim().split(/\s+/);
  if (name) {
    const command = commands[name.toLowerCase()];
    busy = true;
    try {
      if (command) await command(args);
      else say(red(`Unknown command ${name}. Type ${bold("help")} to see the commands.`));
    } catch (err) {
      say(red(err.message));
    }
    busy = false;
  }
  rl.prompt();
});

rl.on("close", () => {
  say(dim("\nLogging out..."));
  workers.forEach((w) => w.stop());
  if (managerHandle) managerHandle.stop();
  process.exit(0);
});

// ---------- Step-by-step setup on start ----------

// Ask until the answer passes check; an empty answer skips the step
async function askValid(query, check, error, options) {
  for (;;) {
    const answer = await ask(query, options);
    if (!answer || check(answer)) return answer;
    say(red(`  ${error}`));
  }
}

function step(number, title) {
  say();
  say(`${pink(`[${number}/5]`)} ${bold(purple(title))}`);
}

async function setup() {
  busy = true;
  say(`${bold(purple("Setup"))} ${dim("· press Enter to skip a step")}`);

  step(1, "Manager bot token");
  if (manager.token) {
    say(dim("  Using manager_token from the environment."));
  } else {
    manager.token = await askValid(`  ${pink("Manager token")} ${dim("(hidden)")}: `,
      looksLikeToken, "That doesn't look like a bot token, try again.", { hidden: true });
    if (!manager.token) say(dim("  Skipped, no manager bot. Add one later with manager."));
  }

  step(2, "Manager owners");
  if (!manager.token) {
    say(dim("  Skipped, no manager bot."));
  } else if (manager.owner_ids.length > 0) {
    say(dim(`  Using owner_ids from the environment: ${manager.owner_ids.join(", ")}`));
  } else {
    const owners = await askValid(`  ${pink("Your Discord user ID(s)")} ${dim("(comma-separated)")}: `,
      (text) => text.split(",").every((id) => isID(id.trim())), "User IDs are long numbers, e.g. 123456789012345678.");
    manager.owner_ids = owners.split(",").map((id) => id.trim()).filter(Boolean);
    if (manager.owner_ids.length === 0) say(yellow("  No owners, so any server admin can use the manager."));
  }

  step(3, "Manager prefix");
  if (!manager.token) {
    say(dim("  Skipped, no manager bot."));
  } else {
    manager.prefix = (await ask(`  ${pink("Command prefix")} ${dim(`(Enter for ${manager.prefix})`)}: `)) || manager.prefix;
    startManagerBot();
    say(green(`  Manager starting with prefix ${manager.prefix}`));
  }

  step(4, "Bot tokens from tokens.txt");
  say(dim(`  ${tokensFile}`));
  let entries = readTokensFile();
  if (entries === null) say(yellow("  Created tokens.txt. Paste your bot tokens in it, one per line, and save."));
  while (!entries || entries.length === 0) {
    if (entries) say(yellow("  tokens.txt has no bot tokens yet. Paste them in, one per line, and save."));
    const answer = await ask(`  ${pink("Press Enter when tokens.txt is saved")} ${dim("(or type skip)")}: `);
    if (answer.toLowerCase() === "skip") break;
    entries = readTokensFile();
  }
  if (entries && entries.length > 0) {
    const withChannel = entries.filter((e) => e.channel_id).length;
    say(green(`  Found ${entries.length} bot token(s)`) + dim(`, ${withChannel} with their own voice channel.`));
  }

  step(5, "Voice channel");
  if (!entries || entries.length === 0) {
    say(dim("  Skipped, no bots."));
  } else if (entries.every((e) => e.channel_id)) {
    say(dim("  Every bot has its own channel in tokens.txt."));
  } else {
    defaultChannelID = (await askValid(`  ${pink("Voice channel ID for the other bots")} ${dim(defaultChannelID ? `(Enter for ${defaultChannelID})` : "(Enter to skip)")}: `,
      isID, "Channel IDs are long numbers, e.g. 123456789012345678.")) || defaultChannelID;
  }

  const loaded = loadTokensFile({ entries: entries || [] });
  say();
  say(green("Setup done.") + ` ${loaded ? loaded.started : 0} bot(s) starting. ${dim("Type")} ${pink("list")} ${dim("to check them,")} ${pink("help")} ${dim("for all commands.")}`);
  say();
  busy = false;
}

setup().then(() => rl.prompt());
