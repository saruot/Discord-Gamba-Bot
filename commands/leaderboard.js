import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';
import { doc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the leaderboard for coins, coinflip win%, and duel win%');

export const execute = async (interaction) => {
    const usersRef = collection(db, 'users');
    const userDocs = await getDocs(usersRef);
    
    // Retrieve user data
    const usersData = [];
    userDocs.forEach(doc => {
        const data = doc.data();
        usersData.push({
            id: doc.id,
            coins: data.coins || 0,
            totalFlips: data.totalFlips || 0,
            totalWins: data.totalWins || 0,
            duelWins: data.duelWins || 0,
            duelLosses: data.duelLosses || 0,
        });
    });

    // Sort users by categories
    const sortedByCoins = usersData.sort((a, b) => b.coins - a.coins).slice(0, 3); // Top 3 by coins
    const sortedByCoinflipWinRate = usersData
        .filter(user => user.totalFlips > 0) // Exclude users with 0 flips
        .sort((a, b) => (b.totalWins / b.totalFlips) - (a.totalWins / a.totalFlips)) // Sort by win rate
        .slice(0, 3); // Top 3 by coinflip win rate
    const sortedByDuelWinRate = usersData
        .filter(user => user.duelWins + user.duelLosses > 0) // Exclude users with 0 duels played
        .sort((a, b) => (b.duelWins / (b.duelWins + b.duelLosses)) - (a.duelWins / (a.duelWins + a.duelLosses))) // Sort by duel win rate
        .slice(0, 3); // Top 3 by duel win rate

    // Format the message
    const leaderboardMessage = [
        '**Leaderboard: Eniten kolikoita**',
        sortedByCoins.map((user, index) => `**#${index + 1}:** ${user.id}  **${user.coins} kolikolla**`).join('\n'),
        '\n\n**Leaderboard: Isoin coinflip w/r%**',
        sortedByCoinflipWinRate.map((user, index) => {
            const winRate = ((user.totalWins / user.totalFlips) * 100).toFixed(2);
            return `**#${index + 1}:** ${user.id}  **${winRate}%** w/r%`;
        }).join('\n'),
        '\n\n**Leaderboard: Isoin duel w/r%**',
        sortedByDuelWinRate.map((user, index) => {
            const duelWinRate = ((user.duelWins / (user.duelWins + user.duelLosses)) * 100).toFixed(2);
            return `**#${index + 1}:** ${user.id} **${duelWinRate}%** duel w/r%`;
        }).join('\n')
    ];

    // Send the message
    await interaction.reply({
        content: leaderboardMessage.join('\n'),
    });

};
