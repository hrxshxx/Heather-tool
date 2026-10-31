const Eris = require("eris");

// Gateway intents the manager needs: guilds, guild messages, DMs and message
// content (enable "Message Content Intent" for the manager in the Developer Portal)
const INTENTS = 1 | 512 | 4096 | 32768;

// Discord limits select menus to 25 options and labels to 100 characters
const MAX_OPTIONS = 25;
const cut = (text, max = 100) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

module.exports = function startManager({ token, prefix, owner_ids }, workers) {
  // Eris only authenticates REST calls (sending messages) as a bot with the "Bot " prefix
  const manager = new Eris(token.startsWith("Bot ") ? token : `Bot ${token}`, { intents: INTENTS });

  // Owners can always use the manager; without owners, server admins can
  function allowed(userID, member) {
    if (owner_ids.length > 0) return owner_ids.includes(userID);
    try {
      return !!member && member.permissions.has("administrator");
    } catch (err) {
      return false; // server not cached, can't check permissions
    }
  }

  function botName(worker) {
    return worker.bot.user ? worker.bot.user.username : `${worker.label} (connecting)`;
  }

  function channelStatus(worker) {
    const id = worker.getChannel();
    if (!id) return "Not in voice";
    const channel = worker.bot.getChannel(id);
    return channel && channel.guild ? `🔊 ${channel.name} — ${channel.guild.name}` : `Unknown channel ${id}`;
  }

  function button(custom_id, label, style = 2, disabled = false) {
    return { type: 2, custom_id, label, style, disabled };
  }

  function select(custom_id, placeholder, options) {
    return { type: 1, components: [{ type: 3, custom_id, placeholder, options: options.slice(0, MAX_OPTIONS) }] };
  }

  // Panel page 1: pick a bot
  function homeView(content = "") {
    return {
      content,
      embeds: [{
        title: "Bot manager",
        color: 0x5865f2,
        description: workers.map((w, i) => `**${i + 1}. ${botName(w)}**\n${channelStatus(w)}`).join("\n\n"),
        footer: { text: "Pick a bot to move it to another channel" },
      }],
      components: [select("bot", "Select a bot", workers.map((w, i) => ({
        label: cut(`${i + 1}. ${botName(w)}`),
        description: cut(channelStatus(w)),
        value: String(i),
      })))],
    };
  }

  // Panel page 2: pick a server the selected bot is in
  function botView(i, content = "") {
    const worker = workers[i];
    const guilds = [...worker.bot.guilds.values()].sort((a, b) => a.name.localeCompare(b.name));
    const components = [];
    if (guilds.length > 0) {
      components.push(select(`guild:${i}`, "Select a server", guilds.map((g) => ({
        label: cut(g.name),
        value: g.id,
      }))));
    }
    components.push({ type: 1, components: [
      button(`leave:${i}`, "Leave voice", 4, !worker.getChannel()),
      button("home", "Back"),
    ] });

    return {
      content,
      embeds: [{
        title: botName(worker),
        color: 0x5865f2,
        description: `${channelStatus(worker)}\n\n` +
          (guilds.length > 0 ? "Pick the server to sit in." : "This bot isn't in any server yet."),
      }],
      components,
    };
  }

  // Panel page 3: pick a voice channel in the selected server
  function guildView(i, guildID) {
    const worker = workers[i];
    const guild = worker.bot.guilds.get(guildID);
    if (!guild) return botView(i, "That server isn't available anymore.");

    // 2 = voice channel, 13 = stage channel
    const channels = guild.channels.filter((c) => c.type === 2 || c.type === 13)
      .sort((a, b) => a.position - b.position);
    const components = [];
    if (channels.length > 0) {
      components.push(select(`channel:${i}`, "Select a voice channel", channels.map((c) => ({
        label: cut(c.name),
        value: c.id,
        default: c.id === worker.getChannel(),
      }))));
    }
    components.push({ type: 1, components: [button(`bot:${i}`, "Back")] });

    return {
      content: "",
      embeds: [{
        title: `${botName(worker)} → ${guild.name}`,
        color: 0x5865f2,
        description: channels.length > 0 ? "Pick the voice channel to sit in." : "This server has no voice channels.",
      }],
      components,
    };
  }

  function findWorker(number) {
    const i = parseInt(number, 10) - 1;
    return workers[i] ? i : -1;
  }

  const commands = {
    help: () => [
      "**Bot manager commands**",
      `\`${prefix}panel\` — open the control panel`,
      `\`${prefix}bots\` — list the bots and where they are`,
      `\`${prefix}join <bot number> <channel id>\` — move a bot to a voice channel`,
      `\`${prefix}leave <bot number>\` — take a bot out of voice`,
    ].join("\n"),

    panel: () => homeView(),

    bots: () => workers.map((w, i) => `**${i + 1}. ${botName(w)}** — ${channelStatus(w)}`).join("\n"),

    join: ([number, channelID]) => {
      const i = findWorker(number);
      if (i < 0 || !channelID) return `Usage: \`${prefix}join <bot number> <channel id>\``;
      const channel = workers[i].bot.getChannel(channelID);
      if (!channel || (channel.type !== 2 && channel.type !== 13)) {
        return `${botName(workers[i])} can't see a voice channel with ID ${channelID}.`;
      }
      workers[i].setChannel(channelID);
      return `✅ ${botName(workers[i])} is joining **${channel.name}**.`;
    },

    leave: ([number]) => {
      const i = findWorker(number);
      if (i < 0) return `Usage: \`${prefix}leave <bot number>\``;
      workers[i].setChannel(null);
      return `👋 ${botName(workers[i])} left voice.`;
    },
  };

  manager.on("messageCreate", (msg) => {
    if (msg.author.bot || !msg.content.startsWith(prefix)) return;

    const [name, ...args] = msg.content.slice(prefix.length).trim().split(/\s+/);
    const command = commands[name.toLowerCase()];
    if (!command) return;
    if (!allowed(msg.author.id, msg.member)) {
      manager.createMessage(msg.channel.id, "You're not allowed to use the bot manager.").catch(console.error);
      return;
    }

    manager.createMessage(msg.channel.id, command(args)).catch(console.error);
  });

  manager.on("interactionCreate", (interaction) => {
    if (!(interaction instanceof Eris.ComponentInteraction)) return;

    const user = interaction.member || interaction.user;
    if (!allowed(user.id, interaction.member)) {
      interaction.createMessage({ content: "You're not allowed to use the bot manager.", flags: 64 }).catch(console.error);
      return;
    }

    const [action, index] = interaction.data.custom_id.split(":");
    const i = Number(index);
    const value = interaction.data.values && interaction.data.values[0];
    let view;

    // Bots can be removed from the terminal while a panel is open
    const botIndex = action === "bot" && value !== undefined ? Number(value) : i;
    if (action !== "home" && !workers[botIndex]) {
      interaction.editParent(homeView("That bot was removed.")).catch(console.error);
      return;
    }

    if (action === "home") {
      view = homeView();
    } else if (action === "bot") {
      view = botView(botIndex);
    } else if (action === "guild") {
      view = guildView(i, value);
    } else if (action === "channel") {
      const channel = workers[i].bot.getChannel(value);
      workers[i].setChannel(value);
      view = botView(i, `✅ ${botName(workers[i])} is joining **${channel ? channel.name : value}**.`);
    } else if (action === "leave") {
      workers[i].setChannel(null);
      view = botView(i, `👋 ${botName(workers[i])} left voice.`);
    } else {
      return;
    }

    interaction.editParent(view).catch(console.error);
  });

  manager.on("ready", () => {
    console.log(`[manager] Logged in as ${manager.user.username}, prefix ${prefix}`);
  });

  let failed = false;
  manager.on("error", (err) => {
    // Eris puts the token in some error messages, so never print it
    const message = String(err.message || err).split(token).join("<token>");
    if (/Invalid token|Authentication failed/.test(message)) failed = true;
    console.error(`[manager] ${message}`);
  });

  // Eris retries a bad bot token forever without saying so, so check it first
  manager.getBotGateway().then(() => manager.connect(), (err) => {
    if (err.code === 401) {
      failed = true;
      console.error("[manager] Login failed: the manager token is invalid");
    } else {
      manager.connect(); // e.g. a network hiccup, connect keeps retrying
    }
  });

  return {
    bot: manager,
    failed: () => failed,
    stop: () => manager.disconnect({ reconnect: false }),
  };
};
