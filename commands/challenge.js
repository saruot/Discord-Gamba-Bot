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
        return interaction.reply({ content: 'Vedon pitää olla enemmän kuin 0!', flags: MessageFlags.Ephemeral });
    }

    // Fetch player data
    const challengerRef = doc(db, 'users', challengerId);
    const targetRef = doc(db, 'users', targetUser.id);

    const challengerDoc = await getDoc(challengerRef);
    const targetDoc = await getDoc(targetRef);

    if (!challengerDoc.exists() || !targetDoc.exists()) {
        return interaction.reply({ content: 'Molempien pelaajien pitää olla rekistöryneitä peliin!', flags: MessageFlags.Ephemeral });
    }

    const challengerData = challengerDoc.data();
    const targetData = targetDoc.data();

    if (challengerData.coins < wager || targetData.coins < wager) {
        return interaction.reply({ content: 'Molemmilla pelaajilla pitää olla tarpeeksi rahaa vetoon!', flags: MessageFlags.Ephemeral });
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

    // Acknowledge the interaction
    const message = await interaction.reply({
        content: `${targetUser}, you have been challenged by ${interaction.user} for a coinflip duel of **${wager} coins**! Do you accept?`,
        components: [row],
    });
    let timeoutTriggered = false;  // Flag to check if timeout occurred

    // Handle interaction
    const filter = (i) => i.user.id === targetUser.id && (i.customId === 'accept_duel' || i.customId === 'decline_duel');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 120000 }); // 2-minute timeout

    collector.on('collect', async (i) => {
        timeoutTriggered = true
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
            const result = Math.random() < 0.5 ? 'kruuna' : 'klaava';

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
                resultMessage = `🏆 **${interaction.user.username} voittaa!** Kolikko oli **${result}**. Vedon määrä: **${wager}** kolikkoa.`;
            } else {
                challengerNewCoins -= wager;
                targetNewCoins += wager;
                targetWins += 1;
                challengerLosses += 1;
                resultMessage = `🏆 **${targetUser.username} voittaa!** Kolikko oli **${result}**. Vedon määrä: **${wager}** kolikkoa.`;
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
            timeoutTriggered = true
            await i.update({ content: `${targetUser.username} ei halunnut savua.`, components: [] });
        }
    });

    collector.on('end', async (collected, reason) => {
        // If the challenge timed out and no action was taken
        if (reason === 'time' && !timeoutTriggered) {
            await message.edit({
                content: `@${targetUser.username}, Kesti liian kauan ottaa rehtiä ${interaction.user.username} vastaan. Haaste erääntyi.`,
                components: []
            });
        }
    });
};
