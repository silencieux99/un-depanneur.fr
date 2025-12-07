import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        // We can't easily list models with the high-level SDK in a simple way without looking up the docs for exact method which changed recently.
        // But we can try a raw fetch to the list endpoint to be sure.
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const modelNames = data.models?.map(m => m.name) || [];
        console.log("Available Models:", modelNames);
    } catch (e) {
        console.error(e);
    }
    console.log("Checking API Key:", process.env.GOOGLE_API_KEY ? "Present" : "Missing");
}

listModels();
