import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testFullFlow() {
    console.log("🚀 Starting Full Flow Test (Real Simulation)");

    const mockUserInfo = {
        name: "Test User Script",
        phone: "0699999999",
        location: { lat: 48.8566, lng: 2.3522 }
    };

    const apiUrl = 'http://localhost:3000/api/chat';

    // Simulate exactly what VoiceAssistant.tsx sends on first submit
    const locationTxt = `GPS: ${mockUserInfo.location.lat},${mockUserInfo.location.lng}`;
    const initialMessage = `[SYSTEM_INIT] Client: ${mockUserInfo.name}, Tél: ${mockUserInfo.phone}, ${locationTxt}. Début intervention. Message: J'ai un pneu crevé`;

    try {
        // TURN 1
        console.log("\n💬 [Turn 1] Sending Initial System Prompt...");
        const res1 = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [],
                message: initialMessage,
                userInfo: mockUserInfo
            })
        });

        if (!res1.ok) {
            const err = await res1.json();
            throw new Error(`API Error: ${res1.status} - ${err.details}`);
        }

        const data1 = await res1.json();
        console.log("🤖 AI Response 1:", data1.response);

        if (data1.completed) {
            console.log("✅ SUCCESS: Completed immediately (AI had all info)!");
        } else {
            console.log("ℹ️ Ongoing... sending confirmation");

            // Turn 2
            const res2 = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: [
                        { role: 'user', parts: [{ text: initialMessage }] },
                        { role: 'model', parts: [{ text: data1.response }] }
                    ],
                    message: "Oui, c'est bien ça. Envoyez la dépanneuse.", // Confirming
                    userInfo: mockUserInfo
                })
            });

            const data2 = await res2.json();
            console.log("🤖 AI Response 2:", data2.response);

            if (data2.completed) {
                console.log("\n✅ SUCCESS: Conversation Completed! Check Telegram!");
            } else {
                console.log("\n⚠️ WARNING: Still not completed.");
            }
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

testFullFlow();
