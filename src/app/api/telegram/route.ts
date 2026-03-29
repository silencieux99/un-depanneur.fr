import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(req: Request) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return NextResponse.json({ error: 'Telegram credentials not configured' }, { status: 500 });
    }

    try {
        const { userInfo, history } = await req.json();

        let message = `🚨 **NOUVEAU LEAD BILL DÉPANNAGE** 🚨\n\n`;
        message += `👤 **Nom:** ${userInfo.name}\n`;
        message += `📞 **Tél:** ${userInfo.phone}\n`;

        if (userInfo.city) {
            message += `🏙️ **Ville:** ${userInfo.city}\n`;
        }
        if (userInfo.manualAddress) {
            message += `📝 **Adresse saisie:** ${userInfo.manualAddress}\n`;
        }
        if (userInfo.location) {
            message += `📍 **GPS:** https://www.google.com/maps?q=${userInfo.location.lat},${userInfo.location.lng}\n`;
        } else {
            message += `📍 **GPS:** Non disponible\n`;
        }

        if (history && history.length > 0) {
            message += `\n💬 **RÉCAPITULATIF CONVERSATION:**\n`;
            // Filter system messages if any, and limit length
            const conversation = history
                .filter((msg: any) => msg.role !== 'system')
                .map((msg: any) => `${msg.role === 'user' ? '👤' : '🤖'}: ${msg.parts[0].text}`)
                .join('\n');

            message += conversation.slice(0, 3000); // Telegram limit prevent
        } else {
            message += `\n(Pas de conversation enregistrée)`;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Telegram API Error:", error);
            return NextResponse.json({ error: 'Failed to send to Telegram' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
