import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing in .env");
}

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default AI;
