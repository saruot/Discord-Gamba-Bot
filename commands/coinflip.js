import { SlashCommandBuilder } from '@discordjs/builders';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseconfig.js';

export const data = new SlashCommandBuilder()
    .setName('flip')
    .setDescription('Flip a coin against the house!')
    .addIntegerOption(option => 
        option.setName('wager')
        .setDescription('Amount of coins to wager')
        .setRequired(true)
    );

export const execute = async (interaction) => {
    await interaction.deferReply(); // Acknowledge interaction first

    const userId = interaction.user.id;
    const wager = Number(interaction.options.getInteger('wager')); 

    if (isNaN(wager) || wager <= 0) {
        return interaction.editReply({ content: 'Vedon pitää olla positiivinen luku!' });
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        return interaction.editReply({ content: 'Sinun pitää rekisteröityä peliin ensin!' });
    }

    const userData = userDoc.data();
    if (userData.coins < wager) {
        return interaction.editReply({ content: 'Fyrkka ei riitä.' });
    }

    // Kopa rules
    const KopaId = '230312724901527552';


    const result = Math.random() < 0.5 ? 'kruuna' : 'klaava';
    let playerWins;
    if (userId === KopaId) {
        // 40% chance to win for the rigged user (ID: 230312724901527552)
        playerWins = Math.random() < 0.4; // 40% win chance
    } else {
        // 50/50 chance for others
        playerWins = Math.random() < 0.5; // 50% win chance
    }    
    const updatedCoins = playerWins ? userData.coins + wager : userData.coins - wager;

    // ✅ Track total games & wins
    const totalFlips = (userData.totalFlips || 0) + 1;
    const totalWins = playerWins ? (userData.totalWins || 0) + 1 : (userData.totalWins || 0);
    const winRate = ((totalWins / totalFlips) * 100).toFixed(2); // % Win rate rounded to 2 decimals

    // ✅ Update Firestore with new stats
    await setDoc(userRef, {
        ...userData,
        coins: updatedCoins,
        totalFlips,
        totalWins
    }, { merge: true });

    const outcomeMessage = playerWins
        ? `🎉 Helpot pois! Voitit ${wager} kolikkoa! Kolikko oli **${result}**.\n💰 Pankissa: **${updatedCoins}** kolikkoa.\n📊 `
        : `💀 Rakoon meni. Hävisit ${wager} kolikkoa. Kolikko oli **${result}**.\n💰 Jäljellä: **${updatedCoins}** kolikkoa.\n📊 `;

    await interaction.editReply({ content: outcomeMessage });
};
