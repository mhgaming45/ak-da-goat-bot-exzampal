const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the Register Panel"),

  async execute(interaction) {

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📝 Register Testing")
      .setDescription(
        "Click **Register / Update** to register yourself for testing.\n\n" +
        "After registration, you will be able to select your gamemode.\n\n" +
        "━━━━━━━━━━━━━━━━━━━━"
      );

    const registerRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("register")
          .setLabel("Register / Update")
          .setEmoji("📝")
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      embeds: [embed],
      components: [registerRow]
    });
  }
};
