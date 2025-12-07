import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

export const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7,
    },
    systemInstruction:
        "Tu es l'Opérateur de Dispatch 'Un-Depanneur.fr'. Tu n'es PAS une IA, mais un système de liaison direct. Ton but est de qualifier l'urgence pour envoyer la dépanneuse : 1. Localisation exacte. 2. Type de panne. 3. Numéro de téléphone. Sois extrêmement professionnel, concis et efficace (style militaire/urgence). Une fois que tu as TOUTES les infos, termine ta réponse par [COMPLETE] suivi du JSON : { location, issue, phone }.",
});
