import { NextRequest, NextResponse } from "next/server";
import { model } from "@/lib/gemini";
import { sendTelegramNotification } from "@/lib/telegram";

export async function POST(req: NextRequest) {
    try {
        console.log("--> API /api/chat received request");

        if (!process.env.GOOGLE_API_KEY) {
            console.error("CRITICAL: GOOGLE_API_KEY is missing in environment variables!");
            return NextResponse.json({ error: "Configuration Error: API Key missing" }, { status: 500 });
        }

        const { history, message, userInfo } = await req.json();
        console.log("User Message:", message);
        console.log("User Info:", userInfo);

        // Format history for Gemini (ensure correct role mapping)
        const geminiHistory = (history || []).map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: msg.parts.map((p: any) => ({ text: p.text }))
        }));

        // Use Gemini to process conversation/intent as usual
        console.log("Sending to Gemini...");
        const chat = model.startChat({
            history: geminiHistory,
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();
        console.log("Gemini Response:", response.slice(0, 100) + "...");

        // Check for completion token OR if we want to force send based on user intent (optional)
        // For now, we keep the [COMPLETE] logic from the prompt, but ENRICH it with userInfo
        if (response.includes("[COMPLETE]")) {
            console.log("Conversation marked as COMPLETE. Extracting data...");
            const parts = response.split("[COMPLETE]");
            const publicResponse = parts[0].trim();
            const jsonStr = parts[1].trim();

            try {
                const aiData = JSON.parse(jsonStr);

                // Construct enhanced data merging AI extraction + Lead Capture
                const finalData = {
                    location: userInfo?.location ? `https://www.google.com/maps?q=${userInfo.location.lat},${userInfo.location.lng}` : aiData.location,
                    phone: userInfo?.phone || aiData.phone,
                    name: userInfo?.name || "Non spécifié",
                    issue: aiData.issue
                };

                console.log("Sending Telegram notification for completed lead:", finalData.name);

                // Send Telegram Alert
                await sendTelegramNotification(
                    `🚨 *URGENCE DÉPANNAGE CONFIRMÉE*\n\n` +
                    `👤 *Client:* ${finalData.name}\n` +
                    `📱 *Tél:* \`${finalData.phone}\`\n` +
                    `📍 *Position:* [Ouvrir la carte](${finalData.location})\n` +
                    `🔧 *Problème:* ${finalData.issue}\n\n` +
                    `_Intervention requise immédiate._`
                );
            } catch (e) {
                console.error("Failed to parse completion data or send Telegram", e);
            }

            return NextResponse.json({ response: publicResponse, completed: true });
        }

        return NextResponse.json({ response, completed: false });
    } catch (error: any) {
        console.error("API Error Detailed:", error?.message, error?.stack);
        return NextResponse.json({ error: "Internal Server Error", details: error?.message }, { status: 500 });
    }
}
