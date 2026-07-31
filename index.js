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

// DATABASE
const DB_FILE = "./database.json";
function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { return {}; }
}
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// QUEUES
const queues = {
  uhc: [], pot: [], mace: [], nethop: [], smp: [],
  sword: [], axe: [], vanilla: [], cart: [], diasmp: []
};
const testerMode = {};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
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
    } catch (err) { console.error(`Error loading ${file}:`, err); }
  }
}

client.once(Events.ClientReady, () => {
  console.log(`✅ ${client.user.tag} is online and ready!`);
});

// BACKGROUND QUEUE UPDATER
async function updateQueue(mode) {
  if (!queues[mode]) return;
  const channelId = config.queueChannels?.[mode];
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const list = queues[mode].map((id, index) => `#${index + 1} — <@${id}>`).join("\n");
  const isClosed = queues[mode].length === 0;

  const embed = new EmbedBuilder()
    .setColor(isClosed ? "#E74C3C" : "#2ECC71")
    .setTitle(`🎮 ${mode.toUpperCase()} Queue is ${isClosed ? "Closed" : "Open"}`)
    .setDescription(`**Current Waitlist:**\n` + (list || "No active queue"))
    .setFooter({ text: "Developer - MHGAMING" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${mode}`).setLabel("Join").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${mode}`).setLabel("Leave").setStyle(ButtonStyle.Danger)
  );

  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessage = messages.find(msg => msg.author.id === client.user.id && msg.embeds.length > 0);
    if (botMessage) await botMessage.edit({ embeds: [embed], components: [row] });
    else await channel.send({ embeds: [embed], components: [row] });
  } catch (err) { console.error(`Queue update error (${mode}):`, err); }
}

function isTester(interaction) {
  return interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
}

// FAST INTERACTION HANDLER
client.on(Events.InteractionCreate, async interaction => {
  try {
    // 1. Commands Execution
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // 2. Registration Modal (Instant Response)
    if (interaction.isButton() && interaction.customId === "register") {
      const modal = new ModalBuilder().setCustomId("register_modal").setTitle("Verify Profile");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ign").setLabel("Minecraft Username").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("region").setLabel("Region").setPlaceholder("AS/AU, NA, EU").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("account").setLabel("Account Type").setPlaceholder("Premium or Cracked").setStyle(TextInputStyle.Short).setRequired(true))
      );
      return interaction.showModal(modal);
    }

    // 3. Save Profile Modal
    if (interaction.isModalSubmit() && interaction.customId === "register_modal") {
      const db = loadDB();
      const ign = interaction.fields.getTextInputValue("ign");
      const region = interaction.fields.getTextInputValue("region");
      const account = interaction.fields.getTextInputValue("account");

      db[`user_${interaction.user.id}`] = { ign, region, account };
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

    // 4. Gamemode Buttons (Instant Queue Logic - NO THINKING LAG)
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

        // Direct instant reply (0 delay)
        await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
        updateQueue(selectedMode).catch(() => {});
        return;
      }

      if (action === "leave") {
        queues[selectedMode] = queues[selectedMode].filter(id => id !== interaction.user.id);
        await interaction.reply({ content: `✅ You have left the **${selectedMode.toUpperCase()}** queue.`, ephemeral: true });
        updateQueue(selectedMode).catch(() => {});
        return;
      }
    }

  } catch (err) {
    console.error("Interaction error:", err);
  }
});

http.createServer((req, res) => { res.writeHead(200); res.end("Bot is running!"); }).listen(process.env.PORT || 3000);
client.login(process.env.TOKEN);
