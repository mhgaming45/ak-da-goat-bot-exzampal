require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");

const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require("discord.js");

const config = require("./config/config.json");

// ========================================
// DATABASE
// ========================================

const DB_FILE = "./database.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ========================================
// QUEUE CHANNELS & LIVE QUEUES
// ========================================

const queueChannels = config.queueChannels || {};

const queues = {
  sword: [],
  axe: [],
  crystal: [],
  mace: [],
  uhc: [],
  smp: [],
  nethop: [],
  pot: [],
  cart: [],
  vanilla: []
};
const testerMode = global.testerMode || (global.testerMode = {});

// ========================================
// CLIENT SETUP
// ========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

// ========================================
// LOAD COMMANDS
// ========================================

const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded Command: ${command.data.name}`);
    }
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

async function updateQueue(mode) {
  const channelId = queueChannels[mode];
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const list = (queues[mode] || [])
    .map((id, index) => `${index + 1}. <@${id}>`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("Blue")
    .setTitle(`${mode.toUpperCase()} Queue`)
    .setDescription(list || "No players in queue.")
    .setFooter({
      text: `Players Waiting: ${queues[mode] ? queues[mode].length : 0}`
    });

  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(m => m.author.id === client.user.id);

    if (botMessage) {
      await botMessage.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`Failed to update queue channel for ${mode}:`, err);
  }
}

async function refreshAllQueues() {
  for (const mode of Object.keys(queues)) {
    await updateQueue(mode);
  }
}

async function sendTestLog({ tester, playerId, result, tier = null, mode = null }) {
  if (!config.logChannel) return;

  const channel = client.channels.cache.get(config.logChannel);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(result === "PASS" ? "Green" : "Red")
    .setTitle("🧪 Tier Testing Log")
    .addFields(
      { name: "👤 Player", value: `<@${playerId}>`, inline: true },
      { name: "🧪 Tester", value: `<@${tester.id}>`, inline: true },
      { name: "🎮 Gamemode", value: mode ? mode.toUpperCase() : "Unknown", inline: true },
      { name: "📊 Result", value: result === "PASS" ? "✅ PASS" : "❌ FAIL", inline: true }
    )
    .setTimestamp()
    .setFooter({ text: "MHGAMING • Tier Testing" });

  if (tier) {
    embed.addFields({ name: "🏆 Tier", value: `**${tier}**`, inline: true });
  }

  await channel.send({ embeds: [embed] }).catch(console.error);
}

// ========================================
// READY EVENT
// ========================================

client.once(Events.ClientReady, () => {
  console.log("==============================");
  console.log(`${client.user.tag} is online!`);
  console.log("AK Tier Testing Bot Ready");
  console.log("==============================");
});

// Auto refresh queue messages every 30 seconds
setInterval(async () => {
  try {
    await refreshAllQueues();
  } catch (err) {
    console.error("Auto Refresh Error:", err);
  }
}, 30000);

// ========================================
// INTERACTION HANDLER
// ========================================

client.on("interactionCreate", async (interaction) => {
  try {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // 2. Select Test Mode
    if (interaction.isStringSelectMenu() && interaction.customId === "select_test_mode") {
      testerMode[interaction.user.id] = interaction.values[0];
      return interaction.reply({
        content: `✅ Selected **${interaction.values[0].toUpperCase()}**.\nNow use **/nextplayer**.`,
        ephemeral: true
      });
    }

    // 3. Register Button
    if (interaction.isButton() && interaction.customId === "register") {
      const modal = new ModalBuilder()
        .setCustomId("register_modal")
        .setTitle("Player Registration");

      const ign = new TextInputBuilder()
        .setCustomId("ign")
        .setLabel("Minecraft Username")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const region = new TextInputBuilder()
        .setCustomId("region")
        .setLabel("Region")
        .setPlaceholder("AS / EU / NA")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const account = new TextInputBuilder()
        .setCustomId("account")
        .setLabel("Account Type")
        .setPlaceholder("Premium / Cracked")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(ign),
        new ActionRowBuilder().addComponents(region),
        new ActionRowBuilder().addComponents(account)
      );

      return interaction.showModal(modal);
    }

    // 4. Register Modal Submit
    if (interaction.isModalSubmit() && interaction.customId === "register_modal") {
      const db = loadDB();
      db[`user_${interaction.user.id}`] = {
        ign: interaction.fields.getTextInputValue("ign"),
        region: interaction.fields.getTextInputValue("region"),
        account: interaction.fields.getTextInputValue("account"),
        gamemode: null,
        tier: null,
        wins: 0,
        losses: 0
      };
      saveDB(db);

      if (config.queueRole) {
        await interaction.member.roles.add(config.queueRole).catch(() => {});
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("uhc").setLabel("UHC").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("pot").setLabel("Diamond Pot").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("mace").setLabel("Mace").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("nethop").setLabel("Netherite Pot").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("smp").setLabel("SMP").setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("sword").setLabel("Sword").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("axe").setLabel("Axe").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("vanilla").setLabel("Vanilla").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("cart").setLabel("Cart").setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "✅ Registration Complete!\n\n🎮 Select your gamemode below.",
        components: [row1, row2],
        ephemeral: true
      });
    }

    // 5. Gamemode Select Buttons
    const gamemodes = ["uhc", "pot", "mace", "nethop", "smp", "sword", "axe", "vanilla", "cart"];
    if (interaction.isButton() && gamemodes.includes(interaction.customId)) {
      const db = loadDB();
      const data = db[`user_${interaction.user.id}`];

      if (!data) {
        return interaction.reply({ content: "❌ Please register first.", ephemeral: true });
      }

      const mode = interaction.customId;

      for (const queue of Object.values(queues)) {
        if (queue.includes(interaction.user.id)) {
          return interaction.reply({ content: "❌ You are already in a queue.", ephemeral: true });
        }
      }

      data.gamemode = mode;
      db[`user_${interaction.user.id}`] = data;
      saveDB(db);

      queues[mode].push(interaction.user.id);
      const position = queues[mode].length;
      const playersAhead = position - 1;

      if (config.roles && config.roles[mode]) {
        for (const roleId of Object.values(config.roles)) {
          await interaction.member.roles.remove(roleId).catch(() => {});
        }
        await interaction.member.roles.add(config.roles[mode]).catch(() => {});
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ Joined Queue")
            .setDescription(
              `🎮 Gamemode: **${mode.toUpperCase()}**\n\n` +
              `📍 Position: **#${position}**\n` +
              `👥 Players Ahead: **${playersAhead}**`
            )
        ],
        ephemeral: true
      });

      await updateQueue(mode);
      return;
    }

    // 6. Leave Queue Button
    if (interaction.isButton() && interaction.customId === "leave_queue") {
      let found = false;
      let mode = null;

      for (const gamemode of Object.keys(queues)) {
        const index = queues[gamemode].indexOf(interaction.user.id);
        if (index !== -1) {
          queues[gamemode].splice(index, 1);
          found = true;
          mode = gamemode;
          break;
        }
      }

      if (!found) {
        return interaction.reply({ content: "❌ You are not in any queue.", ephemeral: true });
      }

      if (config.roles) {
        for (const roleId of Object.values(config.roles)) {
          await interaction.member.roles.remove(roleId).catch(() => {});
        }
      }

      const db = loadDB();
      if (db[`user_${interaction.user.id}`]) {
        db[`user_${interaction.user.id}`].gamemode = null;
        saveDB(db);
      }

      await interaction.reply({
        content: `✅ You left the **${mode.toUpperCase()}** queue.`,
        ephemeral: true
      });

      await updateQueue(mode);
      return;
    }

    // 7. Next Player Button
    if (interaction.isButton() && interaction.customId === "next_player") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Only testers can use this button.", ephemeral: true });
      }

      const mode = testerMode[interaction.user.id];
      if (!mode) {
        return interaction.reply({ content: "❌ Please select a gamemode first.", ephemeral: true });
      }

      if (!queues[mode] || queues[mode].length === 0) {
        return interaction.reply({ content: `❌ ${mode.toUpperCase()} queue is empty.`, ephemeral: true });
      }

      const userId = queues[mode][0];
      const db = loadDB();
      const data = db[`user_${userId}`];

      if (!data) {
        queues[mode].shift();
        return interaction.reply({ content: "❌ Player data not found.", ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pass_${userId}`).setLabel("✅ PASS").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`fail_${userId}`).setLabel("❌ FAIL").setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("🎯 Current Player")
        .setDescription(
          `👤 Player: <@${userId}>\n\n` +
          `🎮 IGN: **${data.ign}**\n` +
          `🌍 Region: **${data.region}**\n` +
          `⚔️ Gamemode: **${mode.toUpperCase()}**\n` +
          `🏆 Wins: **${data.wins || 0}**\n` +
          `❌ Losses: **${data.losses || 0}**`
        );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // 8. Pass / Fail Handling
    if (interaction.isButton() && (interaction.customId.startsWith("pass_") || interaction.customId.startsWith("fail_"))) {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Only testers can use this button.", ephemeral: true });
      }

      const isPass = interaction.customId.startsWith("pass_");
      const userId = interaction.customId.replace(isPass ? "pass_" : "fail_", "");
      const db = loadDB();
      const data = db[`user_${userId}`];

      if (!data) {
        return interaction.reply({ content: "❌ Player data not found.", ephemeral: true });
      }

      const mode = data.gamemode;

      if (isPass) {
        data.wins = (data.wins || 0) + 1;
      } else {
        data.losses = (data.losses || 0) + 1;
      }

      if (mode && queues[mode]) {
        const index = queues[mode].indexOf(userId);
        if (index !== -1) {
          queues[mode].splice(index, 1);
        }
      }

      const player = await interaction.guild.members.fetch(userId).catch(() => null);
      if (player && config.roles) {
        for (const roleId of Object.values(config.roles)) {
          await player.roles.remove(roleId).catch(() => {});
        }
      }

      data.lastTestMode = mode;
      data.gamemode = null;
      db[`user_${userId}`] = data;
      saveDB(db);

      if (mode) await updateQueue(mode);

      if (!isPass) {
        await sendTestLog({
          tester: interaction.user,
          playerId: userId,
          result: "FAIL",
          mode: mode
        });

        return interaction.reply({
          content: `❌ **TEST FAILED!**\n\n👤 Player: <@${userId}>\n🎮 Gamemode: **${mode ? mode.toUpperCase() : "UNKNOWN"}**\n📊 Losses: **${data.losses}**`,
          ephemeral: true
        });
      }

      const tierRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tier_${userId}`).setLabel("🏆 Set Tier").setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content: `✅ **TEST PASSED!**\n\n👤 Player: <@${userId}>\n🎮 Gamemode: **${mode ? mode.toUpperCase() : "UNKNOWN"}**\n📊 Wins: **${data.wins}**\n\n🏆 Click **Set Tier** to assign the player's tier.`,
        components: [tierRow],
        ephemeral: true
      });
    }

    // 9. Set Tier Button Trigger
    if (interaction.isButton() && interaction.customId.startsWith("tier_")) {
      const userId = interaction.customId.replace("tier_", "");
      const modal = new ModalBuilder()
        .setCustomId(`tier_modal_${userId}`)
        .setTitle("Set Player Tier");

      const tierInput = new TextInputBuilder()
        .setCustomId("tier")
        .setLabel("Enter Tier")
        .setPlaceholder("LT5 / LT4 / LT3 / LT2 / LT1 / HT1 / HT2 / HT3 / HT4 / HT5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(tierInput));
      return interaction.showModal(modal);
    }

    // 10. Tier Modal Submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith("tier_modal_")) {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "❌ Only testers can set tiers.", ephemeral: true });
      }

      const userId = interaction.customId.replace("tier_modal_", "");
      const tier = interaction.fields.getTextInputValue("tier").trim().toUpperCase();

      const validTiers = ["LT5", "LT4", "LT3", "LT2", "LT1", "HT1", "HT2", "HT3", "HT4", "HT5"];
      if (!validTiers.includes(tier)) {
        return interaction.reply({
          content: "❌ Invalid tier!\n\nValid tiers:\n**LT5, LT4, LT3, LT2, LT1, HT1, HT2, HT3, HT4, HT5**",
          ephemeral: true
        });
      }

      const db = loadDB();
      const data = db[`user_${userId}`];

      if (!data) {
        return interaction.reply({ content: "❌ Player data not found.", ephemeral: true });
      }

      data.tier = tier;
      db[`user_${userId}`] = data;
      saveDB(db);

      const tierRoles = {
        LT5: "1532653229723091105",
        LT4: "1532653270227747006",
        LT3: "1532653314653556826",
        LT2: "1532653346819674143",
        LT1: "1532653387177267210",
        HT1: "1532653494589460540",
        HT2: "1532653538289913877",
        HT3: "1532653584963866645",
        HT4: "1532653641171861606",
        HT5: "1532653725871509584"
      };

      const player = await interaction.guild.members.fetch(userId).catch(() => null);
      if (player) {
        for (const roleId of Object.values(tierRoles)) {
          await player.roles.remove(roleId).catch(() => {});
        }
        if (tierRoles[tier]) {
          await player.roles.add(tierRoles[tier]).catch(() => {});
        }
      }

      await sendTestLog({
        tester: interaction.user,
        playerId: userId,
        result: "PASS",
        tier: tier,
        mode: data.lastTestMode || null
      });

      return interaction.reply({
        content: `🏆 **Tier Updated!**\n\n👤 Player: <@${userId}>\n🏆 Tier: **${tier}**`,
        ephemeral: true
      });
    }
  } catch (err) {
    console.error("Global Interaction Error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }).catch(() => {});
    }
  }
});

// ========================================
// SERVER KEEP-ALIVE & LOGINS
// ========================================

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!");
}).listen(process.env.PORT || 3000, () => {
  console.log("Web server started.");
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(process.env.TOKEN);
