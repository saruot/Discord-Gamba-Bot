import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('challenge')
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
    const wager = interaction.options.getInteger('määrä'); // Get the wager amount

    if (wager <= 0) {
        return interaction.reply({ content: 'The wager must be greater than 0!', ephemeral: true });
    }

    // Fetch player data
    const challengerRef = doc(db, 'users', challengerId);
    const targetRef = doc(db, 'users', targetUser.id);

    const challengerDoc = await getDoc(challengerRef);
    const targetDoc = await getDoc(targetRef);

    if (!challengerDoc.exists() || !targetDoc.exists()) {
        return interaction.reply({ content: 'Both players must be registered in the game!', ephemeral: true });
    }

    const challengerData = challengerDoc.data();
    const targetData = targetDoc.data();

    // Ensure both players have enough coins
    if (challengerData.coins < wager || targetData.coins < wager) {
        return interaction.reply({ content: 'Both players must have enough coins for the wager!', ephemeral: true });
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

    const row = new ActionRowBuilder()
        .addComponents(acceptButton, declineButton);

    await interaction.reply({
        content: `${targetUser.username}, you have been challenged by ${interaction.user.username} for a coinflip duel of **${wager} coins**! Do you accept?`,
        components: [row],
    });

    // Handle interaction (accept or decline)
    const filter = (i) => i.user.id === targetUser.id && (i.customId === 'accept_duel' || i.customId === 'decline_duel');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    collector.on('collect', async (i) => {
        if (i.customId === 'accept_duel') {
            // Coinflip logic
            const winner = Math.random() < 0.5 ? challengerId : targetUser.id;
            const result = Math.random() < 0.5 ? 'heads' : 'tails';

            let challengerNewCoins = challengerData.coins;
            let targetNewCoins = targetData.coins;

            if (winner === challengerId) {
                challengerNewCoins += wager;
                targetNewCoins -= wager;
                await i.reply(`${interaction.user.username} wins the duel! The coin was **${result}**.`);
            } else {
                challengerNewCoins -= wager;
                targetNewCoins += wager;
                await i.reply(`${targetUser.username} wins the duel! The coin was **${result}**.`);
            }

            // Update Firestore
            await setDoc(challengerRef, { ...challengerData, coins: challengerNewCoins }, { merge: true });
            await setDoc(targetRef, { ...targetData, coins: targetNewCoins }, { merge: true });

        } else {
            // Decline the duel
            await i.reply({ content: `${targetUser.username} declined the duel.`, ephemeral: true });
        }
    });
};
