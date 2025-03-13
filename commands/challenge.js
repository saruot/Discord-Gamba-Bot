import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('haasto')
    .setDescription('Otetaan rehtii')
    .addUserOption(option => 
        option.setName('target')
        .setDescription('The user to challenge')
        .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('määrä')
        .setDescription('Anna vedon määrä')
        .setRequired(true)
    );

export const execute = async (interaction) => {
    const challengerId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');
    const wager = Number(interaction.options.getInteger('määrä'));

    if (wager <= 0) {
        return interaction.reply({ content: 'The wager must be greater than 0!', flags: MessageFlags.Ephemeral });
    }

    // Fetch player data
    const challengerRef = doc(db, 'users', challengerId);
    const targetRef = doc(db, 'users', targetUser.id);

    const challengerDoc = await getDoc(challengerRef);
    const targetDoc = await getDoc(targetRef);

    if (!challengerDoc.exists() || !targetDoc.exists()) {
        return interaction.reply({ content: 'Both players must be registered in the game!', flags: MessageFlags.Ephemeral });
    }

    const challengerData = challengerDoc.data();
    const targetData = targetDoc.data();

    if (challengerData.coins < wager || targetData.coins < wager) {
        return interaction.reply({ content: 'Both players must have enough coins for the wager!', flags: MessageFlags.Ephemeral });
    }

    // Create accept/decline buttons
    const acceptButton = new ButtonBuilder()
        .setCustomId('accept_duel')
        .setLabel('Accept Duel')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId('decline_duel')
        .setLabel('Decline Duel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

    const message = await interaction.reply({
        content: `@<${targetUser.username}>, you have been challenged by ${interaction.user.username} for a coinflip duel of **${wager} coins**! Do you accept?`,
        components: [row],
    });

    // Handle interaction
    const filter = (i) => i.user.id === targetUser.id && (i.customId === 'accept_duel' || i.customId === 'decline_duel');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    collector.on('collect', async (i) => {
        if (i.customId === 'accept_duel') {
            // Coinflip logic
            const KopaId = '230312724901527552';
            let winner;
            if (challengerId === KopaId) {
                // Challenger has a 40% chance of winning
                winner = Math.random() < 0.4 ? challengerId : targetUser.id; // 40% for challenger to win
            } else if (targetUser.id === KopaId) {
                // Target has a 40% chance of winning
                winner = Math.random() < 0.4 ? targetUser.id : challengerId; // 40% for target to win
            } else {
                // Normal 50/50 chance for both players
                winner = Math.random() < 0.5 ? challengerId : targetUser.id;
            }           
             const result = Math.random() < 0.5 ? 'heads' : 'tails';

            let challengerNewCoins = challengerData.coins;
            let targetNewCoins = targetData.coins;

            let challengerWins = challengerData.duelWins || 0;
            let challengerLosses = challengerData.duelLosses || 0;
            let targetWins = targetData.duelWins || 0;
            let targetLosses = targetData.duelLosses || 0;

            let resultMessage;
            if (winner === challengerId) {
                challengerNewCoins += wager;
                targetNewCoins -= wager;
                challengerWins += 1;
                targetLosses += 1;
                resultMessage = `🏆 **${interaction.user.username} wins!** The coin was **${result}**. Wager: **${wager}** coins.`;
            } else {
                challengerNewCoins -= wager;
                targetNewCoins += wager;
                targetWins += 1;
                challengerLosses += 1;
                resultMessage = `🏆 **${targetUser.username} wins!** The coin was **${result}**. Wager: **${wager}** coins.`;
            }

            // Update Firestore with new stats
            await setDoc(challengerRef, { 
                ...challengerData, 
                coins: challengerNewCoins,
                duelWins: challengerWins, 
                duelLosses: challengerLosses
            }, { merge: true });

            await setDoc(targetRef, { 
                ...targetData, 
                coins: targetNewCoins,
                duelWins: targetWins, 
                duelLosses: targetLosses
            }, { merge: true });

            // Remove buttons & update message
            await i.update({ content: resultMessage, components: [] });

        } else {
            await i.update({ content: `${targetUser.username} declined the challenge.`, components: [] });
        }
    });
};
