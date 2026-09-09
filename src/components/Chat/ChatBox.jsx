import React, { useState, useRef, useEffect } from "react";
import { socket } from "../../services/socket";
import { uploadAttachment } from "../../services/firebase";
import GameBoard from "../Features/GameBoard";
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Image as ImageIcon,
  Shield,
  Timer,
  Play,
  Pause,
  Sparkles,
  FileText
} from "lucide-react";

export default function ChatBox({
  activeChat,
  currentUser,
  messages,
  vanishMode,
  setVanishMode,
  onOpenImageGen
}) {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => setRecordDuration((prev) => prev + 1), 1000);
    } else {
      setRecordDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    if (inputText.startsWith("/imagine ")) {
      const prompt = inputText.replace("/imagine ", "");
      onOpenImageGen(prompt);
      setInputText("");
      return;
    }

    const newMsg = {
      id: `msg_${Date.now()}`,
      roomId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: inputText.trim(),
      type: "text",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    socket.emit("message:send", newMsg);
    setInputText("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = await uploadAttachment(file);
    const isImage = file.type.startsWith("image/");

    const fileMsg = {
      id: `att_${Date.now()}`,
      roomId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: file.name,
      fileUrl: fileUrl,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      type: isImage ? "image" : "file",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    socket.emit("message:send", fileMsg);
  };

  const handleSendVoice = () => {
    const voiceDuration = recordDuration === 0 ? 3 : recordDuration;
    setIsRecording(false);

    const voiceMsg = {
      id: `voice_${Date.now()}`,
      roomId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: `Voice message (${voiceDuration}s)`,
      duration: voiceDuration,
      type: "voice",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    socket.emit("message:send", voiceMsg);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <header className="px-6 py-4 border-b border-infinity-border bg-infinity-surface flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={activeChat.avatar}
            alt={activeChat.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h1 className="font-bold text-base flex items-center gap-2">
              {activeChat.name}
              {activeChat.isSecret && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-500/40">
                  End-to-End Encrypted
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              {vanishMode ? "Messages disappear after 15s" : "Encrypted Channel"}
            </p>
          </div>
        </div>

        {/* Vanish Mode Switch */}
        <button
          onClick={() => setVanishMode(!vanishMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
            vanishMode
              ? "bg-infinity-vanish/20 border-infinity-vanish text-purple-300 shadow-lg shadow-purple-500/20"
              : "bg-infinity-card border-infinity-border text-slate-400 hover:text-white"
          }`}
        >
          <Timer className="w-4 h-4" />
          Vanish Mode {vanishMode ? "ON" : "OFF"}
        </button>
      </header>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <span className="text-[11px] text-slate-400 mb-1 px-1">
                {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>

              <div
                className={`max-w-[70%] rounded-2xl p-3.5 transition-all shadow-md ${
                  msg.isVanish
                    ? "border border-purple-500/50 bg-purple-950/40 text-purple-100"
                    : isMe
                    ? "bg-infinity-primary text-white rounded-br-none"
                    : "bg-infinity-card text-slate-200 rounded-bl-none border border-infinity-border"
                }`}
              >
                {/* Text */}
                {msg.type === "text" && <p className="text-sm leading-relaxed">{msg.content}</p>}

                {/* Voice Note Waveform */}
                {msg.type === "voice" && (
                  <div className="flex items-center gap-3 w-56">
                    <button
                      onClick={() => setIsPlayingAudio(isPlayingAudio === msg.id ? null : msg.id)}
                      className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                    >
                      {isPlayingAudio === msg.id ? (
                        <Pause className="w-4 h-4 text-white" />
                      ) : (
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 flex items-center gap-1 h-6">
                      {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 35].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`w-1 rounded-full ${
                            isPlayingAudio === msg.id ? "bg-cyan-300 animate-pulse" : "bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs">{msg.duration}s</span>
                  </div>
                )}

                {/* Image */}
                {msg.type === "image" && (
                  <div>
                    <img
                      src={msg.imageUrl || msg.fileUrl}
                      alt={msg.content}
                      className="rounded-xl max-h-64 w-full object-cover border border-white/10"
                    />
                    {msg.content && (
                      <p className="text-xs mt-2 italic text-slate-300">Prompt: "{msg.content}"</p>
                    )}
                  </div>
                )}

                {/* Document File */}
                {msg.type === "file" && (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-2 rounded-xl bg-black/20 hover:bg-black/40 transition-colors"
                  >
                    <FileText className="w-6 h-6 text-infinity-secondary" />
                    <div>
                      <p className="text-sm font-semibold truncate max-w-xs">{msg.content}</p>
                      <span className="text-[10px] text-slate-400">{msg.fileSize}</span>
                    </div>
                  </a>
                )}

                {/* Game */}
                {msg.type === "game" && msg.game && (
                  <GameBoard messageId={msg.id} roomId={activeChat.id} game={msg.game} />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <footer className="p-4 border-t border-infinity-border bg-infinity-surface">
        <div className="flex items-center gap-2 bg-infinity-card border border-infinity-border rounded-2xl px-4 py-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-infinity-primary transition-colors"
            title="Attach File / Photo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenImageGen}
            className="p-2 text-slate-400 hover:text-amber-400 transition-colors"
            title="AI Image Generator (/imagine)"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          {isRecording ? (
            <div className="flex-1 flex items-center justify-between px-3 text-rose-400 animate-pulseFast font-medium text-sm">
              <span>● Recording: {recordDuration}s</span>
              <button
                onClick={handleSendVoice}
                className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs"
              >
                Send Voice
              </button>
            </div>
          ) : (
            <input
              type="text"
              placeholder={vanishMode ? "Send a disappearing message..." : "Type a message or /imagine [prompt]..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2"
            />
          )}

          {!inputText.trim() && !isRecording ? (
            <button
              onClick={() => setIsRecording(true)}
              className="p-2 text-slate-400 hover:text-infinity-secondary transition-colors"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : isRecording ? (
            <button
              onClick={() => setIsRecording(false)}
              className="p-2 text-rose-400 hover:text-rose-500 transition-colors"
            >
              <MicOff className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              className="p-2 bg-infinity-primary hover:bg-infinity-primaryHover text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
