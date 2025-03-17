import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';
import { doc, getDoc } from "firebase/firestore";
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Näyttää statseja');

export const execute = async (interaction) => {
    const userId = interaction.user.id;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return interaction.reply({
            content: 'Et ole osallistunut peliin.',
            flags: MessageFlags.Ephemeral
        });
    }

    const userData = userDoc.data();
    const coins = userData.coins || 0;
    
    // Coinflip stats (pulled from coinflip logic)
    const totalMinutes = userData.activeTime || 0;
    const hours = Math.floor((totalMinutes / 60) / 60);
    const minutes = totalMinutes % 60;
    const formattedTime = `${hours}h ${minutes}min`;    
    const totalFlips = userData.totalFlips || 0;
    const totalWins = userData.totalWins || 0;
    const coinflipWinRate = totalFlips > 0 
        ? ((totalWins / totalFlips) * 100).toFixed(2) + "%" 
        : "Ei pelattu vielä.";

    // Duel stats (defaults to zero if not tracked yet)
    const duelWins = userData.duelWins || 0;
    const duelLosses = userData.duelLosses || 0;
    const totalDuels = duelWins + duelLosses;
    const duelWinRate = totalDuels > 0 
        ? ((duelWins / totalDuels) * 100).toFixed(2) + "%" 
        : "Ei pelattu vielä.";

    return interaction.reply({
        content: `📊 **Statistiiikat** 📊\n\n**Aika kannulla**: ${formattedTime} minuuttia\n\n💰 **Kolikot**: ${coins}\n\n🎲 **Kolikonheitot**: ${coinflipWinRate} voitto-% (${totalWins} voittoa, ${totalFlips - totalWins} häviötä)\n⚔️ **Duelit**: ${duelWinRate} voitto-% (${duelWins} voittoa, ${duelLosses} häviötä)`,
        flags: MessageFlags.Ephemeral
    });
};
