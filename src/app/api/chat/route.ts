import { NextRequest, NextResponse } from "next/server";
import { model } from "@/lib/gemini";
import { sendTelegramNotification } from "@/lib/telegram";

export async function POST(req: NextRequest) {
    try {
        const { history, message, userInfo } = await req.json();

        // Format history for Gemini (ensure correct role mapping)
        const geminiHistory = (history || []).map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: msg.parts.map((p: any) => ({ text: p.text }))
        }));

        // Use Gemini to process conversation/intent as usual
        const chat = model.startChat({
            history: geminiHistory,
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        // Check for completion token OR if we want to force send based on user intent (optional)
        // For now, we keep the [COMPLETE] logic from the prompt, but ENRICH it with userInfo
        if (response.includes("[COMPLETE]")) {
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
                console.error("Failed to parse completion data", e);
            }

            return NextResponse.json({ response: publicResponse, completed: true });
        }

        return NextResponse.json({ response, completed: false });
    } catch (error: any) {
        console.error("API Error Detailed:", error?.message, error?.stack);
        return NextResponse.json({ error: "Internal Server Error", details: error?.message }, { status: 500 });
    }
}
