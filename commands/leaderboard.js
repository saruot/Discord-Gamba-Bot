import { SlashCommandBuilder } from '@discordjs/builders';
import { doc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the leaderboard for coins, coinflip win%, duel win%, and voice chat time');

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
            activeTime: data.activeTime || 0 // Stored in seconds
        });
    });

    // Sort users by categories
    const sortedByCoins = [...usersData].sort((a, b) => b.coins - a.coins).slice(0, 3);
    const sortedByCoinflipWinRate = [...usersData]
        .filter(user => user.totalFlips > 0)
        .sort((a, b) => (b.totalWins / b.totalFlips) - (a.totalWins / a.totalFlips))
        .slice(0, 3);
    const sortedByDuelWinRate = [...usersData]
        .filter(user => user.duelWins + user.duelLosses > 0)
        .sort((a, b) => (b.duelWins / (b.duelWins + b.duelLosses)) - (a.duelWins / (a.duelWins + a.duelLosses)))
        .slice(0, 3);

    // Sort users by most active time and get top 3
    const topActiveUsers = [...usersData].sort((a, b) => b.activeTime - a.activeTime).slice(0, 3);

    // Convert active time to hours & minutes
    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}min`;
    };

    // Fetch usernames from Discord
    const fetchUsernames = async (users) => {
        return await Promise.all(users.map(async (user) => {
            try {
                const member = await interaction.guild.members.fetch(user.id);
                return { ...user, name: member.user.username };
            } catch (error) {
                console.error(`Failed to fetch user ${user.id}:`, error);
                return { ...user, name: user.id }; // Fallback to ID if user not found
            }
        }));
    };

    // Fetch usernames for all leaderboard categories
    const usersWithNames = {
        coins: await fetchUsernames(sortedByCoins),
        coinflip: await fetchUsernames(sortedByCoinflipWinRate),
        duel: await fetchUsernames(sortedByDuelWinRate),
        time: await fetchUsernames(topActiveUsers)
    };

    // Format the leaderboard message
    const leaderboardMessage = [
        '**🏆 Leaderboard: Eniten kolikoita**',
        usersWithNames.coins.map((user, index) => `**#${index + 1}:** ${user.name} **${user.coins} kolikkoa**`).join('\n'),

        '\n**🎲 Leaderboard: Isoin coinflip w/r%**',
        usersWithNames.coinflip.map((user, index) => {
            const winRate = ((user.totalWins / user.totalFlips) * 100).toFixed(2);
            return `**#${index + 1}:** ${user.name} **${winRate}%**`;
        }).join('\n'),

        '\n**⚔️ Leaderboard: Isoin duel w/r%**',
        usersWithNames.duel.map((user, index) => {
            const duelWinRate = ((user.duelWins / (user.duelWins + user.duelLosses)) * 100).toFixed(2);
            return `**#${index + 1}:** ${user.name} **${duelWinRate}%**`;
        }).join('\n'),

        '\n⏳ **Leaderboard: eniten aikaa kannulla:**',
        usersWithNames.time.map((user, index) => `**#${index + 1}:** ${user.name} - **${formatTime(user.activeTime)}**`).join('\n')
    ];

    // Send the message
    await interaction.reply({
        content: leaderboardMessage.join('\n'),
    });
};
