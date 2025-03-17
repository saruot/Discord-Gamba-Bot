import { db } from '../firebaseconfig.js';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';


const resetAllUsers = async () => {
    try {
        console.log("🔄 Fetching all users...");

        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);

        if (snapshot.empty) {
            console.log("⚠️ No users found in the database.");
            return;
        }

        const resetPromises = [];

        snapshot.forEach((userDoc) => {
            const userId = userDoc.id;
            resetPromises.push(
                setDoc(doc(db, "users", userId), { coins: 0, activeTime: 0, duelLosses: 0, duelWins: 0, totalFlips: 0, totalWins: 0, }, { merge: true })
            );
        });

        await Promise.all(resetPromises);

        console.log(`✅ Successfully reset coins and active time for ${snapshot.size} users.`);
    } catch (error) {
        console.error("❌ Error resetting user data:", error);
    }
};

// Run the script
resetAllUsers();
