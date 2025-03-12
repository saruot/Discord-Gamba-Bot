import fs from 'fs';
import path from 'path';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import config from './config.json' assert { type: 'json' };
import admin from 'firebase-admin';
import 'dotenv/config';
import { firebaseConfig } from './firebaseconfig.js';

const { token, clientId, guildId } = config;

admin.initializeApp(firebaseConfig);
const db = admin.firestore();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ]
});

const activePlayers = new Set();

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;
    const userRef = db.collection('users').doc(userId);

    // When a user joins a voice channel
    if (!oldState.channelId && newState.channelId) {
        const userDoc = await userRef.get();
        const data = userDoc.exists ? userDoc.data() : { coins: 0, activeTime: 0 };

        // Store the start of voice activity
        await userRef.set({ ...data, lastJoin: Date.now() }, { merge: true });

    // When a user leaves a voice channel
    } else if (oldState.channelId && !newState.channelId) {
        const userDoc = await userRef.get();
        const data = userDoc.exists ? userDoc.data() : { coins: 0, activeTime: 0 };
        
        // Calculate the time spent in the voice channel and update the activeTime
        const timeSpent = Date.now() - data.lastJoin;
        const updatedActiveTime = (data.activeTime || 0) + timeSpent;

        await userRef.set({ ...data, activeTime: updatedActiveTime }, { merge: true });
    }
});


client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}


// Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(token);
