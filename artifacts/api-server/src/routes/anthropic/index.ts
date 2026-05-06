import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateAnthropicConversationBody,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(conversationsTable.createdAt);
    res.json(conversations);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const body = CreateAnthropicConversationBody.parse(req.body);
    const [conversation] = await db
      .insert(conversationsTable)
      .values({ title: body.title })
      .returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(400).json({ error: "Invalid request body" });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    res.json({ ...conversation, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = SendAnthropicMessageBody.parse(req.body);

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messagesTable).values({
      conversationId: id,
      role: "user",
      content: body.content,
    });

    const allMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    const chatMessages = allMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send action events so the client can show live status
    res.write(`data: ${JSON.stringify({ action: "Analyzing context..." })}\n\n`);

    let fullResponse = "";

    // Extract plan mode flag if present
    const lastUserMsg = chatMessages[chatMessages.length - 1]?.content || "";
    const planMode = lastUserMsg.startsWith("[PLAN MODE]");

    const stream = anthropic.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      system: `You are an AI app builder assistant — an expert software architect and developer embedded inside a Replit-like IDE.

You help users build web apps, mobile apps, games, APIs, data visualizations, slides, animations, and all kinds of software projects.

LANGUAGE RULE — critical:
Always detect the language the user writes in and respond in EXACTLY that same language throughout your entire response. If they write in Arabic, your entire response must be in Arabic (use natural, fluent Arabic). If they write in English, respond in English. If they mix languages, match the dominant one. Never switch languages mid-response.

RESPONSE STYLE — follow this strictly:
- Be direct and action-oriented. Write short, clear sentences describing what you're doing or building.
- Start with a one-liner stating your intent, then give details or code.
- Avoid long disclaimers, preamble, or filler text.
- Use markdown code blocks when showing actual code. Use plain text for everything else.
- Think out loud like a senior engineer pair-programming with the user.
${planMode ? `
PLAN MODE IS ACTIVE:
The user wants you to plan before coding. Do NOT write any code yet.
1. Summarize what you understand they want (1-2 sentences).
2. List all the components/features you'll build (numbered list).
3. Note any important technical decisions or tradeoffs.
4. End with: "Ready to build — reply 'Go' to start coding."
` : ""}
WHEN A GITHUB URL IS IN THE MESSAGE:
- Look for a "---" separator below the user's message. If it's there, the full repository context (file tree + key file contents) has been injected automatically.
- If the "---" separator and "GitHub context auto-fetched" note ARE present: treat the injected content as the complete source of truth. Analyse the code directly and respond as if you opened the project. Do NOT ask the user to paste files.
- If the "---" separator is NOT present (fetch failed): tell the user in one line that the auto-fetch didn't work, then ask them to check the status card in the chat (it shows the exact error reason and how to fix it — e.g. adding a GitHub token).

WHEN BUILDING AN APP:
1. State your understanding in one sentence.
2. List the key things you'll build (bullets, brief).
3. Dive straight into implementation with real, working code.

Always be specific, helpful, and concise. No lengthy explanations unless the user asks.`,
      messages: chatMessages,
    });

    res.write(`data: ${JSON.stringify({ action: "Writing response..." })}\n\n`);

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullResponse += event.delta.text;
        res.write(
          `data: ${JSON.stringify({ content: event.delta.text })}\n\n`
        );
      }
    }

    await db.insert(messagesTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to send message" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

/* ── Stateless code-assist endpoint (no conversation stored) ── */
router.post("/code-assist", async (req, res) => {
  try {
    const { message, code, language, filename, history } = req.body as {
      message: string;
      code?: string;
      language?: string;
      filename?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const systemPrompt = `You are an elite AI coding assistant embedded inside a Replit-like IDE. You are powered by Claude Opus — the most capable AI model available. You help developers write, debug, refactor, and understand code.

Current context:
- File: ${filename || "unknown"}
- Language: ${language || "unknown"}
${code ? `\nCurrent file content:\n\`\`\`${language || ""}\n${code}\n\`\`\`` : ""}

Your capabilities:
- Read and deeply understand the user's current code
- Suggest specific, precise edits with exact code snippets
- Debug errors with step-by-step explanations
- Refactor code for clarity, performance, and best practices
- Add new features to existing code
- Explain what any piece of code does
- Generate complete new components/functions/modules

Rules:
- Always reference the actual code when relevant (line numbers, variable names, function names)
- Provide code blocks with proper syntax highlighting hints
- Be concise but complete — no hand-waving, give real working code
- If suggesting changes, show the full updated code or the specific section to replace
- Use markdown formatting for clarity`;

    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...(history || []),
      { role: "user", content: message },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const stream = anthropic.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "code-assist failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "AI request failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
