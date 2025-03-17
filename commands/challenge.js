import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebaseconfig.js';

const activeChallenges = new Set(); // Store active challenge participants

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

    if (challengerId === targetUser.id) {
        return interaction.reply({ content: 'Et voi haastaa itseäsi!', flags: MessageFlags.Ephemeral });
    }

    if (activeChallenges.has(challengerId) || activeChallenges.has(targetUser.id)) {
        return interaction.reply({ content: 'Sinulla tai haastamallasi käyttäjällä on jo käynnissä oleva haaste!', flags: MessageFlags.Ephemeral });
    }

    activeChallenges.add(challengerId);
    activeChallenges.add(targetUser.id);

    // Fetch player data
    const challengerRef = doc(db, 'users', challengerId);
    const targetRef = doc(db, 'users', targetUser.id);

    const challengerDoc = await getDoc(challengerRef);
    const targetDoc = await getDoc(targetRef);

    if (!challengerDoc.exists() || !targetDoc.exists()) {
        activeChallenges.delete(challengerId);
        activeChallenges.delete(targetUser.id);
        return interaction.reply({ content: 'Molempien pelaajien pitää olla rekistöryneitä peliin!', flags: MessageFlags.Ephemeral });
    }

    const challengerData = challengerDoc.data();
    const targetData = targetDoc.data();

    if (challengerData.coins < wager || targetData.coins < wager) {
        activeChallenges.delete(challengerId);
        activeChallenges.delete(targetUser.id);
        return interaction.reply({ content: 'Molemmilla pelaajilla pitää olla tarpeeksi rahaa vetoon!', flags: MessageFlags.Ephemeral });
    }

    // Create accept/decline buttons
    const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_duel_${challengerId}`)
        .setLabel('Accept Duel')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId(`decline_duel_${challengerId}`)
        .setLabel('Decline Duel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);

    // Acknowledge the interaction
    const message = await interaction.reply({
        content: `${targetUser}, you have been challenged by ${interaction.user} for a coinflip duel of **${wager} coins**! Do you accept?`,
        components: [row],
    });

    let timeoutTriggered = false; // Flag to check if timeout occurred

    // Handle interaction
    const filter = (i) => 
        i.user.id === targetUser.id && 
        (i.customId === `accept_duel_${challengerId}` || i.customId === `decline_duel_${challengerId}`);

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 120000 }); // 2-minute timeout

    collector.on('collect', async (i) => {
        timeoutTriggered = true;
        await i.deferUpdate(); // Prevents multiple acknowledgements

        if (i.customId.startsWith('accept_duel')) {
            // Coinflip logic
            const KopaId = '230312724901527552';
            let winner;
            if (challengerId === KopaId) {
                winner = Math.random() < 0.4 ? challengerId : targetUser.id;
            } else if (targetUser.id === KopaId) {
                winner = Math.random() < 0.4 ? targetUser.id : challengerId;
            } else {
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
            await message.edit({ content: resultMessage, components: [] });
        } else {
            await message.edit({ content: `${targetUser.username} ei halunnut savua.`, components: [] });
        }

        // Cleanup
        activeChallenges.delete(challengerId);
        activeChallenges.delete(targetUser.id);
        collector.stop();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && !timeoutTriggered) {
            await message.edit({
                content: `@${targetUser.username}, Kesti liian kauan ottaa rehtiä ${interaction.user.username} vastaan. Haaste erääntyi.`,
                components: []
            });
        }
        activeChallenges.delete(challengerId);
        activeChallenges.delete(targetUser.id);
    });
};
