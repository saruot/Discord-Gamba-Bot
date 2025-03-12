import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, ButtonBuilder } from 'discord.js';

export const data = new SlashCommandBuilder() 
    .setName('challenge')
    .setDescription('Otetaan rehtii')
    .addUserOption(option => option.setName('target').setDescription('The user to challenge').setRequired(true));
   export const execute = async (interaction) => {
    const challengerId = interaction.user.id;
    const targetUser = interaction.options.getUser('target');

    // Check if both players are opted-in
    if (!activePlayers.has(challengerId) || !activePlayers.has(targetUser.id)) {
        return interaction.reply({ content: 'Both players must be opted-in to the game!', ephemeral: true });
    }

    // Create a button for the challenged player to accept or decline the duel
    const acceptButton = new ButtonBuilder()
        .setCustomId('accept_duel')
        .setLabel('Accept Duel')
        .setStyle('SUCCESS');

    const declineButton = new ButtonBuilder()
        .setCustomId('decline_duel')
        .setLabel('Decline Duel')
        .setStyle('DANGER');

    const row = new ActionRowBuilder()
        .addComponents(acceptButton, declineButton);

    await interaction.reply({
        content: `${targetUser.username}, you have been challenged by ${interaction.user.username} for a coinflip duel! Do you accept?`,
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
            const wager = 10; // Fixed wager

            const challengerRef = db.collection('users').doc(challengerId);
            const targetRef = db.collection('users').doc(targetUser.id);

            const challengerData = (await challengerRef.get()).data();
            const targetData = (await targetRef.get()).data();

            if (winner === challengerId) {
                await challengerRef.update({ coins: challengerData.coins + wager });
                await targetRef.update({ coins: targetData.coins - wager });
                await i.followUp(`${interaction.user.username} wins the duel! The coin was ${result}.`);
            } else {
                await targetRef.update({ coins: targetData.coins + wager });
                await challengerRef.update({ coins: challengerData.coins - wager });
                await i.followUp(`${targetUser.username} wins the duel! The coin was ${result}.`);
            }

            // End the duel
            activePlayers.delete(challengerId);
            activePlayers.delete(targetUser.id);

        } else {
            // Decline the duel
            await i.reply({ content: `${targetUser.username} declined the duel.`, ephemeral: true });
        }
    });
}
