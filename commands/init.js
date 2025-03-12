import { SlashCommandBuilder } from '@discordjs/builders';
db
export const data = new SlashCommandBuilder() 
        .setName('opt-in')
        .setDescription('GAMBA GAMBA GAMBA');

        export const execute = async (interaction) => {
            const userId = interaction.user.id;
            const userRef = db.collection('users').doc(userId);

            const userDoc = await userRef.get();
            if (userDoc.exists) {
                return interaction.reply({ content: 'You are already opted-in!', ephemeral: true });
            }

            await userRef.set({ coins: 0, activeTime: 0, optIn: true }, { merge: true });
            activePlayers.add(userId);
            return interaction.reply({ content: 'You have successfully opted in to the game!', ephemeral: true });

    }
