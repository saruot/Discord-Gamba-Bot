import { SlashCommandBuilder } from '@discordjs/builders';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseconfig.js';


export const data = new SlashCommandBuilder()   
    .setName('coinflip')
    .setDescription('Flip a coin against the house!')
    .addIntegerOption(option => option.setName('wager').setDescription('Amount of coins to wager').setRequired(true));

    export const execute = async (interaction) => {
        const userId = interaction.user.id;
        const wager = interaction.options.getInteger('wager');

        if (wager <= 0) {
            return interaction.reply({ content: 'You must wager a positive amount of coins!', ephemeral: true });
        }

        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists) {
            return interaction.reply({ content: 'You need to opt-in to the game first!', ephemeral: true });
        }

        const userData = userDoc.data();
        if (userData.coins < wager) {
            return interaction.reply({ content: 'You do not have enough coins to make this wager!', ephemeral: true });
        }

        // Perform the coinflip
        const result = Math.random() < 0.5 ? 'heads' : 'tails';

        // Simulate the coinflip outcome
        const playerWins = Math.random() < 0.5; // 50% chance to win against the house
        const updatedCoins = playerWins ? userData.coins + wager : userData.coins - wager;

        // Update the player's coins
        await setDoc(userRef, {...data, coins: updatedCoins });

        const outcomeMessage = playerWins
            ? `🎉 You win the coinflip! You gain ${wager} coins from the house! The coin was ${result}.`
            : `💀 You lose the coinflip. You lose ${wager} coins to the house. The coin was ${result}.`;

        await interaction.reply({ content: outcomeMessage });
    }
