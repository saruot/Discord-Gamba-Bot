import { SlashCommandBuilder } from '@discordjs/builders';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder() 
.setName('check-coins')
.setDescription('Tarkistaa kolikoitten määrän.');

export const execute = async (interaction) => {
    const userId = interaction.user.id;
    const userRef = doc(db, 'users', userId); // Reference to the specific user document

    try {
        const userDoc = await getDoc(userRef);

        if (!userDoc) {
            return interaction.reply({ content: 'Et oo PELISSÄ mukana.', ephemeral: true });
        }
        const userData = userDoc.data();
        const userCoins = userData.coins
        return interaction.reply({ content: `Sulla on ${userCoins} kolikkoa.`, ephemeral: true });

    } catch (error) {
        console.error("Error accessing Firestore:", error);
        return interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
    }

}
