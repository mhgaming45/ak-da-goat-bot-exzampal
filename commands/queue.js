const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Send the Testing Queue Panel"),

  async execute(interaction) {

    const embed = new EmbedBuilder()
      .setColor("#3498DB")
      .setTitle("🧪 Testing Queue")
      .setDescription(
        "Welcome to the Testing Queue!\n\n" +
        "Click **Join Queue** to enter the testing queue.\n" +
        "Click **Leave Queue** if you want to leave your current queue.\n\n" +
        "━━━━━━━━━━━━━━━━━━━━"
      )
      .setFooter({
        text: "AK Tier Testing"
      });

    const row = new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId("join_queue")
          .setLabel("Join Queue")
          .setEmoji("🎮")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("leave_queue")
          .setLabel("Leave Queue")
          .setEmoji("🚪")
          .setStyle(ButtonStyle.Danger)

      );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

  }
};
