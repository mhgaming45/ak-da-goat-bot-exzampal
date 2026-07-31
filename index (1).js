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
// REMOVE PLAYER FROM ALL QUEUES
// ========================================

function removeFromAllQueues(userId) {

  for (
    const mode of Object.keys(queues)
  ) {

    queues[mode] =
      queues[mode].filter(
        id => id !== userId
      );

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
      // REGISTER BUTTON
      // ====================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "register"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "register_modal"
            )
            .setTitle(
              "Player Registration"
            );

        const ign =
          new TextInputBuilder()
            .setCustomId("ign")
            .setLabel(
              "Minecraft Username"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setMaxLength(32);

        const region =
          new TextInputBuilder()
            .setCustomId("region")
            .setLabel("Region")
            .setPlaceholder(
              "AS / EU / NA"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);

        const account =
          new TextInputBuilder()
            .setCustomId("account")
            .setLabel(
              "Account Type"
            )
            .setPlaceholder(
              "Premium / Cracked"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);

        modal.addComponents(

          new ActionRowBuilder()
            .addComponents(ign),

          new ActionRowBuilder()
            .addComponents(region),

          new ActionRowBuilder()
            .addComponents(account)

        );

        return interaction.showModal(
          modal
        );
      }

      // ====================================
      // REGISTER MODAL
      // ====================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "register_modal"
      ) {

        const db = loadDB();

        const oldData =
          db[
            `user_${interaction.user.id}`
          ] || {};

        db[
          `user_${interaction.user.id}`
        ] = {

          ign:
            interaction.fields
              .getTextInputValue(
                "ign"
              ),

          region:
            interaction.fields
              .getTextInputValue(
                "region"
              ),

          account:
            interaction.fields
              .getTextInputValue(
                "account"
              ),

          gamemode:
            oldData.gamemode || null,

          tier:
            oldData.tier || null,

          wins:
            oldData.wins || 0,

          losses:
            oldData.losses || 0

        };

        saveDB(db);

        // Queue role

        if (config.queueRole) {

          await interaction.member.roles
            .add(config.queueRole)
            .catch(() => {});

        }

        const row1 =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("uhc")
                .setLabel("UHC")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("pot")
                .setLabel(
                  "Diamond Pot"
                )
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("mace")
                .setLabel("Mace")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("nethop")
                .setLabel(
                  "Netherite Pot"
                )
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("smp")
                .setLabel("SMP")
                .setStyle(
                  ButtonStyle.Secondary
                )

            );

        const row2 =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("sword")
                .setLabel("Sword")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("axe")
                .setLabel("Axe")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("vanilla")
                .setLabel("Vanilla")
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId("cart")
                .setLabel("Cart")
                .setStyle(
                  ButtonStyle.Secondary
                )

            );

        return interaction.reply({

          content:
            "✅ **Registration Complete!**\n\n" +
            "🎮 Select your gamemode:",

          components: [
            row1,
            row2
          ],

          ephemeral: true

        });

      }

      // ====================================
      // GAMEMODE BUTTONS
      // ====================================

      const gamemodes = [
        "uhc",
        "pot",
        "mace",
        "nethop",
        "smp",
        "sword",
        "axe",
        "vanilla",
        "cart"
      ];

      if (
        interaction.isButton() &&
        gamemodes.includes(
          interaction.customId
        )
      ) {

        const mode =
          interaction.customId;

        const db = loadDB();

        const data =
          db[
            `user_${interaction.user.id}`
          ];

        if (!data) {

          return interaction.reply({
            content:
              "❌ Please register first using the Register button.",
            ephemeral: true
          });

        }

        // Already in any queue

        let currentMode = null;

        for (
          const queueMode of
            Object.keys(queues)
        ) {

          if (
            queues[queueMode].includes(
              interaction.user.id
            )
          ) {

            currentMode =
              queueMode;

            break;

          }

        }

        if (currentMode) {

          const position =
            queues[currentMode]
              .indexOf(
                interaction.user.id
              ) + 1;

          return interaction.reply({

            content:
              `❌ You are already in the **${currentMode.toUpperCase()}** queue.\n\n` +
              `📍 Position: **#${position}**\n\n` +
              `Use **Leave Queue** first if you want to change gamemode.`,

            ephemeral: true

          });

        }

        data.gamemode =
          mode;

        db[
          `user_${interaction.user.id}`
        ] = data;

        saveDB(db);

        queues[mode].push(
          interaction.user.id
        );

        const position =
          queues[mode].length;

        // Remove old gamemode roles

        if (config.roles) {

          for (
            const roleId of
              Object.values(
                config.roles
              )
          ) {

            await interaction.member.roles
              .remove(roleId)
              .catch(() => {});

          }

          if (
            config.roles[mode]
          ) {

            await interaction.member.roles
              .add(
                config.roles[mode]
              )
              .catch(() => {});

          }

        }

        await interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor("#2ECC71")
              .setTitle(
                "✅ Joined Queue"
              )
              .setDescription(

                `🎮 **Gamemode:** ${mode.toUpperCase()}\n\n` +

                `📍 **Position:** #${position}\n` +

                `👥 **Players Ahead:** ${position - 1}\n\n` +

                "Please wait for a tester."

              )

          ],

          ephemeral: true

        });

        await updateQueue(
          mode
        );

        return;
      }

      // ====================================
      // JOIN QUEUE BUTTON
      // ====================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "join_queue"
      ) {

        return interaction.reply({

          content:
            "🎮 Select your gamemode from the **Register Panel** to join a queue.",

          ephemeral: true

        });

      }

      // ====================================
      // LEAVE QUEUE
      // ====================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "leave_queue"
      ) {

        let foundMode = null;

        for (
          const mode of
            Object.keys(queues)
        ) {

          if (
            queues[mode].includes(
              interaction.user.id
            )
          ) {

            foundMode =
              mode;

            break;

          }

        }

        if (!foundMode) {

          return interaction.reply({

            content:
              "❌ You are not currently in a queue.",

            ephemeral: true

          });

        }

        queues[foundMode] =
          queues[foundMode].filter(
            id =>
              id !==
              interaction.user.id
          );

        // Remove gamemode roles

        if (config.roles) {

          for (
            const roleId of
              Object.values(
                config.roles
              )
          ) {

            await interaction.member.roles
              .remove(roleId)
              .catch(() => {});

          }

        }

        const db = loadDB();

        if (
          db[
            `user_${interaction.user.id}`
          ]
        ) {

          db[
            `user_${interaction.user.id}`
          ].gamemode = null;

          saveDB(db);

        }

        await interaction.reply({

          content:
            `✅ You left the **${foundMode.toUpperCase()}** queue.`,

          ephemeral: true

        });

        await updateQueue(
          foundMode
        );

        return;
      }

      // ====================================
      // TESTER GAMEMODE SELECT
      // ====================================

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "select_test_mode"
      ) {

        if (
          !isTester(interaction)
        ) {

          return interaction.reply({

            content:
              "❌ Only testers can use this panel.",

            ephemeral: true

          });

        }

        const mode =
          interaction.values[0];

        testerMode[
          interaction.user.id
        ] = mode;

        return interaction.reply({

          content:
            `✅ Selected **${mode.toUpperCase()}**.\n\n` +
            "Now press **🎯 Next Player**.",

          ephemeral: true

        });

      }

      // ====================================
      // NEXT PLAYER
      // ====================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "next_player"
      ) {

        if (
          !isTester(interaction)
        ) {

          return interaction.reply({

            content:
              "❌ Only testers can use this button.",

            ephemeral: true

          });

        }

        const mode =
          testerMode[
            interaction.user.id
          ];

        if (!mode) {

          return interaction.reply({

            content:
              "❌ Please select a gamemode first.",

            ephemeral: true

          });

        }

        if (
          !queues[mode] ||
          queues[mode].length === 0
        ) {

          return interaction.reply({

            content:
              `❌ The **${mode.toUpperCase()}** queue is empty.`,

            ephemeral: true

          });

        }

        const userId =
          queues[mode][0];

        const db = loadDB();

        const data =
          db[
            `user_${userId}`
          ];

        if (!data) {

          queues[mode].shift();

          await updateQueue(
            mode
          );

          return interaction.reply({

            content:
              "❌ Player data not found. Player removed from queue.",

            ephemeral: true

          });

        }

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `pass_${userId}`
                )
                .setLabel("PASS")
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `fail_${userId}`
                )
                .setLabel("FAIL")
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )

            );

        const embed =
          new EmbedBuilder()
            .setColor("#F1C40F")
            .setTitle(
              "🎯 Current Test"
            )
            .setDescription(

              `👤 **Player:** <@${userId}>\n\n` +

              `🎮 **IGN:** ${data.ign}\n` +

              `🌍 **Region:** ${data.region}\n` +

              `💳 **Account:** ${data.account || "Not specified"}\n` +

              `⚔️ **Gamemode:** ${mode.toUpperCase()}\n\n` +

              `🏆 **Wins:** ${data.wins || 0}\n` +

              `❌ **Losses:** ${data.losses || 0}`

            );

        return interaction.reply({

          embeds: [embed],

          components: [row],

          ephemeral: true

        });

      }

      // ====================================
      // PASS BUTTON
      // ====================================

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "pass_"
        )
      ) {

        if (
          !isTester(interaction)
        ) {

          return interaction.reply({

            content:
              "❌ Only testers can use this button.",

            ephemeral: true

          });

        }

        const userId =
          interaction.customId.replace(
            "pass_",
            ""
          );

        const db = loadDB();

        const data =
          db
