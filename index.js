import fs from 'fs';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import config from './config.json' assert { type: 'json' };
import { db } from './firebaseconfig.js';
import { doc, getDoc, setDoc, getDocs, deleteDoc, collection } from 'firebase/firestore';

const { token } = config;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ]
});

// 🔹 Keep Firebase Alive (Prevents Timeouts)
const keepFirebaseAlive = async () => {
    try {
        await setDoc(doc(db, "keepalive", "ping"), { timestamp: Date.now() }, { merge: true });
        console.log(`Keepalive ping @ ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error("Firebase keepalive failed:", error);
    }
};
setInterval(keepFirebaseAlive, 500000); 

// 🔹 Track bot uptime (Every 5 minutes)
const botOnlineInterval = async () => {
    try {
        await setDoc(doc(db, "activeUsers", "botInterval"), { timestamp: Date.now() }, { merge: true });
        console.log("🟢 Updated bot online time interval.");
    } catch (e) {
        console.error("❌ Failed to update bot online interval:", e);
    }
};
setInterval(botOnlineInterval, 300000); // 5 minutes

// 🔹 Cash out a user (when they leave or bot crashes)
const cashOutUser = async (userId, useBotInterval = false) => {
    try {
        const userRef = doc(db, 'users', userId);
        const activeUserRef = doc(db, 'activeUsers', userId);
        const botActiveTimeRef = doc(db, 'activeUsers', 'botInterval');

        const userDoc = await getDoc(userRef);
        const activeUserDoc = await getDoc(activeUserRef);
        const botActiveDoc = await getDoc(botActiveTimeRef);

        if (!userDoc.exists() || !activeUserDoc.exists()) return;

        const data = userDoc.data();
        const lastJoin = activeUserDoc.data().lastJoin;
        if (!lastJoin) return;

        let lastTime = Date.now();

        // Only use botInterval if recovering from a crash
        if (useBotInterval && botActiveDoc.exists()) {
            lastTime = Math.min(botActiveDoc.data().timestamp, Date.now());
        }

        const timeSpent = (lastTime - lastJoin) / 60000; // Convert to minutes
        if (timeSpent < 0) {
            console.warn(`⚠️ Negative time spent detected for ${userId}. Ignoring.`);
            return;
        }

        const coinsEarned = Math.floor(timeSpent * 10); // 10 coins per minute
        const updatedCoins = (data.coins || 0) + coinsEarned;
        const updatedActiveTime = (data.activeTime || 0) + Math.floor(timeSpent * 60); // Store in seconds

        await setDoc(userRef, { 
            ...data, 
            coins: updatedCoins, 
            activeTime: updatedActiveTime, 
        }, { merge: true });

        await deleteDoc(activeUserRef); // Remove from active tracking

        console.log(`💰 Cashed out ${userId}: Earned ${coinsEarned} coins for ${Math.floor(timeSpent)} min in voice chat.`);
    } catch (error) {
        console.error(`❌ Error cashing out ${userId}:`, error);
    }
};

// 🔹 Check for users who were tracked before a crash
const restoreAndCashOutUsers = async () => {
    console.log("🔍 Checking for users stuck in tracking...");

    const snapshot = await getDocs(collection(db, "activeUsers"));
    const cashOutPromises = [];

    snapshot.forEach((doc) => {
        if (doc.id !== "botInterval") { // Skip botInterval document
            console.log(`⚠️ Found tracked user from crash: ${doc.id}, cashing out...`);
            cashOutPromises.push(cashOutUser(doc.id, true)); // Use botInterval timestamp
        }
    });

    await Promise.all(cashOutPromises);
    console.log("✅ Startup recovery complete.");
};
// 🔹 Scan Voice Channels at Startup (NEW FUNCTION)
const scanVoiceChannels = async () => {
    console.log("🔍 Scanning voice channels for active users...");

    const guilds = client.guilds.cache;

    for (const [guildId, guild] of guilds) {
        const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2); // Type 2 = Voice

        for (const [channelId, channel] of voiceChannels) {
            for (const [userId, member] of channel.members) {
                if (!member.user.bot) { // Ignore bots
                    const activeUserRef = doc(db, 'activeUsers', userId);
                    const userDoc = await getDoc(activeUserRef);

                    if (!userDoc.exists()) { // Only add if not already tracked
                        await setDoc(activeUserRef, { lastJoin: Date.now() }, { merge: true });
                        console.log(`🎤 Added ${userId} to activeUsers (already in VC).`);
                    }
                }
            }
        }
    }

    console.log("✅ Voice channel scan complete.");
};

// 🔹 Handle voice channel state updates
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;
    const userRef = doc(db, 'users', userId);
    const activeUserRef = doc(db, 'activeUsers', userId);

    try {
        const userDoc = await getDoc(userRef);
        const data = userDoc.exists() ? userDoc.data() : null;

        if (!data) return;

        // User joins a voice channel
        if (!oldState.channelId && newState.channelId) {
            await setDoc(activeUserRef, { lastJoin: Date.now() }, { merge: true });
            console.log(`🎤 ${userId} joined a voice channel.`);

        // User leaves a voice channel
        } else if (oldState.channelId && !newState.channelId) {
            await cashOutUser(userId);
        }
    } catch (error) {
        console.error("❌ Error updating voice activity:", error);
    }
});

// 🔹 Handle Bot Shutdown (Cashes out all tracked users)
const handleShutdown = async () => {
    console.log("🚨 Bot shutting down... Cashing out all tracked users.");

    const snapshot = await getDocs(collection(db, "activeUsers"));
    const cashOutPromises = [];

    snapshot.forEach((doc) => {
        if (doc.id !== "botInterval") { // Skip bot interval document
            console.log(`⚠️ Cashing out ${doc.id} before shutdown.`);
            cashOutPromises.push(cashOutUser(doc.id));
        }
    });

    await Promise.all(cashOutPromises);

    // Explicitly remove all active users to prevent duplicate cash-out
    snapshot.forEach(async (doc) => {
        if (doc.id !== "botInterval") {
            await deleteDoc(doc.ref);
            console.log(`⚠️ Removed ${doc.id} from active users before shutdown.`);
        }
    });

    console.log("✅ All users cashed out and removed. Exiting process.");
    process.exit();
};
// 🔹 Handle Unexpected Crashes
process.on("SIGINT", handleShutdown);  // CTRL+C
process.on("SIGTERM", handleShutdown); // Server shutdown
process.on("uncaughtException", async (err) => {
    console.error("❌ Uncaught Exception!", err);
    await handleShutdown();
});
process.on("unhandledRejection", async (reason, promise) => {
    console.error("❌ Unhandled Promise Rejection!", reason);
    await handleShutdown();
});

// 🔹 Load command files
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// 🔹 Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ There was an error executing this command!', ephemeral: true });
    }
});

// 🔹 Bot Startup (Recover from Crashes)
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await restoreAndCashOutUsers(); // Restore and payout users from a crash
    await scanVoiceChannels();
    await botOnlineInterval();
});

client.login(token);
