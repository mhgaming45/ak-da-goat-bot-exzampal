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
          gamemode: oldData.gamemode || null,
          tier: oldData.tier || null,
          wins: oldData.wins || 0,
          losses: oldData.losses || 0
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

        return interaction.editReply({
          content: "✅ **Registration Complete!**\n\n🎮 Select your gamemode:",
          components: [row1, row2]
        });
      }

      // GAMEMODE BUTTONS
      const gamemodes = ["uhc", "pot", "mace", "nethop", "smp", "sword", "axe", "vanilla", "cart"];
      if (interaction.isButton() && gamemodes.includes(interaction.customId)) {
        const mode = interaction.customId;
        const db = loadDB();
        const data = db[`user_${interaction.user.id}`];

        if (!data) {
          return interaction.editReply({
            content: "❌ Please register first using the Register button."
          });
        }

        let currentMode = null;
        for (const queueMode of Object.keys(queues)) {
          if (queues[queueMode].includes(interaction.user.id)) {
            currentMode = queueMode;
            break;
          }
        }

        if (currentMode) {
          const position = queues[currentMode].indexOf(interaction.user.id) + 1;
          return interaction.editReply({
            content: `❌ You are already in the **${currentMode.toUpperCase()}** queue.\n\n📍 Position: **#${position}**\n\nUse **Leave Queue** first if you want to change gamemode.`
          });
        }

        data.gamemode = mode;
        db[`user_${interaction.user.id}`] = data;
        saveDB(db);

        queues[mode].push(interaction.user.id);
        const position = queues[mode].length;

        if (config.roles) {
          for (const roleId of Object.values(config.roles)) {
            await interaction.member.roles.remove(roleId).catch(() => {});
          }
          if (config.roles[mode]) {
            await interaction.member.roles.add(config.roles[mode]).catch(() => {});
          }
        }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#2ECC71")
              .setTitle("✅ Joined Queue")
              .setDescription(
                `🎮 **Gamemode:** ${mode.toUpperCase()}\n\n📍 **Position:** #${position}\n👥 **Players Ahead:** ${position - 1}\n\nPlease wait for a tester.`
              )
          ]
        });

        await updateQueue(mode);
        return;
      }

      // JOIN QUEUE BUTTON
      if (interaction.isButton() && interaction.customId === "join_queue") {
        return interaction.editReply({
          content: "🎮 Select your gamemode from the **Register Panel** to join a queue."
        });
      }

      // LEAVE QUEUE
      if (interaction.isButton() && interaction.customId === "leave_queue") {
        let foundMode = null;
        for (const mode of Object.keys(queues)) {
          if (queues[mode].includes(interaction.user.id)) {
            foundMode = mode;
            break;
          }
        }

        if (!foundMode) {
          return interaction.editReply({
            content: "❌ You are not currently in a queue."
          });
        }

        queues[foundMode] = queues[foundMode].filter(id => id !== interaction.user.id);

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

        await interaction.editReply({
          content: `✅ You left the **${foundMode.toUpperCase()}** queue.`
        });

        await updateQueue(foundMode);
        return;
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

      // TIER MODAL SUBMIT
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

        const mode = data.gamemode;
        if (!mode || !queues[mode]) {
          return interaction.editReply({ content: "❌ Player gamemode not found." });
        }

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
          return interaction.editReply({ content: "❌ Player is no longer in the server." });
        }

        if (config.tierRoles) {
          for (const roleId of Object.values(config.tierRoles)) {
            await member.roles.remove(roleId).catch(() => {});
          }
        }

        await member.roles.add(config.tierRoles[rankEarned]).catch(() => {});
        queues[mode] = queues[mode].filter(id => id !== userId);

        data.tier = rankEarned;
        data.wins = (data.wins || 0) + 1;
        db[`user_${userId}`] = data;
        saveDB(db);

        await updateQueue(mode);

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#2ECC71")
                .setTitle("🎉 Test Passed!")
                .setDescription(
                  `Congratulations!\n\n🏆 **Tier:** ${rankEarned}\n🎮 **Gamemode:** ${mode.toUpperCase()}\n\nYour tier has been assigned.`
                )
            ]
          }).catch(() => {});
        }

        if (config.logChannel) {
          const logChannel = client.channels.cache.get(config.logChannel);
          if (logChannel) {
            await logChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor("#2ECC71")
                  .setTitle("✅ Player Passed")
                  .setDescription(
                    `👤 **Player:** <@${userId}>\n🎮 **Gamemode:** ${mode.toUpperCase()}\n🏆 **Tier:** ${rankEarned}\n🧪 **Tester:** <@${interaction.user.id}>`
                  )
              ]
            }).catch(() => {});
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

        const mode = data.gamemode;
        if (!mode || !queues[mode]) {
          return interaction.editReply({ content: "❌ Player gamemode not found." });
        }

        queues[mode] = queues[mode].filteer(id => id !== userId);
        data.losses = (data.losses || 0) + 1;
        db[`user_${userId}`] = data;
        saveDB(db);

        await updateQueue(mode);

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#E74C3C")
                .setTitle("❌ Test Failed")
                .setDescription(
                  `Unfortunately, you did not pass this test.\n\n🎮 **Gamemode:** ${mode.toUpperCase()}\n📝 **Reason:** ${reason}`
                )
            ]
          }).catch(() => {});
        }

        if (config.logChannel) {
          const logChannel = client.channels.cache.get(config.logChannel);
          if (logChannel) {
            await logChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor("#E74C3C")
                  .setTitle("❌ Player Failed")
                  .setDescription(
                    `👤 **Player:** <@${userId}>\n🎮 **Gamemode:** ${mode.toUpperCase()}\n📝 **Reason:** ${reason}\n🧪 **Tester:** <@${interaction.user.id}>`
                  )
              ]
            }).catch(() => {});
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