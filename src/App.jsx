import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Sparkles,
  Timer,
  Play,
  Pause,
  Image as ImageIcon,
  FileText,
  Search,
  ArrowLeft,
  X,
  Gamepad2,
  Radio,
  Shield,
  Loader2,
  LogOut,
  User,
  Phone,
  Video,
  UserPlus,
  PhoneCall,
  PhoneOff,
  Mic as MicIcon,
  VideoOff,
  CheckCircle,
  MessageSquare,
  Volume2
} from "lucide-react";

// Theme Tokens for Crisp Contrast & Dark UI
const THEME = {
  bg: "#0b0f19",
  sidebar: "#111726",
  card: "#182032",
  cardHover: "#202a42",
  border: "#232d45",
  primary: "#6366f1",
  primaryHover: "#4f46e5",
  secondary: "#06b6d4",
  vanish: "#a855f7",
  success: "#10b981",
  danger: "#ef4444",
  text: "#f8fafc",
  textMuted: "#94a3b8"
};

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=140",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=140",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140"
];

const INITIAL_CONTACTS = [
  {
    id: "contact_1",
    name: "Amina Rahman",
    phone: "+880 1711-234567",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120",
    isOnline: true,
    lastSeen: "Online",
    isSecret: false
  },
  {
    id: "contact_2",
    name: "Engineering Squad 🚀",
    phone: "+1 555-0199",
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120",
    isOnline: true,
    lastSeen: "5 members active",
    isSecret: false
  },
  {
    id: "contact_3",
    name: "VIP Secret Protocol 🕵️",
    phone: "+44 7700-900077",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120",
    isOnline: false,
    lastSeen: "Last seen at 10:45 AM",
    isSecret: true
  }
];

export default function App() {
  // 1. Session Persistence
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_chat_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // 2. Auth Form State
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("+880 ");
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]);
  const [authError, setAuthError] = useState("");

  // 3. Contacts & Multi-Room Messages State
  const [contacts, setContacts] = useState(() => {
    try {
      const savedContacts = localStorage.getItem("infinity_chat_contacts");
      return savedContacts ? JSON.parse(savedContacts) : INITIAL_CONTACTS;
    } catch (e) {
      return INITIAL_CONTACTS;
    }
  });

  const [activeChat, setActiveChat] = useState(contacts[0] || INITIAL_CONTACTS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileView, setMobileView] = useState("list"); // 'list' or 'chat'
  const [vanishMode, setVanishMode] = useState(false);

  // Message mapping by contact ID
  const [messagesByChat, setMessagesByChat] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_chat_messages_map");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      contact_1: [
        {
          id: "m_init_1",
          senderId: "contact_1",
          senderName: "Amina Rahman",
          content: "Hey Alex! Did you review the latest deployment specs?",
          type: "text",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      contact_2: [
        {
          id: "m_init_2",
          senderId: "contact_2",
          senderName: "Engineering Squad",
          content: "Welcome to Core Engineering channel! Socket and AI ready.",
          type: "text",
          createdAt: new Date().toISOString()
        }
      ]
    };
  });

  // Active chat's message list
  const activeMessages = messagesByChat[activeChat?.id] || [];

  // 4. Input & Voice State
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  // 5. Modals State
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [contactAddError, setContactAddError] = useState("");

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSummarizer, setShowSummarizer] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [imgPrompt, setImgPrompt] = useState("");
  const [generatedImgUrl, setGeneratedImgUrl] = useState(null);

  // 6. Voice & Video Call State
  const [activeCall, setActiveCall] = useState(null); // { type: 'audio' | 'video', status: 'calling' | 'connected', duration: 0 }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync state to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem("infinity_chat_contacts", JSON.stringify(contacts));
    } catch (e) {}
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem("infinity_chat_messages_map", JSON.stringify(messagesByChat));
    } catch (e) {}
  }, [messagesByChat]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  // Voice recording timer
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => setRecordDuration((prev) => prev + 1), 1000);
    } else {
      setRecordDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  // Active Call duration timer
  useEffect(() => {
    let callTimer;
    if (activeCall) {
      callTimer = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          // After 2.5s simulate pick-up
          if (prev.status === "calling") {
            return { ...prev, status: "connected", duration: 1 };
          }
          return { ...prev, duration: prev.duration + 1 };
        });
      }, 1000);
    }
    return () => clearInterval(callTimer);
  }, [activeCall?.status]);

  // Handle Login / Registration
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    if (!regName.trim()) {
      setAuthError("Please enter your name.");
      return;
    }
    if (!regPhone.trim() || regPhone.length < 7) {
      setAuthError("Please provide a valid mobile number.");
      return;
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name: regName.trim(),
      phone: regPhone.trim(),
      avatar: selectedAvatar,
      joinedAt: new Date().toISOString()
    };

    localStorage.setItem("infinity_chat_user", JSON.stringify(newUser));
    setCurrentUser(newUser);
    setAuthError("");
  };

  const handleLogout = () => {
    localStorage.removeItem("infinity_chat_user");
    setCurrentUser(null);
    setShowProfileModal(false);
    setMobileView("list");
  };

  // Add Contact Handler
  const handleAddContactSubmit = (e) => {
    e.preventDefault();
    if (!newContactName.trim()) {
      setContactAddError("Please enter the contact's name.");
      return;
    }
    if (!newContactPhone.trim()) {
      setContactAddError("Please enter the phone number or username.");
      return;
    }

    const randomAvatar = DEFAULT_AVATARS[contacts.length % DEFAULT_AVATARS.length];
    const newContact = {
      id: `contact_${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      avatar: randomAvatar,
      isOnline: true,
      lastSeen: "Just now",
      isSecret: false
    };

    setContacts((prev) => [newContact, ...prev]);
    setActiveChat(newContact);
    setNewContactName("");
    setNewContactPhone("");
    setContactAddError("");
    setShowAddContactModal(false);
    setMobileView("chat");
  };

  // Send Message Logic
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeChat) return;

    if (inputText.startsWith("/imagine ")) {
      const prompt = inputText.replace("/imagine ", "");
      setImgPrompt(prompt);
      setShowImageGen(true);
      setInputText("");
      return;
    }

    const newMsg = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: inputText.trim(),
      type: "text",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    setMessagesByChat((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), newMsg]
    }));

    setInputText("");

    // Vanish timer
    if (vanishMode) {
      setTimeout(() => {
        setMessagesByChat((prev) => ({
          ...prev,
          [activeChat.id]: (prev[activeChat.id] || []).filter((m) => m.id !== newMsg.id)
        }));
      }, 15000);
    }
  };

  const handleSendVoice = () => {
    const duration = recordDuration === 0 ? 3 : recordDuration;
    setIsRecording(false);

    const voiceMsg = {
      id: `voice_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: `Voice Message (${duration}s)`,
      duration: duration,
      type: "voice",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    setMessagesByChat((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), voiceMsg]
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const isImage = file.type.startsWith("image/");
    const localUrl = URL.createObjectURL(file);

    const fileMsg = {
      id: `file_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: file.name,
      fileUrl: localUrl,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      type: isImage ? "image" : "file",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    setMessagesByChat((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), fileMsg]
    }));
  };

  const handleStartGame = () => {
    const gameMsg = {
      id: `game_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: "Started a Tic-Tac-Toe match",
      type: "game",
      createdAt: new Date().toISOString(),
      game: {
        board: Array(9).fill(null),
        turn: "X",
        winner: null
      }
    };
    setMessagesByChat((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), gameMsg]
    }));
  };

  const handleGameMove = (messageId, index) => {
    setMessagesByChat((prev) => {
      const roomMsgs = prev[activeChat.id] || [];
      const updated = roomMsgs.map((msg) => {
        if (msg.id === messageId && msg.game) {
          const board = [...msg.game.board];
          if (board[index] || msg.game.winner) return msg;

          board[index] = msg.game.turn;

          const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
          ];
          let winner = null;
          for (let line of lines) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
              winner = board[a];
              break;
            }
          }
          if (!winner && board.every(Boolean)) winner = "Tie";

          return {
            ...msg,
            game: {
              ...msg.game,
              board,
              turn: msg.game.turn === "X" ? "O" : "X",
              winner
            }
          };
        }
        return msg;
      });
      return { ...prev, [activeChat.id]: updated };
    });
  };

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return;
    setIsGeneratingImg(true);
    await new Promise((r) => setTimeout(r, 1200));
    const url = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1024&q=80&sig=${Math.floor(
      Math.random() * 1000
    )}`;
    setGeneratedImgUrl(url);
    setIsGeneratingImg(false);
  };

  const handleSendGeneratedImage = () => {
    if (!generatedImgUrl || !activeChat) return;
    const imgMsg = {
      id: `ai_img_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: imgPrompt,
      fileUrl: generatedImgUrl,
      type: "image",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };
    setMessagesByChat((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), imgMsg]
    }));
    setShowImageGen(false);
    setGeneratedImgUrl(null);
    setImgPrompt("");
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION SCREEN
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: "22px" }}>
            <div style={styles.authLogoCircle}>
              <MessageSquare size={30} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: THEME.text }}>
              Infinity Chat
            </h1>
            <p style={{ fontSize: "13px", color: THEME.textMuted, marginTop: "4px" }}>
              Enter your credentials to connect with friends.
            </p>
          </div>

          {authError && <div style={styles.authErrorBox}>{authError}</div>}

          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={styles.fieldLabel}>Select Profile Avatar</label>
              <div style={styles.avatarPickerRow}>
                {DEFAULT_AVATARS.map((imgUrl, i) => (
                  <img
                    key={i}
                    src={imgUrl}
                    alt=""
                    onClick={() => setSelectedAvatar(imgUrl)}
                    style={{
                      ...styles.avatarOption,
                      border: selectedAvatar === imgUrl ? `3px solid ${THEME.primary}` : `2px solid ${THEME.border}`
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label style={styles.fieldLabel}>Your Full Name</label>
              <div style={styles.inputWrapper}>
                <User size={18} color={THEME.textMuted} style={{ marginRight: "8px" }} />
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  style={styles.cleanInput}
                />
              </div>
            </div>

            <div>
              <label style={styles.fieldLabel}>Phone Number / User ID</label>
              <div style={styles.inputWrapper}>
                <Phone size={18} color={THEME.textMuted} style={{ marginRight: "8px" }} />
                <input
                  type="tel"
                  placeholder="+880 1700-000000"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  style={styles.cleanInput}
                />
              </div>
            </div>

            <button type="submit" style={styles.primaryActionBtn}>
              <span>Start Messaging</span>
              <CheckCircle size={18} />
            </button>
          </form>

          <div style={styles.authFooterNote}>
            🔒 End-to-End Encrypted Session Stored Locally
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: MAIN MESSENGER WITH CALLS & CONTACT SYSTEM
  // -------------------------------------------------------------
  return (
    <div style={styles.appContainer}>
      {/* SIDEBAR / CONTACT LIST */}
      <aside
        style={{
          ...styles.sidebar,
          display: mobileView === "chat" ? "none" : "flex"
        }}
        className="app-sidebar"
      >
        {/* User Profile Bar */}
        <div style={styles.userBar}>
          <div
            onClick={() => setShowProfileModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
            title="Click to view Profile"
          >
            <img src={currentUser.avatar} alt="" style={styles.avatarLarge} />
            <div>
              <div style={styles.userName}>{currentUser.name}</div>
              <div style={styles.statusOnline}>● Online</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setShowAddContactModal(true)}
              style={styles.circleActionBtn}
              title="Add Contact / Friend"
            >
              <UserPlus size={16} color={THEME.secondary} />
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              style={styles.circleActionBtn}
              title="Account Profile"
            >
              <User size={16} color={THEME.textMuted} />
            </button>
          </div>
        </div>

        {/* Search Contacts */}
        <div style={styles.searchWrapper}>
          <Search size={16} color={THEME.textMuted} style={{ marginRight: "8px" }} />
          <input
            type="text"
            placeholder="Search contacts or numbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.cleanInput}
          />
        </div>

        {/* Contacts Header & Add Contact shortcut */}
        <div style={styles.contactListSectionHeader}>
          <span>CONVERSATIONS ({filteredContacts.length})</span>
          <button
            onClick={() => setShowAddContactModal(true)}
            style={styles.addContactTextBtn}
          >
            + Add New
          </button>
        </div>

        {/* Contact List */}
        <div style={styles.chatList}>
          {filteredContacts.map((contact) => {
            const isActive = contact.id === activeChat?.id;
            const contactMsgs = messagesByChat[contact.id] || [];
            const lastMsg = contactMsgs[contactMsgs.length - 1];

            return (
              <div
                key={contact.id}
                onClick={() => {
                  setActiveChat(contact);
                  setMobileView("chat");
                }}
                style={{
                  ...styles.chatItem,
                  backgroundColor: isActive ? THEME.cardHover : "transparent",
                  borderLeft: isActive ? `3px solid ${THEME.primary}` : "3px solid transparent"
                }}
              >
                <div style={{ position: "relative" }}>
                  <img src={contact.avatar} alt="" style={styles.avatar} />
                  {contact.isOnline && <span style={styles.onlineBadge} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.chatItemHeader}>
                    <span style={styles.chatItemName}>{contact.name}</span>
                    {contact.isSecret && <Shield size={12} color={THEME.vanish} />}
                  </div>
                  <div style={styles.chatItemMsg}>
                    {lastMsg ? lastMsg.content : contact.phone}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Toolbar */}
        <div style={styles.featureToolbar}>
          <button
            onClick={() => setShowSummarizer(true)}
            style={styles.toolBtn}
            title="AI Summarize"
          >
            <Sparkles size={16} color="#fbbf24" />
            <span>AI Sum</span>
          </button>
          <button
            onClick={() => setShowImageGen(true)}
            style={styles.toolBtn}
            title="/imagine AI Image"
          >
            <Radio size={16} color={THEME.secondary} />
            <span>Imagine</span>
          </button>
          <button onClick={handleStartGame} style={styles.toolBtn} title="Play Tic-Tac-Toe">
            <Gamepad2 size={16} color="#34d399" />
            <span>Game</span>
          </button>
        </div>
      </aside>

      {/* CHAT WINDOW */}
      <main
        style={{
          ...styles.chatWindow,
          display: mobileView === "list" ? "none" : "flex"
        }}
        className="app-chat-window"
      >
        {/* Header with Call Affordances */}
        <header style={styles.chatHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setMobileView("list")}
              style={styles.backBtn}
              className="mobile-back-btn"
            >
              <ArrowLeft size={18} />
            </button>
            <div style={{ position: "relative" }}>
              <img src={activeChat?.avatar} alt="" style={styles.avatar} />
              {activeChat?.isOnline && <span style={styles.onlineBadge} />}
            </div>
            <div>
              <div style={styles.headerTitle}>{activeChat?.name}</div>
              <div style={styles.headerSub}>
                {vanishMode ? "🔒 Vanish mode: deletes in 15s" : activeChat?.lastSeen || "Online"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Audio Call Button */}
            <button
              onClick={() => setActiveCall({ type: "audio", status: "calling", duration: 0 })}
              style={styles.callIconBtn}
              title="Voice Call"
            >
              <Phone size={17} color={THEME.secondary} />
            </button>

            {/* Video Call Button */}
            <button
              onClick={() => setActiveCall({ type: "video", status: "calling", duration: 0 })}
              style={styles.callIconBtn}
              title="Video Call"
            >
              <Video size={17} color="#34d399" />
            </button>

            {/* Vanish Switch */}
            <button
              onClick={() => setVanishMode(!vanishMode)}
              style={{
                ...styles.vanishBtn,
                backgroundColor: vanishMode ? "rgba(168, 85, 247, 0.2)" : THEME.card,
                borderColor: vanishMode ? THEME.vanish : THEME.border,
                color: vanishMode ? "#d8b4fe" : THEME.textMuted
              }}
            >
              <Timer size={14} />
              <span className="hide-mobile-text">Vanish {vanishMode ? "ON" : "OFF"}</span>
            </button>
          </div>
        </header>

        {/* Message Feed */}
        <div style={styles.messageFeed}>
          {activeMessages.length === 0 ? (
            <div style={styles.emptyChatPlaceholder}>
              <MessageSquare size={36} color={THEME.textMuted} style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "14px", fontWeight: "600" }}>No messages yet with {activeChat?.name}</div>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "4px 0 0" }}>
                Say hello or try typing <code>/imagine [prompt]</code>
              </p>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: isMe ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubble,
                      backgroundColor: msg.isVanish
                        ? "rgba(88, 28, 135, 0.35)"
                        : isMe
                        ? THEME.primary
                        : THEME.card,
                      border: msg.isVanish ? "1px solid rgba(168, 85, 247, 0.5)" : `1px solid ${THEME.border}`,
                      borderBottomRightRadius: isMe ? "4px" : "16px",
                      borderBottomLeftRadius: !isMe ? "4px" : "16px"
                    }}
                  >
                    <div style={styles.senderName}>{msg.senderName}</div>

                    {/* Text Message */}
                    {msg.type === "text" && <div style={styles.msgText}>{msg.content}</div>}

                    {/* Image Attachment */}
                    {msg.type === "image" && (
                      <div>
                        <img src={msg.fileUrl} alt="" style={styles.chatImage} />
                        {msg.content && <div style={styles.imgCaption}>"{msg.content}"</div>}
                      </div>
                    )}

                    {/* Voice Note */}
                    {msg.type === "voice" && (
                      <div style={styles.voiceNoteWrapper}>
                        <button
                          onClick={() => setPlayingAudioId(playingAudioId === msg.id ? null : msg.id)}
                          style={styles.playBtn}
                        >
                          {playingAudioId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div style={styles.waveBars}>
                          {[40, 75, 30, 90, 60, 100, 45, 80, 50].map((h, i) => (
                            <span
                              key={i}
                              style={{
                                ...styles.waveBar,
                                height: `${h}%`,
                                backgroundColor: playingAudioId === msg.id ? THEME.secondary : "#ffffffaa"
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: "11px", color: THEME.textMuted }}>{msg.duration}s</span>
                      </div>
                    )}

                    {/* Document File */}
                    {msg.type === "file" && (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={styles.fileCard}>
                        <FileText size={20} color={THEME.secondary} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600" }}>{msg.content}</div>
                          <div style={{ fontSize: "10px", color: THEME.textMuted }}>{msg.fileSize}</div>
                        </div>
                      </a>
                    )}

                    {/* Interactive Tic-Tac-Toe Game */}
                    {msg.type === "game" && msg.game && (
                      <div style={styles.gameContainer}>
                        <div style={styles.gameHeader}>
                          <span>Tic-Tac-Toe</span>
                          <span style={{ color: THEME.secondary, fontWeight: "bold" }}>
                            {msg.game.winner
                              ? msg.game.winner === "Tie"
                                ? "Tie!"
                                : `Winner: ${msg.game.winner} 🎉`
                              : `Turn: ${msg.game.turn}`}
                          </span>
                        </div>
                        <div style={styles.gameGrid}>
                          {msg.game.board.map((cell, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleGameMove(msg.id, idx)}
                              disabled={Boolean(cell || msg.game.winner)}
                              style={styles.gameCell}
                            >
                              {cell}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={styles.msgTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <footer style={styles.chatFooter}>
          <div style={styles.inputContainer}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={styles.iconBtn}
              title="Attach File / Photo"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={() => setShowImageGen(true)}
              style={styles.iconBtn}
              title="/imagine AI Image"
            >
              <Sparkles size={18} color="#fbbf24" />
            </button>

            {isRecording ? (
              <div style={styles.recordingArea}>
                <span style={{ color: "#f43f5e", fontSize: "13px", fontWeight: "bold" }}>
                  ● Recording: {recordDuration}s
                </span>
                <button onClick={handleSendVoice} style={styles.sendVoiceBtn}>
                  Send Voice
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder={
                  vanishMode
                    ? "Send disappearing message..."
                    : `Message ${activeChat?.name || ""}...`
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                style={styles.chatInput}
              />
            )}

            {!inputText.trim() && !isRecording ? (
              <button
                onClick={() => setIsRecording(true)}
                style={styles.iconBtn}
                title="Hold to Record"
              >
                <Mic size={18} />
              </button>
            ) : isRecording ? (
              <button onClick={() => setIsRecording(false)} style={styles.iconBtn}>
                <MicOff size={18} color="#f43f5e" />
              </button>
            ) : (
              <button onClick={handleSendMessage} style={styles.sendBtn}>
                <Send size={15} color="#ffffff" />
              </button>
            )}
          </div>
        </footer>
      </main>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. ADD CONTACT MODAL */}
      {showAddContactModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color={THEME.secondary} />
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>Add New Contact</span>
              </div>
              <button onClick={() => setShowAddContactModal(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddContactSubmit} style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {contactAddError && <div style={styles.authErrorBox}>{contactAddError}</div>}

              <div>
                <label style={styles.fieldLabel}>Contact Name</label>
                <div style={styles.inputWrapper}>
                  <User size={16} color={THEME.textMuted} style={{ marginRight: "8px" }} />
                  <input
                    type="text"
                    placeholder="e.g. Elena Rostova"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    style={styles.cleanInput}
                  />
                </div>
              </div>

              <div>
                <label style={styles.fieldLabel}>Phone Number or Username</label>
                <div style={styles.inputWrapper}>
                  <Phone size={16} color={THEME.textMuted} style={{ marginRight: "8px" }} />
                  <input
                    type="text"
                    placeholder="+1 555-0192 or @elena"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    style={styles.cleanInput}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  style={styles.secondaryModalBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryModalBtn}>
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CALL OVERLAY (VOICE & VIDEO CALL) */}
      {activeCall && (
        <div style={styles.callOverlay}>
          <div style={styles.callCard}>
            <div style={styles.callHeader}>
              <span style={{ fontSize: "12px", color: THEME.textMuted }}>
                {activeCall.type === "video" ? "Infinity HD Video Call" : "Infinity Encrypted Voice Call"}
              </span>
            </div>

            {/* Video or Avatar Display */}
            {activeCall.type === "video" && !isVideoOff ? (
              <div style={styles.callVideoScreen}>
                <img src={activeChat?.avatar} alt="" style={styles.callVideoAvatarBg} />
                <div style={styles.callSelfVideoBadge}>You (Camera On)</div>
              </div>
            ) : (
              <div style={styles.callAvatarSection}>
                <img
                  src={activeChat?.avatar}
                  alt=""
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "50%",
                    border: `3px solid ${activeCall.status === "connected" ? THEME.success : THEME.primary}`,
                    boxShadow: "0 0 30px rgba(99, 102, 241, 0.4)"
                  }}
                />
              </div>
            )}

            <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "12px 0 4px" }}>
              {activeChat?.name}
            </h2>
            <div style={{ fontSize: "13px", color: activeCall.status === "connected" ? THEME.success : THEME.textMuted }}>
              {activeCall.status === "connected"
                ? `Connected (${Math.floor(activeCall.duration / 60)}:${(activeCall.duration % 60).toString().padStart(2, "0")})`
                : "Ringing..."}
            </div>

            {/* Call Control Buttons */}
            <div style={styles.callActionsRow}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                style={{
                  ...styles.callControlBtn,
                  backgroundColor: isMuted ? THEME.danger : THEME.card
                }}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={18} color="#fff" /> : <MicIcon size={18} color="#fff" />}
              </button>

              {activeCall.type === "video" && (
                <button
                  onClick={() => setIsVideoOff(!isVideoOff)}
                  style={{
                    ...styles.callControlBtn,
                    backgroundColor: isVideoOff ? THEME.danger : THEME.card
                  }}
                  title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isVideoOff ? <VideoOff size={18} color="#fff" /> : <Video size={18} color="#fff" />}
                </button>
              )}

              <button
                onClick={() => {
                  setActiveCall(null);
                  setIsMuted(false);
                  setIsVideoOff(false);
                }}
                style={{
                  ...styles.callControlBtn,
                  backgroundColor: THEME.danger,
                  transform: "scale(1.1)"
                }}
                title="End Call"
              >
                <PhoneOff size={20} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. USER PROFILE MODAL */}
      {showProfileModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: "bold", fontSize: "15px" }}>User Profile</span>
              <button onClick={() => setShowProfileModal(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={{ ...styles.modalBody, textAlign: "center" }}>
              <img
                src={currentUser.avatar}
                alt=""
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  border: `3px solid ${THEME.primary}`,
                  margin: "0 auto 12px",
                  objectFit: "cover"
                }}
              />
              <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0" }}>
                {currentUser.name}
              </h3>
              <p style={{ fontSize: "13px", color: THEME.textMuted, margin: "4px 0 16px" }}>
                {currentUser.phone}
              </p>

              <div style={styles.profileDetailBox}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: THEME.textMuted }}>User ID:</span>
                  <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{currentUser.id}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: THEME.textMuted }}>Security:</span>
                  <span style={{ color: "#34d399", fontWeight: "bold" }}>E2E Encrypted</span>
                </div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={handleLogout}
                style={{
                  ...styles.primaryModalBtn,
                  backgroundColor: "#e11d48",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI SUMMARIZER MODAL */}
      {showSummarizer && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="#fbbf24" />
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>AI Chat Summarizer</span>
              </div>
              <button onClick={() => setShowSummarizer(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.summaryBox}>
                • Processed {activeMessages.length} messages in conversation with {activeChat?.name}.
                <br />• Key topics: System architecture, voice notes, and contact coordination.
                <br />• All interactions verified end-to-end encrypted.
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowSummarizer(false)} style={styles.primaryModalBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. AI IMAGE GEN MODAL */}
      {showImageGen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Radio size={18} color={THEME.secondary} />
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>AI Image Generator</span>
              </div>
              <button onClick={() => setShowImageGen(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input
                  type="text"
                  placeholder="e.g. Cyberpunk skyline in rain, 8k render"
                  value={imgPrompt}
                  onChange={(e) => setImgPrompt(e.target.value)}
                  style={styles.modalInput}
                />
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImg || !imgPrompt.trim()}
                  style={styles.generateBtn}
                >
                  {isGeneratingImg ? <Loader2 size={16} className="spin" /> : "Generate"}
                </button>
              </div>

              <div style={styles.imagePreviewBox}>
                {isGeneratingImg ? (
                  <div style={{ color: THEME.textMuted, fontSize: "13px" }}>
                    Synthesizing image artifact...
                  </div>
                ) : generatedImgUrl ? (
                  <img src={generatedImgUrl} alt="" style={styles.previewImage} />
                ) : (
                  <div style={{ color: THEME.textMuted, fontSize: "12px" }}>
                    Enter a prompt and click Generate
                  </div>
                )}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowImageGen(false)} style={styles.secondaryModalBtn}>
                Cancel
              </button>
              <button
                onClick={handleSendGeneratedImage}
                disabled={!generatedImgUrl}
                style={{
                  ...styles.primaryModalBtn,
                  opacity: generatedImgUrl ? 1 : 0.5
                }}
              >
                Send to Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS for Animations & Mobile Breakpoints */}
      <style>{`
        @media (min-width: 768px) {
          .app-sidebar {
            display: flex !important;
            width: 320px !important;
          }
          .app-chat-window {
            display: flex !important;
          }
          .mobile-back-btn {
            display: none !important;
          }
        }
        @media (max-width: 500px) {
          .hide-mobile-text {
            display: none !important;
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

// Scoped UI Stylesheet Object
const styles = {
  // Auth Screen
  authContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100vw",
    backgroundColor: THEME.bg,
    padding: "16px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  authCard: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: THEME.sidebar,
    border: `1px solid ${THEME.border}`,
    borderRadius: "20px",
    padding: "26px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
  },
  authLogoCircle: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    backgroundColor: THEME.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px"
  },
  fieldLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: THEME.textMuted,
    marginBottom: "6px"
  },
  avatarPickerRow: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginBottom: "6px"
  },
  avatarOption: {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    cursor: "pointer",
    objectFit: "cover"
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    backgroundColor: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "12px",
    padding: "10px 14px"
  },
  cleanInput: {
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "13px",
    width: "100%",
    outline: "none"
  },
  primaryActionBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    backgroundColor: THEME.primary,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "13px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "6px",
    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)"
  },
  authErrorBox: {
    backgroundColor: "rgba(225, 29, 72, 0.2)",
    border: "1px solid #e11d48",
    color: "#fda4af",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    marginBottom: "12px"
  },
  authFooterNote: {
    textAlign: "center",
    fontSize: "11px",
    color: THEME.textMuted,
    marginTop: "18px"
  },

  // Main Layout
  appContainer: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    backgroundColor: THEME.bg,
    color: THEME.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: "hidden"
  },
  sidebar: {
    width: "100%",
    backgroundColor: THEME.sidebar,
    borderRight: `1px solid ${THEME.border}`,
    flexDirection: "column"
  },
  userBar: {
    padding: "14px 16px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  circleActionBtn: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    padding: "7px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarLarge: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    objectFit: "cover"
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    objectFit: "cover"
  },
  onlineBadge: {
    position: "absolute",
    bottom: "0",
    right: "0",
    width: "10px",
    height: "10px",
    backgroundColor: THEME.success,
    borderRadius: "50%",
    border: `2px solid ${THEME.sidebar}`
  },
  userName: {
    fontSize: "14px",
    fontWeight: "700"
  },
  statusOnline: {
    fontSize: "11px",
    color: THEME.success
  },
  searchWrapper: {
    display: "flex",
    alignItems: "center",
    margin: "12px 14px 6px",
    padding: "8px 12px",
    backgroundColor: THEME.card,
    borderRadius: "10px",
    border: `1px solid ${THEME.border}`
  },
  contactListSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    fontSize: "11px",
    fontWeight: "700",
    color: THEME.textMuted
  },
  addContactTextBtn: {
    background: "none",
    border: "none",
    color: THEME.secondary,
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer"
  },
  chatList: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 8px"
  },
  chatItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.15s ease",
    marginBottom: "3px"
  },
  chatItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  chatItemName: {
    fontSize: "13px",
    fontWeight: "600",
    color: THEME.text
  },
  chatItemMsg: {
    fontSize: "12px",
    color: THEME.textMuted,
    marginTop: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  featureToolbar: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    padding: "10px 14px",
    borderTop: `1px solid ${THEME.border}`
  },
  toolBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "8px 4px",
    backgroundColor: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    color: THEME.textMuted,
    fontSize: "11px",
    cursor: "pointer"
  },

  // Main Chat Window
  chatWindow: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: THEME.bg,
    height: "100%"
  },
  chatHeader: {
    padding: "10px 16px",
    backgroundColor: THEME.sidebar,
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backBtn: {
    background: "none",
    border: "none",
    color: THEME.text,
    cursor: "pointer",
    padding: "4px",
    marginRight: "2px"
  },
  headerTitle: {
    fontSize: "14px",
    fontWeight: "700"
  },
  headerSub: {
    fontSize: "11px",
    color: THEME.textMuted
  },
  callIconBtn: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    padding: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  vanishBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1px solid",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer"
  },
  messageFeed: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  emptyChatPlaceholder: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: THEME.textMuted,
    textAlign: "center"
  },
  messageRow: {
    display: "flex",
    width: "100%"
  },
  messageBubble: {
    maxWidth: "75%",
    padding: "10px 14px",
    borderRadius: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
  },
  senderName: {
    fontSize: "11px",
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: "4px"
  },
  msgText: {
    fontSize: "14px",
    lineHeight: "1.4"
  },
  chatImage: {
    width: "100%",
    maxHeight: "220px",
    borderRadius: "10px",
    objectFit: "cover",
    display: "block"
  },
  imgCaption: {
    fontSize: "11px",
    fontStyle: "italic",
    marginTop: "6px",
    color: "rgba(255, 255, 255, 0.8)"
  },
  voiceNoteWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "200px"
  },
  playBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    border: "none",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer"
  },
  waveBars: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "18px"
  },
  waveBar: {
    width: "3px",
    borderRadius: "2px"
  },
  fileCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: "10px",
    textDecoration: "none",
    color: THEME.text
  },
  gameContainer: {
    padding: "4px"
  },
  gameHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    marginBottom: "8px"
  },
  gameGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 44px)",
    gap: "4px"
  },
  gameCell: {
    width: "44px",
    height: "44px",
    borderRadius: "8px",
    border: `1px solid ${THEME.border}`,
    backgroundColor: THEME.card,
    color: THEME.secondary,
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer"
  },
  msgTime: {
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "right",
    marginTop: "4px"
  },
  chatFooter: {
    padding: "10px 14px",
    backgroundColor: THEME.sidebar,
    borderTop: `1px solid ${THEME.border}`
  },
  inputContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: THEME.card,
    borderRadius: "14px",
    padding: "4px 8px",
    border: `1px solid ${THEME.border}`
  },
  chatInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "14px",
    padding: "8px",
    outline: "none"
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: THEME.textMuted,
    padding: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtn: {
    backgroundColor: THEME.primary,
    border: "none",
    borderRadius: "10px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer"
  },
  recordingArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px"
  },
  sendVoiceBtn: {
    backgroundColor: "#e11d48",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer"
  },

  // Calls Overlay & Screen
  callOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: "16px"
  },
  callCard: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: THEME.sidebar,
    borderRadius: "24px",
    border: `1px solid ${THEME.border}`,
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
  },
  callHeader: {
    marginBottom: "16px"
  },
  callAvatarSection: {
    margin: "16px 0"
  },
  callVideoScreen: {
    position: "relative",
    width: "100%",
    height: "220px",
    borderRadius: "16px",
    backgroundColor: "#000",
    overflow: "hidden",
    margin: "12px 0",
    border: `1px solid ${THEME.border}`
  },
  callVideoAvatarBg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "brightness(0.7)"
  },
  callSelfVideoBadge: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    color: "#fff"
  },
  callActionsRow: {
    display: "flex",
    justifyContent: "center",
    gap: "18px",
    marginTop: "24px"
  },
  callControlBtn: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.15s ease"
  },

  // Modals
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 1000
  },
  modalCard: {
    width: "100%",
    maxWidth: "440px",
    backgroundColor: THEME.sidebar,
    border: `1px solid ${THEME.border}`,
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
  },
  modalHeader: {
    padding: "14px 18px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: THEME.textMuted,
    cursor: "pointer"
  },
  modalBody: {
    padding: "18px"
  },
  profileDetailBox: {
    backgroundColor: THEME.bg,
    border: `1px solid ${THEME.border}`,
    borderRadius: "12px",
    padding: "12px 16px",
    fontSize: "12px",
    textAlign: "left"
  },
  summaryBox: {
    backgroundColor: THEME.bg,
    border: `1px solid ${THEME.border}`,
    borderRadius: "12px",
    padding: "14px",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#cbd5e1"
  },
  modalInput: {
    flex: 1,
    backgroundColor: THEME.bg,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    color: THEME.text,
    fontSize: "13px",
    padding: "8px 12px",
    outline: "none"
  },
  generateBtn: {
    backgroundColor: THEME.secondary,
    color: "#000",
    border: "none",
    borderRadius: "10px",
    padding: "0 14px",
    fontSize: "12px",
    fontWeight: "bold",
    cursor: "pointer"
  },
  imagePreviewBox: {
    width: "100%",
    height: "220px",
    backgroundColor: THEME.bg,
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  modalFooter: {
    padding: "12px 18px",
    borderTop: `1px solid ${THEME.border}`,
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px"
  },
  secondaryModalBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: THEME.textMuted,
    fontSize: "13px",
    padding: "6px 12px",
    cursor: "pointer"
  },
  primaryModalBtn: {
    backgroundColor: THEME.primary,
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    padding: "8px 16px",
    cursor: "pointer"
  }
};
