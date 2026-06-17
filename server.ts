import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set payload limits for processing files up to 100MB to accommodate larger PDFs/images
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // Initialize the Gemini client on the server side to protect user credentials
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
    : null;

  // Multimodal OCR extraction route
  app.post("/api/extract", async (req: express.Request, res: express.Response) => {
    try {
      if (!ai) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the backend. Please add it via Settings > Secrets.",
        });
      }

      const { files, customPrompt } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      const parts: any[] = [];

      // Convert files into standard raw base64 data parts for the Gemini API
      for (const file of files) {
        const rawBase64 = file.data.includes(",")
          ? file.data.split(",")[1]
          : file.data;

        parts.push({
          inlineData: {
            mimeType: file.type,
            data: rawBase64,
          },
        });
      }

      // Build system instruction incorporating the target master instructions and dynamic custom settings
      const userSettingPrompt = customPrompt || "";
      const systemInstruction = `You are an advanced OCR and Multimodal AI assistant specialized in academic, professional, and multimodal document analysis. Your task is to process the uploaded documents (PDFs) or images, which contain both Bengali and English text, with high precision.

### CORE INSTRUCTIONS:
1. Carefully scan the provided PDF/images and extract all visible text.
2. Maintain the linguistic integrity of both Bengali and English languages. Do not auto-translate unless explicitly asked.
3. If the user provides specific instructions in the [User_Prompt] variable below, strictly prioritize and follow those instructions to filter, format, summarize, or extract the text.
4. If the [User_Prompt] variable is EMPTY or contains no specific instructions, default to extracting the ENTIRE text from the document exactly as it is, maintaining a clean and readable format.

### FORMATTING & EXTRACTION REQUIREMENTS:
- **Physics or Math Formulas (পদার্থবিজ্ঞান ও গণিত সূত্র):** Extract physical equations, mathematical formulas, and scientific notations with high legibility. Format them using proper mathematical layouts so they can be copied cleanly without any misalignment. Use LaTeX markdown syntax where applicable (e.g., $$ ... $$ for blocks or $ ... $ inline) or clean standard notations.
- **Chemistry Reactions & Compounds (রসায়ন সংকেত ও বিক্রিয়া):** Correctly capture chemical formulas, reaction arrows, reduction states, and molecular representations. Ensure subscript and superscript numbers are extracted accurately and rendered as readable symbols (e.g. use proper Unicode subscript/superscript tags or LaTeX, so a compound like Washing Soda is exported cleanly as "Na₂CO₃ ⋅ 10H₂O" or equivalent format).
- **Tables, Matrices & Boxes (টেবিল বা বক্স রূপান্তর):** If the PDF or image includes grids, tables, visually highlighted text boxes, or columns, translate them into proper Markdown Table format (using | Column 1 | Column 2 | syntax) or clearly bounded markdown blocks. Do not break columns into unrelated lines. Keep the structural arrangement robust so data can be copied as-is into spreadsheet/text software.
- **Page Numbering (পৃষ্ঠা নম্বর ট্র্যাকিং):**
  - Always locate the page number if printed at the top-right corner, top-left corner, or header/footer borders of each PDF page or image.
  - Precede each page/image's output with a prominent, clear header line: "--- [পৃষ্ঠা নম্বর: <Extracted_Page_Num>] ---" or "--- [Page <Extracted_Page_Num>] ---".
  - If a page has NO visual page number printed in those corners, you MUST auto-assign a serial page marker based on the sequential index of the file processing (e.g., "--- [পৃষ্ঠা নম্বর: ১ (Auto Sequential Page)] ---" for the first file, "--- [পৃষ্ঠা নম্বর: ২ (Auto Sequential Page)] ---" for the second, and so on). Never merge texts of separate pages without these headers.

### USER CUSTOM SETTING:
[User_Prompt] = "${userSettingPrompt.replace(/"/g, '\\"')}"

### OUTPUT FORMAT:
- Provide a clean, copy-friendly markdown output.
- Avoid introducing any conversational filler (e.g., do not say "Here is the extracted text:"). Start directly with the result.`;

      parts.push({
        text: "Please analyze the uploaded document(s) carefully and perform OCR or content extraction in compliance with the system instructions.",
      });

      // Call the models/gemini-3.5-flash which is perfect for processing PDFs and multiple photos with high token limit
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1, // low temperature enforces more literal and precise OCR results
        },
      });

      const extractedText = response.text || "No text could be extracted from the provided files.";
      res.json({ text: extractedText });
    } catch (error: any) {
      console.error("Gemini OCR extraction error:", error);
      res.status(500).json({
        error: error.message || "An unexpected error occurred while processing the documents.",
      });
    }
  });

  // Express error handling middleware to ensure we always return JSON errors instead of default HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express App Error:", err);
    res.status(err.status || err.statusCode || 500).json({
      error: err.message || "An unexpected internal server error occurred.",
    });
  });

  // Client-side static handler and Vite proxy
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
