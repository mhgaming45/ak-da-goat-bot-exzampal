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
  TextInputStyle
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
// QUEUES
// ========================================

const queues = {
  uhc: [],
  pot: [],
  mace: [],
  nethop: [],
  smp: [],
  sword: [],
  axe: [],
  vanilla: [],
  cart: [],
  diasmp: []
};

const testerMode = {};

// ========================================
// CLIENT
// ========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();

// Command Loader
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
      }
    } catch (err) {
      console.error(`Error loading ${file}:`, err);
    }
  }
}

client.once(Events.ClientReady, () => {
  console.log("==============================");
  console.log(`${client.user.tag} is online and fast!`);
  console.log("==============================");
});

// ========================================
// UPDATE QUEUE CHANNEL EMBEDS (BACKGROUND)
// ========================================

async function updateQueue(mode) {
  if (!queues[mode]) return;

  const channelId = config.queueChannels?.[mode];
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const list = queues[mode]
    .map((id, index) => `#${index + 1} — <@${id}>`)
    .join("\n");

  const isClosed = queues[mode].length === 0;

  const embed = new EmbedBuilder()
    .setColor(isClosed ? "#E74C3C" : "#2ECC71")
    .setTitle(`🎮 ${mode.toUpperCase()} Queue is ${isClosed ? "Closed" : "Open"}`)
    .setDescription(`**Current Waitlist:**\n` + (list || "No active queue"))
    .setFooter({
      text: `Developer - MHGAMING`
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${mode}`).setLabel("Join").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${mode}`).setLabel("Leave").setStyle(ButtonStyle.Danger)
  );

  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(
      msg => msg.author.id === client.user.id && msg.embeds.length > 0
    );

    if (botMessage) {
      await botMessage.edit({ embeds: [embed], components: [row] });
    } else {
      await channel.send({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    console.error(`Queue update error (${mode}):`, err);
  }
}

function isTester(interaction) {
  return interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
}

// ========================================
// FAST INTERACTION HANDLER
// ========================================

client.on(Events.InteractionCreate, async interaction => {
  try {
    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // 2. Instant Modal Trigger Buttons (Zero Delay)
    if (interaction.isButton() && interaction.customId === "register") {
      const modal = new ModalBuilder()
        .setCustomId("register_modal")
        .setTitle("Verify Profile");

      const ign = new TextInputBuilder()
        .setCustomId("ign")
        .setLabel("Minecraft Username")
        .setPlaceholder("Enter your username")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const region = new TextInputBuilder()
        .setCustomId("region")
        .setLabel("Region")
        .setPlaceholder("AS/AU, NA, EU")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const account = new TextInputBuilder()
        .setCustomId("account")
        .setLabel("Account Type")
        .setPlaceholder("Premium or Cracked")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(ign),
        new ActionRowBuilder().addComponents(region),
        new ActionRowBuilder().addComponents(account)
      );

      return interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId.startsWith("pass_")) {
      if (!isTester(interaction)) {
        return interaction.reply({ content: "❌ Only testers can use this.", ephemeral: true });
      }

      const userId = interaction.customId.replace("pass_", "");
      const modal = new ModalBuilder()
        .setCustomId(`tier_modal_${userId}`)
        .setTitle("Assign Tier");

      const tier = new TextInputBuilder()
        .setCustomId("tier")
        .setLabel("Enter Tier")
        .setPlaceholder("LT5, LT4, LT3, LT2, LT1, HT5, HT4, HT3, HT2, HT1")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(tier));
      return interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId.startsWith("fail_")) {
      if (!isTester(interaction)) {
        return interaction.reply({ content: "❌ Only testers can use this.", ephemeral: true });
      }

      const userId = interaction.customId.replace("fail_", "");
      const modal = new ModalBuilder()
        .setCustomId(`fail_modal_${userId}`)
        .setTitle("Fail Player");

      const reason = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Fail Reason")
        .setPlaceholder("Reason...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(reason));
      return interaction.showModal(modal);
    }

    // 3. Fast Registration Modal Submit
    if (interaction.isModalSubmit() && interaction.customId === "register_modal") {
      const db = loadDB();
      const ign = interaction.fields.getTextInputValue("ign");
      const region = interaction.fields.getTextInputValue("region");
      const account = interaction.fields.getTextInputValue("account");

      db[`user_${interaction.user.id}`] = {
        ign,
        region,
        account,
        tier: db[`user_${interaction.user.id}`]?.tier || null,
        wins: db[`user_${interaction.user.id}`]?.wins || 0,
        losses: db[`user_${interaction.user.id}`]?.losses || 0
      };

      saveDB(db);

      const embed = new EmbedBuilder()
        .setColor("#2ECC71")
        .setTitle("📌 Profile Verified")
        .setDescription("Your profile has been saved successfully.")
        .addFields(
          { name: "👤 Username", value: ign, inline: false },
          { name: "🌍 Region", value: region, inline: false },
          { name: "💳 Account", value: account, inline: false }
        )
        .setFooter({ text: "Tier Testing System" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 4. Fast Instant Gamemode Queue Buttons (Instant Direct Reply)
    const gamemodes = ["uhc", "pot", "mace", "nethop", "smp", "sword", "axe", "vanilla", "cart", "diasmp"];
    let selectedMode = null;
    let action = "join";

    if (interaction.isButton()) {
      if (gamemodes.includes(interaction.customId)) {
        selectedMode = interaction.customId;
      } else if (interaction.customId.startsWith("join_")) {
        selectedMode = interaction.customId.replace("join_", "");
      } else if (interaction.customId.startsWith("leave_")) {
        selectedMode = interaction.customId.replace("leave_", "");
        action = "leave";
      }
    }

    if (selectedMode && gamemodes.includes(selectedMode)) {
      const db = loadDB();
      const data = db[`user_${interaction.user.id}`];

      if (!data) {
        return interaction.reply({
          content: "❌ You must click **Register/Update** first before joining a queue!",
          ephemeral: true
        });
      }

      if (action === "join") {
        if (!queues[selectedMode].includes(interaction.user.id)) {
          queues[selectedMode].push(interaction.user.id);
        }

        const channelMention = config.queueChannels?.[selectedMode] 
          ? `<#${config.queueChannels[selectedMode]}>` 
          : `#${selectedMode}-queue`;

        const queueEmbed = new EmbedBuilder()
          .setColor("#2ECC71")
          .setTitle("✅ Added to Waitlist")
          .setDescription(`You joined the **${selectedMode.toUpperCase()}** queue successfully.`)
          .addFields(
            { name: "👤 Username", value: data.ign, inline: false },
            { name: "🌍 Region", value: data.region, inline: false },
            { name: "🎮 Gamemode", value: selectedMode.toUpperCase(), inline: false },
            { name: "📌 Queue Channel", value: channelMention, inline: false }
          )
          .setFooter({ text: "Tier Testing Queue System" });

        // Instantly reply to user so there is ZERO delay or thinking state!
        await interaction.reply({ embeds: [queueEmbed], ephemeral: true });

        // Update channel embed in background
        updateQueue(selectedMode).catch(() => {});
        return;
      }

      if (action === "leave") {
        queues[selectedMode] = queues[selectedMode].filter(id => id !== interaction.user.id);
        
        await interaction.reply({
          content: `✅ You have left the **${selectedMode.toUpperCase()}** queue.`,
          ephemeral: true
        });

        updateQueue(selectedMode).catch(() => {});
        return;
      }
    }

    // 5. Tier Assign Result Submits
    if (interaction.isModalSubmit() && interaction.customId.startsWith("tier_modal_")) {
      const userId = interaction.customId.replace("tier_modal_", "");
      const rankEarned = interaction.fields.getTextInputValue("tier").trim().toUpperCase();

      const db = loadDB();
      const data = db[`user_${userId}`] || {};
      const mode = testerMode[interaction.user.id];

      data.tier = rankEarned;
      db[`user_${userId}`] = data;
      saveDB(db);

      if (mode && queues[mode]) {
        queues[mode] = queues[mode].filter(id => id !== userId);
        updateQueue(mode).catch(() => {});
      }

      if (config.logChannel) {
        const logChannel = client.channels.cache.get(config.logChannel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("#2ECC71")
            .setTitle(`🏆 ${data.ign || 'Player'}'s Test Results`)
            .addFields(
              { name: "Player Name", value: `<@${userId}>`, inline: false },
              { name: "Tester Name", value: `<@${interaction.user.id}>`, inline: false },
              { name: "Rank Earned", value: rankEarned, inline: false },
              { name: "Game Mode", value: mode ? mode.toUpperCase() : "N/A", inline: false }
            )
            .setFooter({ text: "Developer – MHGAMING" })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      return interaction.reply({ content: `✅ Assigned **${rankEarned}** to <@${userId}>.`, ephemeral: true });
    }

  } catch (err) {
    console.error("Interaction error:", err);
  }
});

// Web Server Keep Alive
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running!");
}).listen(process.env.PORT || 3000);

client.login(process.env.TOKEN);
