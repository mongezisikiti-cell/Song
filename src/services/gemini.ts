import { GoogleGenAI, Type } from "@google/genai";
import { SeminarOutline, StudyPlan } from "../types";
import { Tract } from "../data/tracts";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

const seminarSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The main title of the seminar" },
    description: { type: Type.STRING, description: "A brief overview of the seminar's purpose" },
    sessions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          duration: { type: Type.STRING, description: "e.g., '45 minutes'" },
          keyScriptures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of Bible verses (e.g., 'Matthew 6:9-13')"
          },
          talkingPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          detailedTalkingPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                point: { type: Type.STRING, description: "The core talking point" },
                deepDive: { type: Type.STRING, description: "A detailed, deep-dive explanation of the point" }
              },
              required: ["point", "deepDive"]
            },
            description: "A more in-depth version of each talking point for deeper study"
          },
          prayerFocus: { type: Type.STRING, description: "A specific prayer point for this session" }
        },
        required: ["id", "title", "duration", "keyScriptures", "talkingPoints"]
      }
    }
  },
  required: ["title", "description", "sessions"]
};

const studyPlanSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.NUMBER },
          title: { type: Type.STRING },
          passage: { type: Type.STRING, description: "Specific Bible passage (e.g., 'John 3:1-21')" },
          summary: { type: Type.STRING, description: "A brief summary of the passage's significance for today" },
          reflectionQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 thought-provoking reflection questions"
          }
        },
        required: ["day", "title", "passage", "summary", "reflectionQuestions"]
      }
    }
  },
  required: ["title", "description", "days"]
};

export async function generateSeminarTitle(topic: string, tract?: Tract): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  let prompt = "";
  if (tract) {
    prompt = `Generate a compelling, catchy, and spiritually grounded seminar title based on the religious tract titled: "${tract.title}".
    
    TRACT CONTENT:
    ${tract.fullText || tract.summary}
    
    MAIN SCRIPTURE: ${tract.mainScripture}
    
    Return only the title string, no other text or quotes.`;
  } else {
    prompt = `Generate a compelling, catchy, and spiritually grounded seminar title for the topic: "${topic}".
    Return only the title string, no other text or quotes.`;
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return response.text.trim().replace(/^["']|["']$/g, '');
}

export async function generateSeminarOutline(topic: string, tract?: Tract, customTitle?: string): Promise<SeminarOutline> {
  const model = "gemini-3.1-pro-preview";
  
  let prompt = "";
  if (tract) {
    prompt = `Create a detailed Bible teacher seminar outline based on the religious tract titled: "${tract.title}".
    
    TRACT CONTENT:
    ${tract.fullText || tract.summary}
    
    MAIN SCRIPTURE: ${tract.mainScripture}
    
    KEY PRAYER POINTS TO INCORPORATE:
    ${tract.prayerPoints.join("\n")}
    
    The seminar should expand on these themes, providing deep theological insights, practical applications, and a structured teaching flow across multiple sessions.
    The tone should be encouraging, scholarly, and spiritually grounded.`;
  } else {
    prompt = `Create a detailed Bible teacher seminar outline for the topic: "${topic}". 
    If the topic mentions "Prayer 6", focus on a 6-part series or a 6-step model for prayer.
    Include deep theological insights, practical applications, and relevant scripture references.
    The tone should be encouraging, scholarly, and spiritually grounded.`;
  }

  if (customTitle) {
    prompt += `\n\nIMPORTANT: Use exactly this title for the seminar: "${customTitle}". Do not generate a different one.`;
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: seminarSchema,
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text) as SeminarOutline;
}

export async function decodeScripture(reference: string, text: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Provide a "deeper decoding" of the following Bible scripture:
  
  REFERENCE: ${reference}
  TEXT: ${text}
  
  Include:
  1. CONTEXT: The historical or literary context of the passage.
  2. KEY WORDS: Brief word study on significant Greek/Hebrew terms if applicable.
  3. THEOLOGICAL INSIGHT: The core spiritual truth being conveyed.
  4. PRACTICAL APPLICATION: How a Bible teacher can apply this today.
  
  Format the response clearly with headings. Use a scholarly yet spiritually grounded tone.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return response.text.trim();
}

export async function generateFullSermon(outline: SeminarOutline): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `Based on the following seminar outline, write a full, powerful, and spiritually grounded sermon.
  
  TITLE: ${outline.title}
  DESCRIPTION: ${outline.description}
  
  SESSIONS:
  ${outline.sessions.map(s => `- ${s.title}: ${s.talkingPoints.join(', ')} (Scriptures: ${s.keyScriptures.join(', ')})`).join('\n')}
  
  The sermon should flow naturally from one point to the next, expanding on the theological insights and practical applications. 
  Include an introduction, body (expanding on each session), and a powerful conclusion with a call to action.
  Use a scholarly yet deeply spiritual and encouraging tone.
  Format the output in Markdown.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return response.text.trim();
}

export async function generatePodcastScript(outline: SeminarOutline): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `Based on the following seminar outline, write a dynamic and engaging "Podcast / Panel Discussion" script.
  
  TITLE: ${outline.title}
  DESCRIPTION: ${outline.description}
  
  SESSIONS:
  ${outline.sessions.map(s => `- ${s.title}: ${s.talkingPoints.join(', ')}`).join('\n')}
  
  The script should feature 3 distinct voices:
  1. HOST (A warm, curious interviewer)
  2. DR. ELIAS (A deep theological scholar)
  3. SARAH (A practical, "on-the-ground" ministry leader)
  
  The discussion should be lively, with back-and-forth dialogue, deep insights, and practical "takeaways" for the listeners. 
  It should feel like a real, high-quality Christian podcast.
  Format the output in Markdown, clearly labeling each speaker.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return response.text.trim();
}
export async function generateSpecializedPrayers(outline: SeminarOutline): Promise<any[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Based on the themes of the seminar "${outline.title}", generate a comprehensive set of specialized prayer points (at least 15 total).
  Each prayer point MUST be SCRIPTURE-BASED and categorized according to this specific hierarchy:
  
  1. Praise and worship 
  2. Asking for forgiveness, mercy, grace, saying sorry
  3. Blood of Jesus 
  4. Holy Spirit
  5. WAR FARE DANGEROUS DEEP AND ON TARGET FIRE FIRE (x 4) aimed at the enemy and all his cohorts. 
  6. Supplication prayer, requesting, enquiring
  7. A claim of a promise 
  8. Intercessory prayer
  9. Thanksgiving prayer
  
  CRITICAL REQUIREMENT: The category "WAR FARE DANGEROUS DEEP AND ON TARGET FIRE FIRE (x 4)" MUST contain at least 5 distinct, deep, and highly targeted prayer points aimed at dismantling the enemy's works related to the seminar theme.
  
  For each prayer point, provide:
  - CATEGORY: One of the 9 categories above.
  - SCRIPTURE: A relevant Bible verse (reference and text).
  - PRAYER: A powerful, targeted prayer based on that scripture and the seminar theme.
  
  Return the result as a JSON array of objects with keys: category, scripture, prayer.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            scripture: { type: Type.STRING },
            prayer: { type: Type.STRING }
          },
          required: ["category", "scripture", "prayer"]
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text);
}

export async function generateVideoTeaser(outline: SeminarOutline): Promise<string> {
  // First, generate a highly descriptive prompt for Veo
  const genModel = "gemini-3-flash-preview";
  const promptGen = `Generate a highly descriptive, cinematic, and spiritually evocative video generation prompt (for a model like Veo) that captures the essence of a seminar titled "${outline.title}".
  
  DESCRIPTION: ${outline.description}
  
  The prompt should describe a 1080p, 16:9 video. It should be abstract yet powerful, using light, nature, or symbolic religious imagery. 
  Avoid text in the video. Focus on high-quality lighting, slow camera movement, and a sense of awe.
  
  Return ONLY the prompt text.`;

  const promptResponse = await ai.models.generateContent({
    model: genModel,
    contents: [{ parts: [{ text: promptGen }] }],
  });

  const videoPrompt = promptResponse.text?.trim() || `A cinematic, spiritually evocative scene representing ${outline.title}, high-quality lighting, slow movement.`;

  // Now, call Veo
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-lite-generate-preview',
    prompt: videoPrompt,
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: '16:9'
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");

  // Fetch with API key
  const videoResponse = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
}

export async function generateStudyPlan(topicOrBook: string, durationDays: number): Promise<Partial<StudyPlan>> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `Create a detailed Bible study plan for the topic or book: "${topicOrBook}" for a duration of ${durationDays} days.
  
  The plan should include:
  - A cohesive title and description.
  - One specific Bible passage per day.
  - A theological summary/devotional for each day.
  - 3-5 reflection questions for each day that help the user apply the scripture to their life.
  
  The tone should be encouraging, insightful, and spiritually enriching.`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: studyPlanSchema,
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  const data = JSON.parse(response.text);
  return {
    ...data,
    durationDays,
    createdAt: new Date().toISOString()
  };
}
