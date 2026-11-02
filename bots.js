const Eris = require("eris");
const fs = require("fs");
const path = require("path");

// Channels picked from the manager or terminal are saved here so they survive restarts
const savedFile = path.join(__dirname, "channels.json");
let saved = {};
try {
  saved = JSON.parse(fs.readFileSync(savedFile, "utf8"));
} catch (err) {}

function saveChannel(botID, channelID) {
  saved[botID] = channelID;
  fs.writeFile(savedFile, JSON.stringify(saved, null, 2), (err) => {
    if (err) console.error("Could not save channels.json", err);
  });
}

let nextID = 1;

// Start one bot that stays online and sits in a voice channel.
// Returns a handle used by the manager bot and the terminal to control it.
function startBot({ token, channel_id }) {
  const bot = new Eris(token);
  const label = `[bot ${nextID++}]`;
  let voiceChannelID = channel_id || null;
  let stopped = false;
  let failed = false;

  // Set the bot's voice state in a guild through the gateway (op 4). This
  // shows the bot in the channel without streaming any audio.
  function sendVoiceState(guild, channelID) {
    bot.shards.get(guild.shard.id).sendWS(4, {
      guild_id: guild.id,
      channel_id: channelID,
      self_mute: false,
      self_deaf: false
    });
  }

  let attempts = 0;
  let warnedMissing = false;

  // Join the target channel unless the bot is already sitting in it. Safe to
  // call often: it's retried on reconnects, when servers finish loading and
  // every minute, so a missed join never waits for the next reconnect.
  function joinVoiceChannel() {
    if (!voiceChannelID || stopped || !bot.user) return;

    // Servers that load after Eris' "ready" aren't cached yet; they're retried
    // from guildAvailable and the check below
    const channel = bot.getChannel(voiceChannelID);
    if (!channel || !channel.guild) {
      if (!warnedMissing) console.error(`${label} Voice channel ${voiceChannelID} not found yet, will keep trying`);
      warnedMissing = true;
      return;
    }
    warnedMissing = false;

    const shard = bot.shards.get(channel.guild.shard.id);
    if (!shard || shard.status !== "ready") return;
    const state = channel.guild.voiceStates.get(bot.user.id);
    if (state && state.channelID === voiceChannelID) return;

    sendVoiceState(channel.guild, voiceChannelID);
    attempts++;
    if (attempts === 1) console.log(`${label} ${bot.user.username} joining voice channel ${channel.name}`);
    if (attempts === 3) console.error(`${label} Still not in ${channel.name}, check the bot has View Channel and Connect there`);
  }

  // Move the bot to another voice channel, or out of voice when channelID is null
  function setChannel(channelID) {
    const old = voiceChannelID && bot.getChannel(voiceChannelID);
    const next = channelID && bot.getChannel(channelID);
    voiceChannelID = channelID;
    attempts = 0;
    if (bot.user) saveChannel(bot.user.id, channelID);

    // A bot has one voice state per server, so leave the old server first
    if (old && old.guild && (!next || next.guild.id !== old.guild.id)) {
      sendVoiceState(old.guild, null);
    }
    joinVoiceChannel();
  }

  bot.on("ready", () => {
    console.log(`${label} Logged in as ${bot.user.username}`);
    if (bot.user.id in saved) voiceChannelID = saved[bot.user.id];
    joinVoiceChannel();
  });

  // Retry after reconnects and when a server with the channel finishes loading
  bot.on("shardReady", joinVoiceChannel);
  bot.on("shardResume", joinVoiceChannel);
  const onGuild = (guild) => {
    if (voiceChannelID && guild.channels.has(voiceChannelID)) joinVoiceChannel();
  };
  bot.on("guildAvailable", onGuild);
  bot.on("guildCreate", onGuild);

  // Catch anything the events above miss
  const check = setInterval(joinVoiceChannel, 60 * 1000);

  bot.on("voiceChannelJoin", (member, channel) => {
    if (member.id === bot.user.id && channel.id === voiceChannelID) {
      attempts = 0;
      console.log(`${label} ${bot.user.username} is in voice channel ${channel.name}`);
    }
  });

  // Rejoin if the bot gets disconnected or moved out of the channel
  bot.on("voiceChannelLeave", (member, oldChannel) => {
    const target = voiceChannelID && bot.getChannel(voiceChannelID);
    if (member.id === bot.user.id && target && target.guild.id === oldChannel.guild.id) {
      setTimeout(joinVoiceChannel, 5000);
    }
  });
  bot.on("voiceChannelSwitch", (member, newChannel) => {
    if (member.id !== bot.user.id || !voiceChannelID) return;
    if (newChannel.id === voiceChannelID) {
      attempts = 0;
      console.log(`${label} ${bot.user.username} is in voice channel ${newChannel.name}`);
    } else {
      setTimeout(joinVoiceChannel, 5000);
    }
  });

  bot.on("error", (err) => {
    // Eris puts the token in some error messages, so never print it
    const message = String(err.message || err).split(token).join("<token>");
    if (/Invalid token|Authentication failed/.test(message)) {
      failed = true;
      stopped = true;
      clearInterval(check);
    }
    console.error(`${label} ${message}`); // or your preferred logger
  });

  bot.connect(); // Get the bot to connect to Discord

  return {
    bot,
    label,
    getChannel: () => voiceChannelID,
    failed: () => failed,
    setChannel,
    stop() {
      stopped = true;
      clearInterval(check);
      bot.disconnect({ reconnect: false });
    },
  };
}

module.exports = startBot;
