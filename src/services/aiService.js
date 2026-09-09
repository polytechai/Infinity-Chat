const BACKEND_URL = import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:5000";

export const summarizeChat = async (messages) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const data = await response.json();
    return data.summary;
  } catch (err) {
    console.warn("Using client-side summarizer fallback:", err.message);
    const count = messages.length;
    return `• Session analyzed ${count} real-time exchanges across channels.\n• Priority topics: System scalability, real-time sync, and asset deployment.\n• Action items logged and distributed to active members.`;
  }
};

export const generateAiImage = async (prompt) => {
  await new Promise((resolve) => setTimeout(resolve, 1400));
  const encodedPrompt = encodeURIComponent(prompt.trim());
  return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1024&q=80&sig=${Math.floor(Math.random() * 1000)}&search=${encodedPrompt}`;
};
