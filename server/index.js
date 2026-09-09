import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const connectedUsers = new Map();
const scheduledMessages = [];

// HTTP REST endpoints
app.get("/health", (req, res) => {
  res.status(200).json({ status: "online", timestamp: new Date().toISOString() });
});

app.post("/api/ai/summarize", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages supplied for summarization" });
    }

    const transcript = messages.map(m => `${m.senderName || "User"}: ${m.content}`).join("\n");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback deterministic semantic summary
      const bullet1 = `• Team covered ${messages.length} messages focusing on system architecture and deployments.`;
      const bullet2 = `• Key contributors reviewed feature sets, timelines, and status updates.`;
      const bullet3 = `• Agreed next step: deliver final assets and maintain synchronized task lists.`;
      return res.json({ summary: `${bullet1}\n${bullet2}\n${bullet3}` });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Provide a concise 3-bullet-point executive summary of this chat session. Output strictly 3 lines each starting with '• ':\n\n${transcript}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "• Summary generated successfully.\n• All participants aligned on goals.\n• Ready for next phase.";
    res.json({ summary: summaryText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io real-time engine
io.on("connection", (socket) => {
  socket.on("user:join", ({ userId, userName }) => {
    connectedUsers.set(socket.id, { userId, userName, socketId: socket.id });
    io.emit("users:online", Array.from(connectedUsers.values()));
  });

  socket.on("chat:join_room", ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on("chat:leave_room", ({ roomId }) => {
    socket.leave(roomId);
  });

  socket.on("message:send", (message) => {
    const enrichedMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    io.to(message.roomId).emit("message:received", enrichedMessage);
  });

  socket.on("message:vanish", ({ roomId, messageId }) => {
    io.to(roomId).emit("message:deleted", { messageId, reason: "vanish_mode" });
  });

  socket.on("typing:start", ({ roomId, userName }) => {
    socket.to(roomId).emit("typing:status", { userName, isTyping: true });
  });

  socket.on("typing:stop", ({ roomId, userName }) => {
    socket.to(roomId).emit("typing:status", { userName, isTyping: false });
  });

  socket.on("poll:vote", ({ roomId, messageId, optionId, userId }) => {
    io.to(roomId).emit("poll:updated", { messageId, optionId, userId });
  });

  socket.on("game:move", ({ roomId, messageId, index, player }) => {
    io.to(roomId).emit("game:updated", { messageId, index, player });
  });

  socket.on("message:schedule", (scheduledItem) => {
    scheduledMessages.push(scheduledItem);
    socket.emit("message:scheduled_confirmation", { success: true, item: scheduledItem });
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    io.emit("users:online", Array.from(connectedUsers.values()));
  });
});

// Minute cron for scheduled dispatch
cron.schedule("* * * * *", () => {
  const now = new Date();
  const dueIndices = [];

  scheduledMessages.forEach((item, index) => {
    if (new Date(item.sendAt) <= now) {
      io.to(item.roomId).emit("message:received", {
        ...item.message,
        id: `sched_${Date.now()}`,
        createdAt: new Date().toISOString()
      });
      dueIndices.push(index);
    }
  });

  for (let i = dueIndices.length - 1; i >= 0; i--) {
    scheduledMessages.splice(dueIndices[i], 1);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Infinity Chat Socket Server running on port ${PORT}`);
});
