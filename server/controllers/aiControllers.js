import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import FormData from "form-data";
import fs from "fs";
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { GoogleGenerativeAI } from "@google/generative-ai";
// import AI from "../config/openai.js";

// ✅ SINGLE CORRECT PDF LIB

// ───────────────────────────────────────────────
// ✅ OPENAI / GEMINI CLIENT
// ───────────────────────────────────────────────
const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta",
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// ───────────────────────────────────────────────
// GENERATE ARTICLE
// ───────────────────────────────────────────────
export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth(); // Clerk authentication
    const { prompt, length } = req.body;

    if (!prompt) {
      return res.json({ success: false, message: "Prompt is required" });
    }

    const finalPrompt = `
Write a full article about: "${prompt}".
Approximate length: ${length} words.
Use headings, paragraphs, and markdown formatting.
`;

    // Gemini AI call
    const response = await AI.chat.completions.create({
      model: "gemini-3-flash-preview",  // or gemini-3-flash-preview
      messages: [{ role: "user", content: finalPrompt }],
      temperature: 0.7,
      max_tokens: Math.min(length * 2, 1600) // ensure full article
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      return res.json({ success: false, message: "AI returned empty content" });
    }

    // Save to database
    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${prompt}, ${content}, 'article')
    `;

    res.json({ success: true, content });

  } catch (error) {
    console.error("ARTICLE ERROR:", error.message);
    res.json({ success: false, message: error.message });
  }
};




// ───────────────────────────────────────────────
// GENERATE BLOG TITLE
// ───────────────────────────────────────────────
export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    // if (plan !== "premium" && free_usage >= 10) {
    //   return res.json({
    //     success: false,
    //     message: "Limit reached. Upgrade to continue.",
    //   });
    // }

    const response = await AI.chat.completions.create({
      model: "gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const content = response.choices[0].message.content;

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${prompt}, ${content}, 'blog-article')
    `;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    res.json({ success: true, content });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};


// ───────────────────────────────────────────────
// GENERATE IMAGE (CLIPDROP + CLOUDINARY)
// ───────────────────────────────────────────────
export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;

    const formData = new FormData();
    formData.append("prompt", prompt);

    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: {
          "x-api-key": process.env.CLIPDROP_API_KEY,
          ...formData.getHeaders(),
        },
        responseType: "arraybuffer",
      }
    );

    const base64Image =
      `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;

    const { secure_url } = await cloudinary.uploader.upload(base64Image);

    await sql`
      INSERT INTO creations (user_id, prompt, content, type, publish)
      VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
    `;

    res.json({ success: true, content: secure_url });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};


// ───────────────────────────────────────────────
// REMOVE IMAGE BACKGROUND
// ───────────────────────────────────────────────
export const removeImageBackground = async (req, res) => {
  try {
    const { userId } = req.auth();
    const image = req.file;

    if (!image) {
      return res.json({ success: false, message: "No image uploaded" });
    }

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          effect: "background_removal",
          background_removal: "remove_the_background",
        },
      ],
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
    `;

    res.json({ success: true, content: secure_url });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};


// ───────────────────────────────────────────────
// REMOVE OBJECT FROM IMAGE
// ───────────────────────────────────────────────
export const removeImageObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
    const image = req.file;

    if (!image) {
      return res.json({ success: false, message: "No image uploaded" });
    }

    const { public_id } = await cloudinary.uploader.upload(image.path);

    const imageUrl = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:${object}` }],
      resource_type: "image",
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')
    `;

    res.json({ success: true, content: imageUrl });

  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};


// ───────────────────────────────────────────────
// ✅ RESUME REVIEW – PDF (STABLE)
// ───────────────────────────────────────────────

export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    // Official SDK uses 'generateContent'
    const result = await model.generateContent(`Review this resume: ${pdfData.text}`);
    const content = result.response.text();

    await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Resume Review', ${content}, 'resume-review')`;

    res.json({ success: true, content });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};