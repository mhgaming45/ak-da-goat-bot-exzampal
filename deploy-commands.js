require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Send the Register Panel")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Send the Testing Queue Panel")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("testerpanel")
    .setDescription("Send the Tester Panel")
    .toJSON()

];

const rest = new REST({ version: "10" })
  .setToken(process.env.TOKEN);

(async () => {

  try {

    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("✅ Slash commands registered!");

  } catch (error) {

    console.error("❌ Failed to register slash commands:");
    console.error(error);

  }

})();
