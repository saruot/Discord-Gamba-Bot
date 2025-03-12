import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import config from './config.json' assert { type: 'json' };
i
const { token, clientId, guildId } = config;

const TOKEN = token;
const CLIENT_ID = clientId; // Your bot's client ID
const GUILD_ID = guildId;   // (Optional) Server ID for testing

const commands = [];

// Read command files from the `commands/` folder
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

// Create REST instance
const rest = new REST({ version: '10' }).setToken(TOKEN);

// Deploy commands
(async () => {
    try {
        console.log('🔄 Refreshing slash commands...');

        await rest.put(
            GUILD_ID
                ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) // Register in a test server
                : Routes.applicationCommands(CLIENT_ID), // Register globally
            { body: commands }
        );

        console.log('✅ Slash commands loaded successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
})();
