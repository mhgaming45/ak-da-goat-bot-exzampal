const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Send the Tier Testing Panel Embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor("#2B2D31")
      .setTitle("📝 Evaluation Testing Waitlist")
      .setDescription(
        "Upon applying, you will be added to a waitlist channel.\n" +
        "Here you will be pinged when a tester of your region is available.\n" +
        "If you are HT3 or higher, create a high ticket.\n\n" +
        "⚙️ **Register Your Profile**\n" +
        "Click Register / Update Profile to set your in-game username, region, and account type before joining any queue.\n\n" +
        "🎯 **Select a Gamemode**\n" +
        "Click any gamemode button below to receive the corresponding waitlist role. A tester will pick you up when they open a queue.\n\n" +
        "⏱️ **Testing Cooldown**\n" +
        "Each Gamemode has a 5-day cooldown after each test\n\n" +
        "🛡️ **Validity**\n" +
        "Provide authentic information about your account and testing details"
      )
      .setFooter({ text: "Tier Test System" });

    // Row 1: Register Button
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("register")
        .setLabel("Register/Update")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Danger)
    );

    // Row 2: UHC, Pot, Mace, NethOP
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("uhc").setLabel("UHC").setEmoji("⚔️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("pot").setLabel("Pot").setEmoji("🧪").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("mace").setLabel("Mace").setEmoji("🔨").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("nethop").setLabel("NethOP").setEmoji("🛡️").setStyle(ButtonStyle.Secondary)
    );

    // Row 3: SMP, Sword, Axe
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("smp").setLabel("SMP").setEmoji("🧩").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("sword").setLabel("Sword").setEmoji("⚔️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("axe").setLabel("Axe").setEmoji("🪓").setStyle(ButtonStyle.Secondary)
    );

    // Row 4: Vanilla, Cart, DiaSmp
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("vanilla").setLabel("Vanilla").setEmoji("🍦").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cart").setLabel("Cart").setEmoji("🛒").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("diasmp").setLabel("DiaSmp").setEmoji("💎").setStyle(ButtonStyle.Secondary)
    );

    await interaction.channel.send({
      embeds: [embed],
      components: [row1, row2, row3, row4]
    });

    return interaction.reply({ content: "✅ Panel created successfully!", ephemeral: true });
  }
};
