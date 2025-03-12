import fs from 'fs';
import path from 'path';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import config from './config.json' assert { type: 'json' };
import { db } from './firebaseconfig.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const { token } = config;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ]
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;
    const userRef = doc(db, 'users', userId);

    try {
        const userDoc = await getDoc(userRef);
        const data = userDoc.exists() ? userDoc.data() : null;

        // User joins a voice channel
        if (!oldState.channelId && newState.channelId && data) {
            await setDoc(userRef, { ...data, lastJoin: Date.now() }, { merge: true });
        
        // User leaves a voice channel
        } else if (oldState.channelId && !newState.channelId && data) {
            if (!data.lastJoin) return; // Prevent error if lastJoin doesn't exist
            
            const timeSpent = (Date.now() - data.lastJoin) / 60000; // Convert to minutes
            const coinsEarned = Math.floor(timeSpent * 10); // 10 coins per minute

            const updatedCoins = (data.coins || 0) + coinsEarned;
            const updatedActiveTime = (data.activeTime || 0) + Math.floor(timeSpent * 60); // Store in seconds

            await setDoc(userRef, { 
                ...data, 
                coins: updatedCoins, 
                activeTime: updatedActiveTime, 
                lastJoin: null 
            }, { merge: true });

            console.log(`User ${userId} earned ${coinsEarned} coins for ${Math.floor(timeSpent)} minutes in voice chat.`);
        }
    } catch (error) {
        console.error("Error updating voice activity:", error);
    }
});

client.commands = new Collection();

// Load command files
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
