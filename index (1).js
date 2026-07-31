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
    return JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );
  } catch {
    return {};
  }
}

function saveDB(data) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data, null, 2)
  );
}

// ========================================
// QUEUES (Multi-Queue Supported)
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
  cart: []
};

// ========================================
// TESTER SELECTED MODE
// ========================================

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

// ========================================
// LOAD COMMANDS
// ========================================

const commandsPath = path.join(
  __dirname,
  "commands"
);

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    try {
      const command = require(
        path.join(commandsPath, file)
      );

      if (
        command.data &&
        command.execute
      ) {
        client.commands.set(
          command.data.name,
          command
        );

        console.log(
          `Loaded Command: ${command.data.name}`
        );
      }
    } catch (err) {
      console.error(
        `Error loading ${file}:`,
        err
      );
    }
  }
}

// ========================================
// READY
// ========================================

client.once(
  Events.ClientReady,
  () => {
    console.log(
      "=============================="
    );
    console.log(
      `${client.user.tag} is online!`
    );
    console.log(
      "AK Tier Testing Bot Ready"
    );
    console.log(
      "=============================="
    );
  }
);

// ========================================
// UPDATE QUEUE CHANNEL
// ========================================

async function updateQueue(mode) {
  if (!queues[mode]) return;

  const channelId =
    config.queueChannels?.[mode];

  if (!channelId) return;

  const channel =
    client.channels.cache.get(channelId);

  if (!channel) return;

  const list = queues[mode]
    .map(
      (id, index) =>
        `${index + 1}. <@${id}>`
    )
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor("#3498DB")
    .setTitle(
      `🎮 ${mode.toUpperCase()} Queue`
    )
    .setDescription(
      list ||
      "No players currently waiting."
    )
    .setFooter({
      text:
        `Players Waiting: ${queues[mode].length} • AK Tier Testing`
    });

  try {
    const messages =
      await channel.messages.fetch({
        limit: 50
      });

    const botMessage =
      messages.find(
        message =>
          message.author.id ===
          client.user.id &&
          message.embeds.length > 0
      );

    if (botMessage) {
      await botMessage.edit({
        embeds: [embed]
      });
    } else {
      await channel.send({
        embeds: [embed]
      });
    }
  } catch (err) {
    console.error(
      `Queue update error (${mode}):`,
      err
    );
  }
}

// ========================================
// UPDATE ALL QUEUES
// ========================================

async function updateAllQueues() {
  for (
    const mode of Object.keys(queues)
  ) {
    await updateQueue(mode);
  }
}

// ========================================
// TESTER CHECK
// ========================================

function isTester(interaction) {
  return interaction.member?.permissions?.has(
    PermissionsBitField.Flags.ManageGuild
  );
}

// ========================================
// INTERACTION CREATE
// ========================================

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {
      // ====================================
      // SLASH COMMANDS
      // ====================================

      if (
        interaction.isChatInputCommand()
      ) {
        const command =
          client.commands.get(
            interaction.commandName
          );

        if (!command) return;

        await command.execute(
          interaction
        );

        return;
      }

      // ====================================
      // MODAL OPENS (MUST NOT DEFER)
      // ====================================

      if (
        interaction.isButton() &&
        interaction.customId === "register"
      ) {
        const db = loadDB();
        if (db[`user_${interaction.user.id}`]) {
          return interaction.reply({
            content: "✅ **You are already registered!** There is no need to register again. You can click any gamemode button to join a queue directly.",
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("register_modal")
          .setTitle("Player Registration");

        const ign = new TextInputBuilder()
          .setCustomId("ign")
          .setLabel("Minecraft Username")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32);

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

      if (
        interaction.isButton() &&
        interaction.customId.startsWith("pass_")
      ) {
        if (!isTester(interaction)) {
          return interaction.reply({
            content: "❌ Only testers can use this button.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.replace("pass_", "");
        const modal = new ModalBuilder()
          .setCustomId(`tier_modal_${userId}`)
          .setTitle("Assign Tier");

        const tier = new TextInputBuilder()
          .setCustomId("tier")
          .setLabel("Enter Tier")
          .setPlaceholder("LT5 / LT4 / LT3 / LT2 / LT1 / HT5 / HT4 / HT3 / HT2 / HT1")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3);

        modal.addComponents(
          new ActionRowBuilder().addComponents(tier)
        );

        return interaction.showModal(modal);
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith("fail_")
      ) {
        if (!isTester(interaction)) {
          return interaction.reply({
            content: "❌ Only testers can use this button.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.replace("fail_", "");
        const modal = new ModalBuilder()
          .setCustomId(`fail_modal_${userId}`)
          .setTitle("Fail Player");

        const reason = new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Fail Reason")
          .setPlaceholder("Enter the reason...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(
          new ActionRowBuilder().addComponents(reason)
        );

        return interaction.showModal(modal);
      }

      // ====================================
      // ALL OTHER BUTTONS & MODAL SUBMITS (SAFE TO DEFER)
      // ====================================

      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      // REGISTER MODAL SUBMIT
      if (
        interaction.isModalSubmit() &&
        interaction.customId === "register_modal"
      ) {
        const db = loadDB();
        const oldData = db[`user_${interaction.user.id}`] || {};

        db[`user_${interaction.user.id}`] = {
          ign: interaction.fields.getTextInputValue("ign"),
          region: interaction.fields.getTextInputValue("region"),
          account: interaction.fields.getTextInputValue("account"),
          tier: oldData.tier || null,
          wins: oldData.wins || 0,
          losses: oldData.losses || 0
        };

        saveDB(db);

        if (config.queueRole) {
          await interaction.member.roles.add(config.queueRole).catch(() => {});
        }

        return interaction.editReply({
          content: "✅ **Registration Successful!**\nYou are now permanently registered. You can click on any gamemode button to join a queue."
        });
      }

      // GAMEMODE BUTTONS (Direct Access & Multi Queue Supported)
      const gamemodes = ["uhc", "pot", "mace", "nethop", "smp", "sword", "axe", "vanilla", "cart"];
      if (interaction.isButton() && gamemodes.includes(interaction.customId)) {
        const mode = interaction.customId;
        const db = loadDB();
        const data = db[`user_${interaction.user.id}`];

        if (!data) {
          return interaction.editReply({
            content: "❌ **You are not registered yet!**\nPlease click the **Register** button first to submit your details."
          });
        }

        // Check if already in this specific queue
        if (queues[mode].includes(interaction.user.id)) {
          const position = queues[mode].indexOf(interaction.user.id) + 1;
          return interaction.editReply({
            content: `❌ You are already in the **${mode.toUpperCase()}** Queue.\n📍 Position: **#${position}**`
          });
        }

        // Add user to this queue
        queues[mode].push(interaction.user.id);
        const position = queues[mode].length;

        if (config.roles && config.roles[mode]) {
          await interaction.member.roles.add(config.roles[mode]).catch(() => {});
        }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#2ECC71")
              .setTitle("✅ Queue Joined")
              .setDescription(
                `🎮 **Gamemode:** ${mode.toUpperCase()}\n📍 **Position:** #${position}\n👥 **Players Ahead:** ${position - 1}\n\nPlease wait for a tester!`
              )
          ]
        });

        await updateQueue(mode);
        return;
      }

      // LEAVE QUEUE BUTTON
      if (interaction.isButton() && interaction.customId === "leave_queue") {
        let leftModes = [];

        for (const mode of Object.keys(queues)) {
          if (queues[mode].includes(interaction.user.id)) {
            queues[mode] = queues[mode].filter(id => id !== interaction.user.id);
            leftModes.push(mode.toUpperCase());
            if (config.roles && config.roles[mode]) {
              await interaction.member.roles.remove(config.roles[mode]).catch(() => {});
            }
            await updateQueue(mode);
          }
        }

        if (leftModes.length === 0) {
          return interaction.editReply({
            content: "❌ You are not in any queue."
          });
        }

        return interaction.editReply({
          content: `✅ You have left the following queues: **${leftModes.join(", ")}**`
        });
      }

      // TESTER GAMEMODE SELECT
      if (interaction.isStringSelectMenu() && interaction.customId === "select_test_mode") {
        if (!isTester(interaction)) {
          return interaction.editReply({
            content: "❌ Only testers can use this panel."
          });
        }

        const mode = interaction.values[0];
        testerMode[interaction.user.id] = mode;

        return interaction.editReply({
          content: `✅ Selected **${mode.toUpperCase()}**.\n\nNow press **🎯 Next Player**.`
        });
      }

      // NEXT PLAYER
      if (interaction.isButton() && interaction.customId === "next_player") {
        if (!isTester(interaction)) {
          return interaction.editReply({
            content: "❌ Only testers can use this button."
          });
        }

        const mode = testerMode[interaction.user.id];
        if (!mode) {
          return interaction.editReply({
            content: "❌ Please select a gamemode first."
          });
        }

        if (!queues[mode] || queues[mode].length === 0) {
          return interaction.editReply({
            content: `❌ The **${mode.toUpperCase()}** queue is empty.`
          });
        }

        const userId = queues[mode][0];
        const db = loadDB();
        const data = db[`user_${userId}`];

        if (!data) {
          queues[mode].shift();
          await updateQueue(mode);
          return interaction.editReply({
            content: "❌ Player data not found. Player removed from queue."
          });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`pass_${userId}`).setLabel("PASS").setEmoji("✅").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`fail_${userId}`).setLabel("FAIL").setEmoji("❌").setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setColor("#F1C40F")
          .setTitle("🎯 Current Test")
          .setDescription(
            `👤 **Player:** <@${userId}>\n\n🎮 **IGN:** ${data.ign}\n🌍 **Region:** ${data.region}\n💳 **Account:** ${data.account || "Not specified"}\n⚔️ **Gamemode:** ${mode.toUpperCase()}\n\n🏆 **Wins:** ${data.wins || 0}\n❌ **Losses:** ${data.losses || 0}`
          );

        return interaction.editReply({
          embeds: [embed],
          components: [row]
        });
      }

      // TIER MODAL SUBMIT (PASS)
      if (interaction.isModalSubmit() && interaction.customId.startsWith("tier_modal_")) {
        if (!isTester(interaction)) {
          return interaction.editReply({
            content: "❌ Only testers can assign tiers."
          });
        }

        const userId = interaction.customId.replace("tier_modal_", "");
        const rankEarned = interaction.fields.getTextInputValue("tier").trim().toUpperCase();

        if (!config.tierRoles || !config.tierRoles[rankEarned]) {
          return interaction.editReply({
            content: "❌ Invalid Tier.\n\nValid tiers: **LT5, LT4, LT3, LT2, LT1, HT5, HT4, HT3, HT2, HT1**"
          });
        }

        const db = loadDB();
        const data = db[`user_${userId}`];

        if (!data) {
          return interaction.editReply({ content: "❌ Player data not found." });
        }

        const mode = testerMode[interaction.user.id];
        const rankBefore = data.tier || "None";

        if (config.tierRoles) {
          for (const roleId of Object.values(config.tierRoles)) {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) await member.roles.remove(roleId).catch(() => {});
          }
        }

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && config.tierRoles[rankEarned]) {
          await member.roles.add(config.tierRoles[rankEarned]).catch(() => {});
        }

        // Remove from this specific mode queue
        if (mode && queues[mode]) {
          queues[mode] = queues[mode].filter(id => id !== userId);
          await updateQueue(mode);
        }

        data.tier = rankEarned;
        data.wins = (data.wins || 0) + 1;
        db[`user_${userId}`] = data;
        saveDB(db);

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#2ECC71")
                .setTitle("🎉 Test Passed!")
                .setDescription(
                  `Congratulations!\n\n🏆 **Tier:** ${rankEarned}\n🎮 **Gamemode:** ${mode ? mode.toUpperCase() : 'UNKNOWN'}\n\nYour tier has been assigned.`
                )
            ]
          }).catch(() => {});
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
                { name: "Rank Before", value: `${rankBefore}`, inline: false },
                { name: "Rank Earned", value: `${rankEarned}`, inline: false },
                { name: "Game Mode", value: `${mode ? mode.toUpperCase() : 'N/A'}`, inline: false },
                { name: "Region", value: `${data.region || 'Not provided'}`, inline: false },
                { name: "Account", value: `${data.account || 'Not provided'}`, inline: false },
                { name: "Notes", value: "No notes provided.", inline: false }
              )
              .setFooter({ text: "Developer – MHGAMING" })
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        return interaction.editReply({
          content: `✅ **${data.ign}** passed!\n\n🏆 Tier Assigned: **${rankEarned}**`
        });
      }

      // FAIL MODAL SUBMIT
      if (interaction.isModalSubmit() && interaction.customId.startsWith("fail_modal_")) {
        if (!isTester(interaction)) {
          return interaction.editReply({
            content: "❌ Only testers can use this button."
          });
        }

        const userId = interaction.customId.replace("fail_modal_", "");
        const reason = interaction.fields.getTextInputValue("reason");

        const db = loadDB();
        const data = db[`user_${userId}`];

        if (!data) {
          return interaction.editReply({ content: "❌ Player data not found." });
        }

        const mode = testerMode[interaction.user.id];
        const rankBefore = data.tier || "None";

        if (mode && queues[mode]) {
          queues[mode] = queues[mode].filter(id => id !== userId);
          await updateQueue(mode);
        }

        data.losses = (data.losses || 0) + 1;
        db[`user_${userId}`] = data;
        saveDB(db);

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#E74C3C")
                .setTitle("❌ Test Failed")
                .setDescription(
                  `Unfortunately, you did not pass this test.\n\n🎮 **Gamemode:** ${mode ? mode.toUpperCase() : 'UNKNOWN'}\n📝 **Reason:** ${reason}`
                )
            ]
          }).catch(() => {});
        }

        if (config.logChannel) {
          const logChannel = client.channels.cache.get(config.logChannel);
          if (logChannel) {
            const failLogEmbed = new EmbedBuilder()
              .setColor("#E74C3C")
              .setTitle(`❌ ${data.ign || 'Player'}'s Test Results`)
              .addFields(
                { name: "Player Name", value: `<@${userId}>`, inline: false },
                { name: "Tester Name", value: `<@${interaction.user.id}>`, inline: false },
                { name: "Rank Before", value: `${rankBefore}`, inline: false },
                { name: "Rank Earned", value: "FAILED", inline: false },
                { name: "Game Mode", value: `${mode ? mode.toUpperCase() : 'N/A'}`, inline: false },
                { name: "Region", value: `${data.region || 'Not provided'}`, inline: false },
                { name: "Account", value: `${data.account || 'Not provided'}`, inline: false },
                { name: "Notes", value: `${reason}`, inline: false }
              )
              .setFooter({ text: "Developer – MHGAMING" })
              .setTimestamp();

            await logChannel.send({ embeds: [failLogEmbed] }).catch(() => {});
          }
        }

        return interaction.editReply({
          content: `❌ **${data.ign}** has been marked as **FAIL**.\n\n📝 Reason: **${reason}**`
        });
      }

    } catch (error) {
      console.error(
        "Interaction Error:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content: "❌ Something went wrong. Check the bot console.",
          ephemeral: true
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: "❌ Something went wrong while processing your request."
        }).catch(() => {});
      }
    }
  }
);

// ========================================
// AUTO QUEUE REFRESH
// ========================================

setInterval(
  async () => {
    try {
      await updateAllQueues();
    } catch (error) {
      console.error(
        "Queue refresh error:",
        error
      );
    }
  },
  30000
);

// ========================================
// KEEP ALIVE
// ========================================

http
  .createServer(
    (req, res) => {
      res.writeHead(
        200,
        {
          "Content-Type":
            "text/plain"
        }
      );

      res.end(
        "AK Tier Testing Bot is running!"
      );
    }
  )
  .listen(
    process.env.PORT || 3000,
    () => {
      console.log(
        "Web server started."
      );
    }
  );

// ========================================
// ERROR HANDLING
// ========================================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

// ========================================
// LOGIN
// ========================================

client.login(
  process.env.TOKEN
);
