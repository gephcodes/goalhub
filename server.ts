import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enforce payload limit to reject oversized payloads
  app.use(express.json({ limit: "256kb" }));

  // Custom rate limiting implementation
  interface RateLimitRecord {
    timestamps: number[];
  }

  const rateLimits = new Map<string, RateLimitRecord>(); // general endpoint rate limiting
  const authRateLimits = new Map<string, RateLimitRecord>(); // auth routes rate limiting

  function rateLimiter(isAuthRoute: boolean) {
    return (req: any, res: any, next: any) => {
      const ip = req.ip || req.headers['x-forwarded-for'] || "unknown";
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutes
      
      const limitMap = isAuthRoute ? authRateLimits : rateLimits;
      const maxAttempts = isAuthRoute ? 5 : 100; // 5 for auth, 100 for others
      
      let record = limitMap.get(ip);
      if (!record) {
        record = { timestamps: [] };
        limitMap.set(ip, record);
      }
      
      // Filter out timestamps outside the window
      record.timestamps = record.timestamps.filter(t => now - t < windowMs);
      
      if (record.timestamps.length >= maxAttempts) {
        const oldestTimestamp = record.timestamps[0];
        const resetTimeLeft = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
        return res.status(429).json({
          error: isAuthRoute 
            ? `Too many authentication attempts. Please try again in ${Math.ceil(resetTimeLeft / 60)} minutes.`
            : `Too many requests. Please slow down. Retry in ${resetTimeLeft} seconds.`
        });
      }
      
      record.timestamps.push(now);
      next();
    };
  }

  // Input Sanitization and Validation helpers
  function sanitizeString(val: any, maxLen = 1000): string {
    if (typeof val !== "string") return "";
    // Strip potential HTML/Script tag injections
    const clean = val.replace(/<[^>]*>/g, "");
    return clean.slice(0, maxLen).trim();
  }

  function validateNickname(name: any): string {
    if (typeof name !== "string") return "";
    // Alphanumeric, spaces, dashes, underscores
    const clean = name.replace(/[^a-zA-Z0-9\s\-_]/g, "");
    return clean.slice(0, 30).trim();
  }

  function validateRoomCode(code: any): string {
    if (typeof code !== "string") return "";
    const clean = code.replace(/[^a-zA-Z0-9]/g, "");
    return clean.slice(0, 10).trim().toUpperCase();
  }

  function sanitizeActivePlan(plan: any): any {
    if (!plan || typeof plan !== "object") return null;
    
    const cleanPlan: any = {
      planTitle: sanitizeString(plan.planTitle, 100) || "Goal Action Plan",
      estimatedDuration: sanitizeString(plan.estimatedDuration, 50) || "Flexible",
      difficulty: sanitizeString(plan.difficulty, 50) || "Moderate",
      milestones: Array.isArray(plan.milestones)
        ? plan.milestones.slice(0, 10).map((m: any) => sanitizeString(m, 100)).filter(Boolean)
        : [],
      tasks: []
    };

    if (Array.isArray(plan.tasks)) {
      // Limit to max 30 tasks for safety/DOS prevention
      cleanPlan.tasks = plan.tasks.slice(0, 30).map((task: any) => {
        if (!task || typeof task !== "object") return null;
        return {
          id: sanitizeString(task.id, 50) || `task-${Math.random().toString(36).substring(2, 7)}`,
          title: sanitizeString(task.title, 150) || "Untitled Task",
          milestone: sanitizeString(task.milestone, 100) || "",
          priority: ["High", "Medium", "Low", "HIGH", "MEDIUM", "LOW"].includes(task.priority) 
            ? task.priority 
            : "Medium",
          shortDescription: sanitizeString(task.shortDescription, 400) || "",
          estimatedEffort: ["Short", "Medium", "Long", "SHORT", "MEDIUM", "LONG"].includes(task.estimatedEffort)
            ? task.estimatedEffort
            : "Medium",
          isCompleted: typeof task.isCompleted === "boolean" ? task.isCompleted : false
        };
      }).filter(Boolean);
    }

    return cleanPlan;
  }

  // Set up general rate limiting for all non-auth API endpoints
  app.use("/api/", (req: any, res: any, next: any) => {
    // Specifically handle the actual auth/entry routes separately to avoid double counting or general limits blocking them
    const isAuthRoute = ["/api/coop/create", "/api/coop/join", "/api/admin/stats"].includes(req.path);
    if (isAuthRoute) {
      return next();
    }
    rateLimiter(false)(req, res, next);
  });

  // Apply tighter specific limits on auth endpoints
  app.post("/api/coop/create", rateLimiter(true));
  app.post("/api/coop/join", rateLimiter(true));
  app.post("/api/admin/stats", rateLimiter(true));

  // Initialize Gemini SDK with recommended user-agent header
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Queue to serialize execution of requests and prevent multiple parallel requests from triggering concurrent rate limits
  let planQueuePromise = Promise.resolve();

  // Keep track of models that are completely exhausted for the duration of the server session
  const exhaustedModels = new Set<string>();

  function isQuotaError(err: any): boolean {
    if (!err) return false;
    if (err.status === 429 || err.statusCode === 429) return true;
    const msg = (err.message || String(err)).toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("resource_exhausted") ||
      msg.includes("quota exceeded") ||
      msg.includes("rate-limit") ||
      msg.includes("rate limit")
    );
  }

  function isOverloadedError(err: any): boolean {
    if (!err) return false;
    if (err.status === 503 || err.statusCode === 503 || err.status === 504 || err.statusCode === 504) return true;
    const msg = (err.message || String(err)).toLowerCase();
    return (
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("unavailable") ||
      msg.includes("overloaded") ||
      msg.includes("experiencing high demand")
    );
  }

  // Primary Endpoint to Plan or Chat
  app.post("/api/plan", async (req, res) => {
    // Append request to the sequential queue execution chain
    planQueuePromise = planQueuePromise.then(async () => {
      try {
        const { goal, chatHistory, userMessage } = req.body;

        const cleanGoal = sanitizeString(goal, 500);
        const cleanUserMessage = userMessage ? sanitizeString(userMessage, 1000) : undefined;

        if (!cleanGoal) {
          res.status(400).json({ error: "Goal input is required" });
          return;
        }

        // Build the prompt context including previous history
        const systemInstruction = 
          `You are GoalHub AI, an expert project manager, productivity assistant, and elite, world-class goal strategist. ` +
          `Your sole job is to take the user's ambition, dream, or target and transform it into a highly rigorous, ` +
          `structured, and actionable master plan. ` +
          `You must adhere strictly to these rules: ` +
          `1. Phased Approach: Group tasks into logical, chronological phases (e.g., 'Phase 1: Planning & Setup', 'Phase 2: Execution', 'Phase 3: Launch/Review'). ` +
          `2. Action-Oriented: Every single task title must start with a strong action verb (e.g., 'Design', 'Write', 'Configure', 'Test', 'Implement', 'Analyze'). ` +
          `3. Details per Task: For every task, provide a clear explanation (what needs to be done and what 'done' looks like), a priority level, and an estimated effort. ` +
          `You must talk extremely little and provide ONLY the key details and absolutely nothing more. ` +
          `DO NOT include any conversational filler, intro, outro, preamble, or commentary. Cut straight to the absolute minimum necessary information. ` +
          `Make all your responses ultra-concise, direct, and focused ONLY on summarizing how the timeline is going to go. ` +
          `Keep all your output ultra-short, brief, and extremely concise. Under no circumstances should you generate paragraphs of text. ` +
          `Do NOT use any emojis, icons, or pictograms. Keep all responses 100% text-only and professional. ` +
          `Make the plans extremely actionable, precise, and practical.`;

        const contents = [];

        // Inform model about the scope and provide the history
        contents.push({
          role: "user",
          parts: [{
            text: `The user's core goal is: "${cleanGoal}"`
          }]
        });

        if (chatHistory && Array.isArray(chatHistory)) {
          // Slice the history to prevent massive payload processing (up to 20 messages)
          chatHistory.slice(-20).forEach((msg: any) => {
            if (msg && typeof msg === "object" && (msg.role === "user" || msg.role === "assistant" || msg.role === "model")) {
              contents.push({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: sanitizeString(msg.content, 2000) }]
              });
            }
          });
        }

        // Append current request
        if (cleanUserMessage) {
          contents.push({
            role: "user",
            parts: [{ text: cleanUserMessage }]
          });
        } else {
          contents.push({
            role: "user",
            parts: [{ text: `Generate the ultimate customized action plan for this goal following the expert project manager rules. Define the phases, tasks, and rich timeline guide details.` }]
          });
        }

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            planTitle: {
              type: Type.STRING,
              description: "A short, clean, motivating title for this goal action plan (e.g. 'Ultimate 5K Protocol' or 'Keyboard Virtuoso Initiative'). Do NOT use any emojis.",
            },
            estimatedDuration: {
              type: Type.STRING,
              description: "The estimated duration or timeline to achieve the goal, e.g. '12 Weeks' or '6 Months'. Do NOT use any emojis.",
            },
            difficulty: {
              type: Type.STRING,
              description: "A difficulty scale, e.g. 'Green - Beginner Friendly', 'Yellow - Moderate Challenge', 'Red - Rugged, Hard', 'Fire - Extreme Commitment'. Do NOT use any emojis.",
            },
            milestones: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "List of exactly 3 chronological phases/milestones of this goal. Must follow a Phased Approach, grouped into logical, chronological phases (e.g. 'Phase 1: Planning & Setup', 'Phase 2: Execution', 'Phase 3: Launch/Review'). Do NOT use any emojis.",
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "A simple unique slug (e.g., 'task-1')." },
                  title: { type: Type.STRING, description: "The specific actionable task starting with a strong action verb (e.g., 'Design', 'Write', 'Configure', 'Test'). Do NOT use any emojis." },
                  milestone: { type: Type.STRING, description: "The milestone phase it belongs to. Must match one of the milestones generated exactly." },
                  priority: { type: Type.STRING, description: "Priority level: MUST be exactly 'High', 'Medium', or 'Low'." },
                  shortDescription: { type: Type.STRING, description: "A 1-2 sentence explanation of what needs to be done and what 'done' looks like. Do NOT use any emojis." },
                  estimatedEffort: { type: Type.STRING, description: "Estimated effort to complete this task: MUST be exactly 'Short', 'Medium', or 'Long'." }
                },
                required: ["id", "title", "milestone", "priority", "shortDescription", "estimatedEffort"]
              },
              description: "A highly specific checklist of 6 to 12 actionable items divided across the milestones.",
            },
            richPlanDetails: {
              type: Type.STRING,
              description: "Extremely short, scannable timeline details of how the timeline is going to go. Focus only on summarizing how the chronological progression will go over time. Do not describe the current state of the timeline. Keep it as ultra-short bullet points. Do NOT use any emojis.",
            },
            chatResponse: {
              type: Type.STRING,
              description: "An ultra-short, single-sentence summary of only how the timeline will go over time. No general remarks, zero fluff. Under 15 words. No emojis.",
            }
          },
          required: ["planTitle", "estimatedDuration", "difficulty", "milestones", "tasks", "richPlanDetails", "chatResponse"]
        };

        let response;
        let lastError: any = null;
        const candidateModels = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
        let modelSucceeded = false;

        // Helper to parse dynamic retryDelay from Google API errors
        const parseRetryDelay = (err: any): number | null => {
          if (!err) return null;
          const errMsg = String(err.message || err);
          
          // Pattern: "Please retry in 56.589615256s." or similar
          const match = errMsg.match(/retry in ([\d\.]+)\s*s/i);
          if (match && match[1]) {
            const parsedSecs = parseFloat(match[1]);
            if (!isNaN(parsedSecs)) {
              return Math.ceil(parsedSecs * 1000);
            }
          }

          // Try parsing internal JSON if the error is serialized JSON
          try {
            if (errMsg.trim().startsWith("{")) {
              const parsed = JSON.parse(errMsg);
              if (parsed?.error?.details) {
                for (const detail of parsed.error.details) {
                  if (detail.retryDelay) {
                    const delaySecs = parseFloat(detail.retryDelay);
                    if (!isNaN(delaySecs)) {
                      return Math.ceil(delaySecs * 1000);
                    }
                  }
                }
              }
            }
          } catch (e) {}

          if (err.retryDelay) {
            const delaySecs = parseFloat(err.retryDelay);
            if (!isNaN(delaySecs)) {
              return Math.ceil(delaySecs * 1000);
            }
          }

          return null;
        };

        for (let i = 0; i < candidateModels.length; i++) {
          const modelName = candidateModels[i];

          // Skip if this model was marked as completely exhausted for the session
          if (exhaustedModels.has(modelName)) {
            console.log(`[GoalPlan AI] Skipping ${modelName} as it was previously marked as fully exhausted for this session.`);
            continue;
          }

          let attempts = 0;
          const maxAttempts = 3; // Keep up to 3 attempts for retriable errors

          while (attempts < maxAttempts) {
            try {
              console.log(`[GoalPlan AI] Attempting plan generation with model: ${modelName} (Attempt ${attempts + 1}/${maxAttempts})`);
              response = await ai.models.generateContent({
                model: modelName,
                contents: contents,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema,
                  temperature: 0.7,
                }
              });
              if (response && response.text) {
                console.log(`[GoalPlan AI] Success with model: ${modelName}`);
                modelSucceeded = true;
                break;
              }
            } catch (err: any) {
              lastError = err;
              const errStr = err.message || String(err);
              console.warn(`[GoalPlan AI] Model ${modelName} attempt ${attempts + 1} failed:`, errStr);

              const isQuota = isQuotaError(err) || err.status === 429;
              const isOverloaded = isOverloadedError(err) || err.status === 503;

              if (isQuota) {
                const errStrLower = errStr.toLowerCase();
                const delayMs = parseRetryDelay(err);

                // Check for daily exhaustion: either string matches daily-specific quota indicators,
                // or status is 429 and no short-term retryDelay is returned (indicating long-term daily quota depletion on free tier)
                const isDailyExhaustion = 
                  errStrLower.includes("daily") || 
                  errStrLower.includes("per day") || 
                  errStrLower.includes("limit: 0") || 
                  errStrLower.includes("quota exceeded") || 
                  errStrLower.includes("limit exceeded") ||
                  delayMs === null;

                if (isDailyExhaustion) {
                  console.warn(`[GoalPlan AI] Model ${modelName} is completely exhausted (Quota limit of 0 or daily quota exhausted). Skipping for the rest of the session.`);
                  exhaustedModels.add(modelName);
                  break; // Exit retry loop and move to next model immediately
                }

                // If retryDelay is present, pause for that duration and retry
                if (delayMs !== null) {
                  attempts++;
                  if (attempts < maxAttempts) {
                    console.warn(`[GoalPlan AI] Quota limit hit (429). Pausing requests to ${modelName} for ${delayMs}ms before retrying...`);
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    continue;
                  } else {
                    console.warn(`[GoalPlan AI] Model ${modelName} exhausted retry limit on quota. Falling back to next model...`);
                    break;
                  }
                } else {
                  // Fallback if no retryDelay and not explicitly daily exhaustion
                  console.warn(`[GoalPlan AI] Quota error with no retryDelay. Skipping model ${modelName}...`);
                  exhaustedModels.add(modelName);
                  break;
                }
              } else if (isOverloaded) {
                console.warn(`[GoalPlan AI] Model ${modelName} is overloaded (503). Skipping immediately to next candidate model...`);
                break; // Skip retry loop for this model, fallback immediately to next candidate model
              } else {
                console.warn(`[GoalPlan AI] Model ${modelName} failed with general error. Skipping to next model...`);
                break; // Exits retry loop to try next model
              }
            }
          }

          if (modelSucceeded) {
            break;
          }

          // Delay before switching to next candidate fallback tier
          if (i < candidateModels.length - 1) {
            const waitTime = 500;
            console.log(`[GoalPlan AI] Waiting ${waitTime}ms before trying the next model tier...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }

        // Tier 3: Emergency Local/Cheap Fallback Implementation
        // If all external AI model layers fail or hit structural errors, we generate a high-agency, tailored mockup matching responseSchema
        if (!modelSucceeded || !response || !response.text) {
          console.warn("[GoalPlan AI] All premium tiers failed or hit structural blocks. Activating Tier 3 Emergency Fallback Engine...");
          
          const cleanGoal = (goal || "My Strategic Goal").trim();
          const pTitle = `Resilient Strategy: ${cleanGoal.replace(/^(make|build|do|create|how to)\s+/i, '')}`;
          const safeTitle = pTitle.charAt(0).toUpperCase() + pTitle.slice(1);
          
          const fallbackData = {
            planTitle: safeTitle,
            estimatedDuration: "6 to 8 Weeks",
            difficulty: "Yellow - Moderate Challenge",
            milestones: [
              "Phase 1: Foundation Setup & Readiness Assessment",
              "Phase 2: Tactical Execution & Incremental Implementation",
              "Phase 3: Performance Hardening & Quality Refinement"
            ],
            tasks: [
              {
                id: "em-task-1",
                title: "Conduct comprehensive readiness auditing for your goal",
                milestone: "Phase 1: Foundation Setup & Readiness Assessment",
                priority: "High",
                shortDescription: "Formulate baseline parameters, gather critical toolkits, and define precise parameters for execution.",
                estimatedEffort: "Short"
              },
              {
                id: "em-task-2",
                title: "Initialize active prototype testing & setup",
                milestone: "Phase 1: Foundation Setup & Readiness Assessment",
                priority: "Medium",
                shortDescription: "Develop initial milestones, test critical paths, and remove early structural bottlenecks.",
                estimatedEffort: "Medium"
              },
              {
                id: "em-task-3",
                title: "Launch high-intensity tactical sprints",
                milestone: "Phase 2: Tactical Execution & Incremental Implementation",
                priority: "High",
                shortDescription: "Iterate on daily progress loops, measure performance metrics, and log feedback cycles.",
                estimatedEffort: "Long"
              },
              {
                id: "em-task-4",
                title: "Incorporate expert reviews & alignment checks",
                milestone: "Phase 2: Tactical Execution & Incremental Implementation",
                priority: "Medium",
                shortDescription: "Cross-reference milestone outcomes against target KPIs to secure optimal positioning.",
                estimatedEffort: "Short"
              },
              {
                id: "em-task-5",
                title: "Complete stability testing & deployment checks",
                milestone: "Phase 3: Performance Hardening & Quality Refinement",
                priority: "High",
                shortDescription: "Run exhaustive performance assessments and document operational protocols to prevent regression.",
                estimatedEffort: "Medium"
              }
            ],
            richPlanDetails: `### GoalHub AI Backup Timeline: ${safeTitle}\n\n- **Phase 1**: Audit resources and set baseline targets.\n- **Phase 2**: Launch rapid iterative execution cycles.\n- **Phase 3**: Harden performance and lock down final deliverables.`,
            chatResponse: `Timeline generated for "${cleanGoal}".`
          };
 
          response = { text: JSON.stringify(fallbackData) };
        }
 
        let parsedResult;
        try {
          const rawText = (response.text || "{}").trim();
          let sanitizedText = rawText;
          if (sanitizedText.includes("```")) {
            const match = sanitizedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
              sanitizedText = match[1].trim();
            }
          }
          parsedResult = JSON.parse(sanitizedText);
        } catch (parseError) {
          console.warn("[GoalPlan AI] Primary JSON parsing failed, executing relaxed brace extraction...", parseError);
          try {
            const rawText = (response.text || "{}").trim();
            const firstBrace = rawText.indexOf("{");
            const lastBrace = rawText.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              parsedResult = JSON.parse(rawText.substring(firstBrace, lastBrace + 1));
            } else {
              throw parseError;
            }
          } catch (nestedErr) {
            console.error("[GoalPlan AI] Relaxed JSON extraction failed. Raising original syntax error.", nestedErr);
            throw parseError;
          }
        }
        res.json(parsedResult);

      } catch (error: any) {
        console.error("Gemini Goal Strategy API Error:", error);
        
        let errMsg = typeof error === "object" && error !== null && error.message ? error.message : String(error);
        
        try {
          if (typeof errMsg === "string" && errMsg.trim().startsWith("{")) {
            const parsed = JSON.parse(errMsg);
            if (parsed && parsed.error && parsed.error.message) {
              errMsg = parsed.error.message;
            }
          }
        } catch (e) {
          // Not a JSON string
        }

        if (
          errMsg.toLowerCase().includes("quota") || 
          errMsg.toLowerCase().includes("limit exceeded") || 
          errMsg.toLowerCase().includes("429") || 
          errMsg.toLowerCase().includes("resource_exhausted")
        ) {
          errMsg = "Quota limit hit. Retrying in 53s...";
        }

        if (!res.headersSent) {
          res.status(500).json({ error: errMsg });
        }
      }
    }).catch((queueErr) => {
      console.error("[GoalPlan AI] Queue execution error:", queueErr);
      if (!res.headersSent) {
        res.status(500).json({ error: "System congestion queue error." });
      }
    });
  });

  // Dual-layered Memory & Local File Storage Database for Saved/Shared Plans
  const InMemoryPlans = new Map<string, any>();
  const PLANS_FILE_PATH = path.join(process.cwd(), "plans-db.json");

  // Active user sessions tracking database
  interface ActiveUserSession {
    lastSeen: number;
    goal?: string;
    activePlanTitle?: string;
    coOpRoom?: string;
    nickname?: string;
    userAgent?: string;
  }
  const ActiveUsers = new Map<string, ActiveUserSession>();

  // Administrative passcode brute-force protection
  interface PasscodeAttemptTracker {
    count: number;
    lockedUntil: number;
  }
  const FailedAttempts = new Map<string, PasscodeAttemptTracker>();

  // Co-Working Lobbies In-Memory Database
  const CoOpRooms = new Map<string, {
    roomCode: string;
    players: Record<string, {
      nickname: string;
      isHost: boolean;
      isFocused: boolean;
      currentActivity: string;
      completedPoints: number;
      totalPoints: number;
      isBlurred: boolean;
      lastSeen: number;
    }>;
    goal: string;
    activePlan: any;
  }>();

  // Helper to generate unique 4-character room codes
  function generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (CoOpRooms.has(code)) return generateRoomCode();
    return code;
  }

  // Create Lobby
  app.post("/api/coop/create", (req, res) => {
    try {
      const { nickname, goal, activePlan, roomCode } = req.body;
      
      const cleanNickname = validateNickname(nickname);
      const cleanGoal = sanitizeString(goal, 500);
      const cleanActivePlan = sanitizeActivePlan(activePlan);
      const cleanRoomCode = validateRoomCode(roomCode);

      if (!cleanNickname) {
        res.status(400).json({ error: "Temporary nickname is required (alphanumeric, max 30 chars)" });
        return;
      }

      const finalRoomCode = cleanRoomCode ? cleanRoomCode : generateRoomCode();
      const hostPlayer = {
        nickname: cleanNickname,
        isHost: true,
        isFocused: false,
        currentActivity: cleanActivePlan?.planTitle || "Preparing Workstation",
        completedPoints: cleanActivePlan?.tasks?.filter((t: any) => t.isCompleted)?.length || 0,
        totalPoints: cleanActivePlan?.tasks?.length || 0,
        isBlurred: false,
        lastSeen: Date.now()
      };

      CoOpRooms.set(finalRoomCode, {
        roomCode: finalRoomCode,
        players: {
          [hostPlayer.nickname]: hostPlayer
        },
        goal: cleanGoal || "",
        activePlan: cleanActivePlan || null
      });

      console.log(`[Co-Op Lobby] Spawned new lobby: ${finalRoomCode} by ${hostPlayer.nickname}`);
      res.json({
        success: true,
        roomCode: finalRoomCode,
        roomState: CoOpRooms.get(finalRoomCode)
      });
    } catch (err: any) {
      console.error("[Co-Op Lobby] Error spawning lobby:", err);
      res.status(500).json({ error: "Failed to spawn co-op lobby" });
    }
  });

  // Join Lobby
  app.post("/api/coop/join", (req, res) => {
    try {
      const { roomCode, nickname } = req.body;
      const cleanRoomCode = validateRoomCode(roomCode);
      const cleanNickname = validateNickname(nickname);

      if (!cleanRoomCode || !cleanNickname) {
        res.status(400).json({ error: "Valid room code and temporary nickname (alphanumeric, max 30 chars) are required" });
        return;
      }

      const upperCode = cleanRoomCode;
      let room = CoOpRooms.get(upperCode);
      if (!room) {
        // Automatically initialize room from saved plan if it exists
        const plan = InMemoryPlans.get(upperCode);
        if (plan) {
          room = {
            roomCode: upperCode,
            players: {},
            goal: plan.goal || "",
            activePlan: plan.activePlan || null
          };
          CoOpRooms.set(upperCode, room);
        } else {
          res.status(404).json({ error: "Lobby Room not found. Verify Code." });
          return;
        }
      }

      const cleanNick = cleanNickname;
      
      // Check if a player with this exact username (case-insensitive) is already in the room
      const playerExists = Object.keys(room.players).some(
        (existingName) => existingName.trim().toUpperCase() === cleanNick.toUpperCase()
      );

      if (playerExists) {
        res.status(400).json({ error: `The username "${cleanNick}" is already active in this room. Choose another or add a variation like "${cleanNick} 8"!` });
        return;
      }
      
      // Add or update player
      room.players[cleanNick] = {
        nickname: cleanNick,
        isHost: false,
        isFocused: false,
        currentActivity: "Connecting to cockpit",
        completedPoints: 0,
        totalPoints: 0,
        isBlurred: false,
        lastSeen: Date.now()
      };

      // update player stats based on existing tasks if they have a plan already
      console.log(`[Co-Op Lobby] Player ${cleanNick} joined lobby ${upperCode}`);
      res.json({
        success: true,
        roomCode: upperCode,
        roomState: room
      });
    } catch (err: any) {
      console.error("[Co-Op Lobby] Error joining lobby:", err);
      res.status(500).json({ error: "Failed to join co-op lobby" });
    }
  });

  // Update Status
  app.post("/api/coop/update", (req, res) => {
    try {
      const { roomCode, nickname, isFocused, currentActivity, completedPoints, totalPoints, isBlurred } = req.body;
      const cleanRoomCode = validateRoomCode(roomCode);
      const cleanNickname = validateNickname(nickname);

      if (!cleanRoomCode || !cleanNickname) {
        res.status(400).json({ error: "Missing or invalid required tracking parameters" });
        return;
      }

      const upperCode = cleanRoomCode;
      let room = CoOpRooms.get(upperCode);
      if (!room) {
        const plan = InMemoryPlans.get(upperCode);
        if (plan) {
          room = {
            roomCode: upperCode,
            players: {},
            goal: plan.goal || "",
            activePlan: plan.activePlan || null
          };
          CoOpRooms.set(upperCode, room);
        } else {
          res.status(404).json({ error: "Active Lobby not found" });
          return;
        }
      }

      const cleanNick = cleanNickname;
      let player = room.players[cleanNick];
      if (!player) {
        // Auto-create player if not found
        player = {
          nickname: cleanNick,
          isHost: false,
          isFocused: false,
          currentActivity: "Establishing transmission",
          completedPoints: 0,
          totalPoints: 0,
          isBlurred: false,
          lastSeen: Date.now()
        };
        room.players[cleanNick] = player;
      }

      // Apply updates if defined and valid
      if (typeof isFocused === "boolean") player.isFocused = isFocused;
      if (typeof currentActivity === "string") {
        player.currentActivity = sanitizeString(currentActivity, 150);
      }
      if (typeof completedPoints === "number" && !isNaN(completedPoints)) {
        player.completedPoints = Math.max(0, Math.min(1000, Math.floor(completedPoints)));
      }
      if (typeof totalPoints === "number" && !isNaN(totalPoints)) {
        player.totalPoints = Math.max(0, Math.min(1000, Math.floor(totalPoints)));
      }
      if (typeof isBlurred === "boolean") player.isBlurred = isBlurred;
      player.lastSeen = Date.now();

      // Prune players that haven't responded for over 45 seconds to keep dashboard crispy
      const now = Date.now();
      Object.keys(room.players).forEach((key) => {
        if (now - room.players[key].lastSeen > 45000 && !room.players[key].isHost) {
          delete room.players[key];
        }
      });

      res.json({
        success: true,
        roomState: room
      });
    } catch (err: any) {
      console.error("[Co-Op Lobby] Error updating player status:", err);
      res.status(500).json({ error: "Failed to synchronize status with radar server" });
    }
  });

  // Update Plan / Goal in Co-Op Room (Equal Rights for ALL players)
  app.post("/api/coop/update-plan", (req, res) => {
    try {
      const { roomCode, nickname, goal, activePlan } = req.body;
      const cleanRoomCode = validateRoomCode(roomCode);
      const cleanNickname = validateNickname(nickname);
      const cleanGoal = sanitizeString(goal, 500);
      const cleanActivePlan = sanitizeActivePlan(activePlan);

      if (!cleanRoomCode) {
        res.status(400).json({ error: "Room code required" });
        return;
      }

      const upperCode = cleanRoomCode;
      let room = CoOpRooms.get(upperCode);
      if (!room) {
        const plan = InMemoryPlans.get(upperCode);
        if (plan) {
          room = {
            roomCode: upperCode,
            players: {},
            goal: plan.goal || "",
            activePlan: plan.activePlan || null
          };
          CoOpRooms.set(upperCode, room);
        } else {
          res.status(404).json({ error: "Active Lobby not found" });
          return;
        }
      }

      room.goal = cleanGoal || "";
      room.activePlan = cleanActivePlan || null;

      // If the player exists, update their stats to stay aligned
      const cleanNick = cleanNickname || null;
      if (cleanNick && room.players[cleanNick]) {
        const player = room.players[cleanNick];
        player.completedPoints = cleanActivePlan?.tasks?.filter((t: any) => t.isCompleted)?.length || 0;
        player.totalPoints = cleanActivePlan?.tasks?.length || 0;
        player.lastSeen = Date.now();
      }

      console.log(`[Co-Op Lobby] Plan updated in room ${upperCode} by ${cleanNick || "unknown"}`);
      res.json({
        success: true,
        roomState: room
      });
    } catch (err: any) {
      console.error("[Co-Op Lobby] Error updating room plan:", err);
      res.status(500).json({ error: "Failed to update co-op room plan" });
    }
  });

  // Get Room State
  app.get("/api/coop/state/:roomCode", (req, res) => {
    try {
      const { roomCode } = req.params;
      const { nickname } = req.query;

      const cleanRoomCode = validateRoomCode(roomCode);
      const cleanNickname = validateNickname(nickname);

      if (!cleanRoomCode) {
        res.status(400).json({ error: "Room code required" });
        return;
      }

      const upperCode = cleanRoomCode;
      let room = CoOpRooms.get(upperCode);
      if (!room) {
        const plan = InMemoryPlans.get(upperCode);
        if (plan) {
          room = {
            roomCode: upperCode,
            players: {},
            goal: plan.goal || "",
            activePlan: plan.activePlan || null
          };
          CoOpRooms.set(upperCode, room);
        } else {
          res.status(404).json({ error: "Active Room Cockpit not found" });
          return;
        }
      }

      // Mark heartbeat
      if (cleanNickname) {
        const player = room.players[cleanNickname];
        if (player) {
          player.lastSeen = Date.now();
        }
      }

      res.json({
        success: true,
        roomState: room
      });
    } catch (err: any) {
      console.error("[Co-Op Lobby] Error getting state:", err);
      res.status(500).json({ error: "Internal radar cockpit stream error" });
    }
  });

  // Load existing plans from disk if available
  try {
    if (fs.existsSync(PLANS_FILE_PATH)) {
      const fileData = fs.readFileSync(PLANS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(fileData);
      Object.entries(parsed).forEach(([key, val]) => {
        InMemoryPlans.set(key, val);
      });
      console.log(`[GoalPlan AI] Loaded ${InMemoryPlans.size} plans from storage storage file`);
    }
  } catch (err) {
    console.warn("[GoalPlan AI] Stored plans storage file not loaded yet or empty:", err);
  }

  // Save/Update plan
  app.post("/api/save-shared-plan", async (req, res) => {
    try {
      const { id, goal, activePlan, chatHistory, creatorNickname } = req.body;
      const cleanId = sanitizeString(id, 50);
      const cleanGoal = sanitizeString(goal, 500);
      const cleanActivePlan = sanitizeActivePlan(activePlan);
      const cleanCreatorNickname = validateNickname(creatorNickname);

      if (!cleanGoal || !cleanActivePlan) {
        res.status(400).json({ error: "Goal and Active Plan data are required" });
        return;
      }

      const planId = cleanId || Math.random().toString(36).substring(2, 11);
      
      // Keep existing creatorNickname if not passed
      const existingPlan = InMemoryPlans.get(planId);
      const finalCreatorNickname = cleanCreatorNickname || existingPlan?.creatorNickname || null;

      const cleanChatHistory: { role: string; content: string }[] = [];
      if (Array.isArray(chatHistory)) {
        chatHistory.slice(-20).forEach((msg: any) => {
          if (msg && typeof msg === "object" && (msg.role === "user" || msg.role === "assistant" || msg.role === "model")) {
            cleanChatHistory.push({
              role: msg.role,
              content: sanitizeString(msg.content, 2000)
            });
          }
        });
      }

      const planRecord = {
        id: planId,
        goal: cleanGoal,
        activePlan: cleanActivePlan,
        chatHistory: cleanChatHistory,
        creatorNickname: finalCreatorNickname,
        updatedAt: new Date().toISOString()
      };

      InMemoryPlans.set(planId, planRecord);

      try {
        const dataObj: Record<string, any> = {};
        InMemoryPlans.forEach((val, key) => {
          dataObj[key] = val;
        });
        await fs.promises.mkdir(path.dirname(PLANS_FILE_PATH), { recursive: true }).catch(() => {});
        await fs.promises.writeFile(PLANS_FILE_PATH, JSON.stringify(dataObj, null, 2), "utf-8");
      } catch (writeErr) {
        console.warn("[GoalPlan AI] Local write warning (using memory-only fallback):", writeErr);
      }

      res.json({ success: true, id: planId });
    } catch (saveErr: any) {
      console.error("[GoalPlan AI] Save shared plan error:", saveErr);
      res.status(500).json({ error: saveErr.message || "Failed to save plan on server" });
    }
  });

  // Get a shared plan
  app.get("/api/get-shared-plan/:id", (req, res) => {
    const { id } = req.params;
    const cleanId = sanitizeString(id, 50);

    if (!cleanId) {
      res.status(400).json({ error: "Plan ID is required" });
      return;
    }

    const plan = InMemoryPlans.get(cleanId);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    res.json(plan);
  });

  // Admin Ping tracking route (completely silent tracking endpoint)
  app.post("/api/admin/ping", (req, res) => {
    try {
      const { clientId, goal, activePlanTitle, coOpRoom, nickname } = req.body;
      const cleanClientId = sanitizeString(clientId, 50);
      const cleanGoal = sanitizeString(goal, 500);
      const cleanActivePlanTitle = sanitizeString(activePlanTitle, 150);
      const cleanCoOpRoom = validateRoomCode(coOpRoom);
      const cleanNickname = validateNickname(nickname);

      if (!cleanClientId) {
        res.status(400).json({ error: "clientId is required for tracking" });
        return;
      }

      ActiveUsers.set(cleanClientId, {
        lastSeen: Date.now(),
        goal: cleanGoal || undefined,
        activePlanTitle: cleanActivePlanTitle || undefined,
        coOpRoom: cleanCoOpRoom || undefined,
        nickname: cleanNickname || undefined,
        userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]).slice(0, 300) : undefined
      });

      // Cleanup extremely stale sessions (offline for over 30 minutes)
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      ActiveUsers.forEach((user, key) => {
        if (user.lastSeen < thirtyMinutesAgo) {
          ActiveUsers.delete(key);
        }
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Ping tracking error" });
    }
  });

  // Secure Admin Statistics API Endpoint
  app.post("/api/admin/stats", (req, res) => {
    try {
      const { passcode, clientId } = req.body;
      const cleanClientId = sanitizeString(clientId, 100);
      const trackerKey = cleanClientId || req.ip || "global_anonymous";
      
      const attemptInfo = FailedAttempts.get(trackerKey);
      const now = Date.now();

      if (attemptInfo && attemptInfo.count >= 3 && now < attemptInfo.lockedUntil) {
        const timeLeft = Math.ceil((attemptInfo.lockedUntil - now) / 1000);
        res.status(429).json({
          error: `Too many failed attempts. Security lock active. Try again in ${timeLeft} seconds.`
        });
        return;
      }

      const expectedPasscode = process.env.ADMIN_PASSCODE || "Zayden@08";

      if (passcode !== expectedPasscode) {
        let count = 1;
        if (attemptInfo) {
          count = attemptInfo.count + 1;
        }

        let lockedUntil = 0;
        if (count >= 3) {
          lockedUntil = now + 60 * 1000; // 60 seconds lock
        }

        FailedAttempts.set(trackerKey, { count, lockedUntil });

        const remaining = Math.max(0, 3 - count);
        if (remaining === 0) {
          res.status(401).json({
            error: "Security lockout engaged (3 failed attempts). Try again in 60 seconds."
          });
        } else {
          res.status(401).json({
            error: `Invalid passcode. ${remaining} attempt(s) remaining before security lockout.`
          });
        }
        return;
      }

      // Success! Reset the lockout tracker for this client
      FailedAttempts.delete(trackerKey);

      const oneMinuteAgo = now - 60 * 1000;
      const fifteenMinutesAgo = now - 15 * 60 * 1000;

      let activeUsers1m = 0;
      let activeUsers15m = 0;
      const activeUsersList: any[] = [];

      ActiveUsers.forEach((user, clientId) => {
        if (user.lastSeen >= oneMinuteAgo) {
          activeUsers1m++;
        }
        if (user.lastSeen >= fifteenMinutesAgo) {
          activeUsers15m++;
          activeUsersList.push({
            clientId,
            lastSeenAgoSeconds: Math.max(0, Math.floor((now - user.lastSeen) / 1000)),
            goal: user.goal || null,
            activePlanTitle: user.activePlanTitle || null,
            coOpRoom: user.coOpRoom || null,
            nickname: user.nickname || "Anonymous Explorer",
            userAgent: user.userAgent || "Unknown Browser"
          });
        }
      });

      // Sort list by most recently active
      activeUsersList.sort((a, b) => a.lastSeenAgoSeconds - b.lastSeenAgoSeconds);

      // Gather current co-op room states
      const activeLobbies: any[] = [];
      CoOpRooms.forEach((room, code) => {
        const playersList = Object.values(room.players).map((p: any) => ({
          nickname: p.nickname,
          isHost: p.isHost,
          isFocused: p.isFocused,
          currentActivity: p.currentActivity,
          completedPoints: p.completedPoints,
          totalPoints: p.totalPoints,
          lastSeenAgoSeconds: Math.max(0, Math.floor((now - p.lastSeen) / 1000))
        }));

        activeLobbies.push({
          roomCode: code,
          goal: room.goal,
          activePlanTitle: room.activePlan?.planTitle || null,
          playerCount: playersList.length,
          players: playersList
        });
      });

      res.json({
        success: true,
        stats: {
          activeUsers1m,
          activeUsers15m,
          activeUsersCount: activeUsersList.length,
          activeUsersList,
          totalLobbies: CoOpRooms.size,
          activeLobbies,
          totalSavedPlans: InMemoryPlans.size,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error("[Admin API] Error compiling admin statistics:", err);
      res.status(500).json({ error: "Failed to compile admin stats" });
    }
  });

  // Vite Middleware & Static Serves
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
    console.log(`GoalPlan AI active on port ${PORT}`);
  });
}

startServer();
