const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("testerpanel")
    .setDescription("Send the Tester Panel"),

  async execute(interaction) {

    const embed = new EmbedBuilder()
      .setColor("#F1C40F")
      .setTitle("🎯 Tier Tester Panel")
      .setDescription(
        "Select the gamemode you want to test.\n\n" +
        "After selecting a gamemode, press **Next Player** to take the first player from that queue.\n\n" +
        "━━━━━━━━━━━━━━━━━━━━"
      )
      .setFooter({
        text: "AK Tier Testing"
      });

    const select = new StringSelectMenuBuilder()
      .setCustomId("select_test_mode")
      .setPlaceholder("🎮 Select Gamemode")
      .addOptions(
        {
          label: "Sword",
          value: "sword",
          emoji: "⚔️"
        },
        {
          label: "Axe",
          value: "axe",
          emoji: "🪓"
        },
        {
          label: "UHC",
          value: "uhc",
          emoji: "🏹"
        },
        {
          label: "Diamond Pot",
          value: "pot",
          emoji: "💎"
        },
        {
          label: "Netherite Pot",
          value: "nethop",
          emoji: "🔥"
        },
        {
          label: "SMP",
          value: "smp",
          emoji: "🌍"
        },
        {
          label: "Mace",
          value: "mace",
          emoji: "🔨"
        },
        {
          label: "Cart",
          value: "cart",
          emoji: "🏎️"
        },
        {
          label: "Vanilla",
          value: "vanilla",
          emoji: "🌿"
        }
      );

    const selectRow = new ActionRowBuilder()
      .addComponents(select);

    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("next_player")
          .setLabel("Next Player")
          .setEmoji("🎯")
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      embeds: [embed],
      components: [selectRow, buttonRow]
    });

  }
};
