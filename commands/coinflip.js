import { SlashCommandBuilder } from '@discordjs/builders';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin against the house!')
    .addIntegerOption(option => 
        option.setName('wager')
        .setDescription('Amount of coins to wager')
        .setRequired(true)
    );

export const execute = async (interaction) => {
    await interaction.deferReply(); // Acknowledge the interaction first

    const userId = interaction.user.id;
    const wager = Number(interaction.options.getInteger('wager')); // ✅ Ensure it's a number

    if (isNaN(wager) || wager <= 0) {
        return interaction.editReply({ content: 'You must wager a positive amount of coins!' });
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return interaction.editReply({ content: 'You need to opt-in to the game first!' });
    }

    const userData = userDoc.data();
    if (userData.coins < wager) {
        return interaction.editReply({ content: 'You do not have enough coins to make this wager!' });
    }

    // Perform the coinflip
    const result = Math.random() < 0.5 ? 'kruuna' : 'klaava';
    const playerWins = Math.random() < 0.5; // 50% chance to win against the house
    const updatedCoins = playerWins ? userData.coins + wager : userData.coins - wager;

    // ✅ Ensure only valid Firestore types are used
    await setDoc(userRef, {...userData, coins: updatedCoins }, { merge: true });

    const outcomeMessage = playerWins
        ? `🎉 Helpot pois, voitto ${wager} kolikkoa kassulta! Kolikko oli ${result}. Pankissa ${updatedCoins} kolikkoa.`
        : `💀 Rakoon meni. Hävisit ${wager} kolikkoa kassulle. Kolikko oli ${result}. Jäljellä ${updatedCoins} kolikkoa.`;

    await interaction.editReply({ content: outcomeMessage });
};
