import { SlashCommandBuilder } from '@discordjs/builders';
import { db } from '../firebaseconfig.js';
import {
    collection,
    getDocs,
    updateDoc,
    doc,
    setDoc,
    deleteDoc,
    getDoc
  } from "firebase/firestore";
  
  export const data = new SlashCommandBuilder() 
        .setName('opt-in')
        .setDescription('GAMBA GAMBA GAMBA');

        export const execute = async (interaction) => {
            const userId = interaction.user.id;
            const userRef = doc(db, 'users', userId); // Reference to the specific user document

            try {
                const userDoc = await getDoc(userRef);
        
                if (userDoc.exists()) {
                    return interaction.reply({ content: 'You are already opted-in!', ephemeral: true });
                }
        
                await setDoc(userRef, { coins: 0, activeTime: 0, optIn: true }, { merge: true });
        
                return interaction.reply({ content: 'You have successfully opted in to the game!', ephemeral: true });
        
            } catch (error) {
                console.error("Error accessing Firestore:", error);
                return interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
            }

    }
