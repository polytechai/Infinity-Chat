import React, { useState, useEffect } from "react";
import { socket, joinUser, joinRoom } from "./services/socket";
import ChatBox from "./components/Chat/ChatBox";
import AISummarizer from "./components/Features/AISummarizer";
import ImageGenModal from "./components/Features/ImageGenModal";
import GameBoard from "./components/Features/GameBoard";
import PDFExporter from "./components/Tools/PDFExporter";
import {
  MessageSquare,
  Users,
  Shield,
  Sparkles,
  Search,
  Radio,
  Gamepad2,
  FileDown,
  Globe2
} from "lucide-react";

const INITIAL_CHATS = [
  {
    id: "general_room",
    name: "Engineering Squad 🚀",
    isGroup: true,
    lastMessage: "Real-time sync test passing.",
    unread: 0,
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120"
  },
  {
    id: "sarah_direct",
    name: "Sarah Lin",
    isGroup: false,
    lastMessage: "Reviewing the security policies.",
    unread: 1,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120"
  },
  {
    id: "vanish_secret",
    name: "Confidential Project 🕵️",
    isGroup: false,
    isSecret: true,
    lastMessage: "🔒 Vanish mode active",
    unread: 0,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120"
  }
];

export default function App() {
  const [currentUser] = useState({
    id: "usr_me_" + Math.floor(Math.random() * 1000),
    name: "Alex Rivera",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"
  });

  const [activeChat, setActiveChat] = useState(INITIAL_CHATS[0]);
  const [messages, setMessages] = useState([
    {
      id: "init_1",
      roomId: "general_room",
      senderId: "usr_sarah",
      senderName: "Sarah Lin",
      content: "Welcome to Infinity Chat! Socket server and real-time listeners are active.",
      type: "text",
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "init_2",
      roomId: "general_room",
      senderId: "usr_me",
      senderName: "Alex Rivera",
      content: "All features loaded: AI summarization, polls, vanish mode, and attachments.",
      type: "text",
      createdAt: new Date().toISOString()
    }
  ]);

  const [showSummarizer, setShowSummarizer] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [language, setLanguage] = useState("EN");
  const [vanishMode, setVanishMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    joinUser(currentUser.id, currentUser.name);
    joinRoom(activeChat.id);

    const handleMessageReceived = (newMsg) => {
      if (newMsg.roomId === activeChat.id) {
        setMessages((prev) => [...prev, newMsg]);
        if (newMsg.isVanish) {
          setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== newMsg.id));
          }, 15000);
        }
      }
    };

    const handleGameUpdated = ({ messageId, index, player }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.game) {
            const nextBoard = [...msg.game.board];
            if (!nextBoard[index] && !msg.game.winner) {
              nextBoard[index] = player;
              const nextTurn = player === "X" ? "O" : "X";
              return {
                ...msg,
                game: {
                  ...msg.game,
                  board: nextBoard,
                  turn: nextTurn
                }
              };
            }
          }
          return msg;
        })
      );
    };

    socket.on("message:received", handleMessageReceived);
    socket.on("game:updated", handleGameUpdated);

    return () => {
      socket.off("message:received", handleMessageReceived);
      socket.off("game:updated", handleGameUpdated);
    };
  }, [activeChat.id, currentUser]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    joinRoom(chat.id);
  };

  const handleStartGame = () => {
    const gameMessage = {
      id: `game_${Date.now()}`,
      roomId: activeChat.id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: "Started a game of Tic-Tac-Toe",
      type: "game",
      createdAt: new Date().toISOString(),
      game: {
        board: Array(9).fill(null),
        turn: "X",
        winner: null
      }
    };
    socket.emit("message:send", gameMessage);
  };

  const filteredChats = INITIAL_CHATS.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen bg-infinity-dark text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 border-r border-infinity-border bg-infinity-surface flex flex-col">
        {/* User bar */}
        <div className="p-4 border-b border-infinity-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full border-2 border-infinity-primary object-cover"
            />
            <div>
              <h2 className="text-sm font-bold">{currentUser.name}</h2>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
          </div>
          <button
            onClick={() => setLanguage((l) => (l === "EN" ? "BN" : "EN"))}
            className="px-2.5 py-1 text-xs font-semibold bg-infinity-card hover:bg-infinity-border rounded-lg transition-colors flex items-center gap-1"
          >
            <Globe2 className="w-3.5 h-3.5 text-infinity-secondary" />
            {language}
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-infinity-card border border-infinity-border text-sm rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-infinity-primary"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {filteredChats.map((chat) => {
            const isActive = chat.id === activeChat.id;
            return (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-infinity-primary/20 border border-infinity-primary/50 text-white"
                    : "hover:bg-infinity-card text-slate-300"
                }`}
              >
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="w-11 h-11 rounded-full object-cover border border-infinity-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">{chat.name}</p>
                    {chat.isSecret && <Shield className="w-3.5 h-3.5 text-infinity-vanish" />}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{chat.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Global Toolbar */}
        <div className="p-3 border-t border-infinity-border grid grid-cols-4 gap-2">
          <button
            onClick={() => setShowSummarizer(true)}
            title="AI Summarize"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-infinity-card hover:bg-infinity-primary/30 transition-all text-xs text-slate-300"
          >
            <Sparkles className="w-4 h-4 text-amber-400 mb-1" />
            AI Sum
          </button>
          <button
            onClick={() => setShowImageGen(true)}
            title="/imagine AI Image"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-infinity-card hover:bg-infinity-primary/30 transition-all text-xs text-slate-300"
          >
            <Radio className="w-4 h-4 text-infinity-secondary mb-1" />
            Imagine
          </button>
          <button
            onClick={handleStartGame}
            title="Start Tic-Tac-Toe"
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-infinity-card hover:bg-infinity-primary/30 transition-all text-xs text-slate-300"
          >
            <Gamepad2 className="w-4 h-4 text-emerald-400 mb-1" />
            Game
          </button>
          <PDFExporter messages={messages} chatName={activeChat.name} />
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col bg-infinity-dark">
        <ChatBox
          activeChat={activeChat}
          currentUser={currentUser}
          messages={messages.filter((m) => m.roomId === activeChat.id)}
          vanishMode={vanishMode}
          setVanishMode={setVanishMode}
          onOpenImageGen={() => setShowImageGen(true)}
        />
      </main>

      {/* Modals */}
      {showSummarizer && (
        <AISummarizer
          messages={messages.filter((m) => m.roomId === activeChat.id)}
          onClose={() => setShowSummarizer(false)}
        />
      )}

      {showImageGen && (
        <ImageGenModal
          onClose={() => setShowImageGen(false)}
          onSendImage={(imageUrl, prompt) => {
            const imageMsg = {
              id: `img_${Date.now()}`,
              roomId: activeChat.id,
              senderId: currentUser.id,
              senderName: currentUser.name,
              content: prompt,
              imageUrl,
              type: "image",
              createdAt: new Date().toISOString()
            };
            socket.emit("message:send", imageMsg);
            setShowImageGen(false);
          }}
        />
      )}
    </div>
  );
}
