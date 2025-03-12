import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import config from './config.json' assert { type: 'json' };

const { token, clientID, guildID } = config; // Destructure the values from config.json

const TOKEN = token;
const CLIENT_ID = clientID; // Bot's client ID
const GUILD_ID = guildID;   // (Optional) Server ID for testing

console.log(TOKEN, clientID, guildID);

const commands = [];

// Read command files from the `commands/` folder
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const loadCommands = async () => {
    for (const file of commandFiles) {
        // Dynamically import each command file
        const command = await import(`./commands/${file}`);

        // Ensure the command has a 'data' property (the SlashCommandBuilder)
        if (command.data) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`Command in ${file} is missing 'data' export.`);
        }
    }
};

// Create REST instance
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Deploy commands
(async () => {
    try {
        console.log('🔄 Refreshing slash commands...');

        // Load commands before deploying
        await loadCommands();

        await rest.put(
            Routes.applicationCommands(CLIENT_ID), // Register globally
            { body: commands }
        );

        console.log('✅ Slash commands loaded successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
})();
