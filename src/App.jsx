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
  Shield,
  Loader2,
  LogOut,
  User,
  Phone,
  Video,
  UserPlus,
  PhoneOff,
  Mic as MicIcon,
  VideoOff,
  CheckCircle,
  MessageSquare,
  Settings,
  Bell,
  Lock,
  Database,
  HelpCircle,
  Camera,
  Share2,
  Check,
  CheckCheck,
  ChevronRight,
  UserCheck,
  Info
} from "lucide-react";

// Theme Configuration
const THEME = {
  bg: "#0c101a",
  sidebar: "#131927",
  card: "#1a2235",
  cardHover: "#232e46",
  border: "#26324d",
  primary: "#6366f1",
  primaryHover: "#4f46e5",
  secondary: "#06b6d4",
  accent: "#10b981",
  danger: "#ef4444",
  vanish: "#a855f7",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  tickSent: "#94a3b8",
  tickRead: "#38bdf8"
};

// Global Registered Network Users for Real-time Verification
const REGISTERED_DIRECTORY = [
  {
    phone: "+880 1711-234567",
    name: "Amina Rahman",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140",
    about: "Hey there! I am using Infinity Chat.",
    isOnline: true
  },
  {
    phone: "+1 555-0199",
    name: "Engineering Squad 🚀",
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=140",
    about: "Sprint sync & release coordination",
    isOnline: true
  },
  {
    phone: "+44 7700-900077",
    name: "Sarah Lin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140",
    about: "Exploring AI agents & realtime sockets",
    isOnline: false
  },
  {
    phone: "+880 1819-887766",
    name: "Tariqul Islam",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140",
    about: "Coffee, code, repeat ☕",
    isOnline: true
  }
];

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140";

export default function App() {
  // -------------------------------------------------------------
  // 1. PERSISTENCE & USER SESSION
  // -------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_user_session");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Auth Inputs
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("+880 ");
  const [authAvatar, setAuthAvatar] = useState(DEFAULT_AVATAR);
  const [authError, setAuthError] = useState("");

  // -------------------------------------------------------------
  // 2. CONTACTS & CONVERSATIONS
  // -------------------------------------------------------------
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_contacts");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: "c_1",
        phone: "+880 1711-234567",
        name: "Amina Rahman",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140",
        lastSeen: "Online",
        isOnline: true
      },
      {
        id: "c_2",
        phone: "+1 555-0199",
        name: "Engineering Squad 🚀",
        avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=140",
        lastSeen: "Active 5m ago",
        isOnline: true
      }
    ];
  });

  const [activeContact, setActiveContact] = useState(contacts[0]);
  const [sidebarTab, setSidebarTab] = useState("chats"); // 'chats' | 'settings'
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat'
  const [searchTerm, setSearchTerm] = useState("");

  // -------------------------------------------------------------
  // 3. MULTI-ROOM MESSAGES MAP
  // -------------------------------------------------------------
  const [messagesMap, setMessagesMap] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_messages_store");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      c_1: [
        {
          id: "m_init_1",
          senderId: "c_1",
          senderName: "Amina Rahman",
          content: "Welcome to Infinity Chat! Everything is synced and encrypted.",
          status: "read", // 'sent' | 'delivered' | 'read'
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      c_2: [
        {
          id: "m_init_2",
          senderId: "c_2",
          senderName: "Engineering Squad",
          content: "System sprint initialized. Ready for deployment.",
          status: "read",
          createdAt: new Date().toISOString()
        }
      ]
    };
  });

  const currentMessages = messagesMap[activeContact?.id] || [];

  // Input & Recording
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [vanishMode, setVanishMode] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  // -------------------------------------------------------------
  // 4. MODALS & CALL STATE
  // -------------------------------------------------------------
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactSearchNumber, setContactSearchNumber] = useState("");
  const [inviteModalData, setInviteModalData] = useState(null); // When number not found

  const [activeCall, setActiveCall] = useState(null); // { type: 'voice' | 'video', status: 'ringing' | 'connected', secs: 0 }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Settings Sub-screens
  const [settingsView, setSettingsView] = useState("main"); // 'main' | 'profile' | 'privacy' | 'backup'

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarUploadRef = useRef(null);

  // Save to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("infinity_user_session", JSON.stringify(currentUser));
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("infinity_contacts", JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem("infinity_messages_store", JSON.stringify(messagesMap));
  }, [messagesMap]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Recording Timer
  useEffect(() => {
    let t;
    if (isRecording) {
      t = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } else {
      setRecordSecs(0);
    }
    return () => clearInterval(t);
  }, [isRecording]);

  // Call Duration Timer
  useEffect(() => {
    let ct;
    if (activeCall) {
      ct = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          if (prev.status === "ringing") {
            return { ...prev, status: "connected", secs: 1 };
          }
          return { ...prev, secs: prev.secs + 1 };
        });
      }, 1000);
    }
    return () => clearInterval(ct);
  }, [activeCall?.status]);

  // -------------------------------------------------------------
  // AUTH METHODS
  // -------------------------------------------------------------
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!authName.trim()) {
      setAuthError("Please enter your display name.");
      return;
    }
    if (!authPhone.trim() || authPhone.length < 8) {
      setAuthError("Please provide a valid phone number.");
      return;
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name: authName.trim(),
      phone: authPhone.trim(),
      avatar: authAvatar,
      about: "Hey there! I am using Infinity Chat.",
      joinedAt: new Date().toLocaleDateString()
    };

    setCurrentUser(newUser);
    setAuthError("");
  };

  const handleLogout = () => {
    localStorage.removeItem("infinity_user_session");
    setCurrentUser(null);
    setSidebarTab("chats");
    setMobileView("list");
  };

  // Avatar Upload Handler
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAuthAvatar(url);
    }
  };

  // -------------------------------------------------------------
  // CONTACT LOOKUP & INVITE SYSTEM
  // -------------------------------------------------------------
  const handleVerifyAndAddContact = (e) => {
    e.preventDefault();
    const query = contactSearchNumber.trim().replace(/\s+/g, "");
    if (!query) return;

    // Check directory
    const matchedUser = REGISTERED_DIRECTORY.find(
      (u) => u.phone.replace(/\s+/g, "") === query
    );

    if (matchedUser) {
      // Check if already in contacts
      const alreadyAdded = contacts.some((c) => c.phone === matchedUser.phone);
      if (alreadyAdded) {
        setActiveContact(contacts.find((c) => c.phone === matchedUser.phone));
        setShowAddContact(false);
        setContactSearchNumber("");
        setMobileView("chat");
        return;
      }

      const newContact = {
        id: `c_${Date.now()}`,
        phone: matchedUser.phone,
        name: matchedUser.name,
        avatar: matchedUser.avatar,
        lastSeen: matchedUser.isOnline ? "Online" : "Last seen recently",
        isOnline: matchedUser.isOnline
      };

      setContacts((prev) => [newContact, ...prev]);
      setActiveContact(newContact);
      setShowAddContact(false);
      setContactSearchNumber("");
      setMobileView("chat");
    } else {
      // Number not found -> Open Invite Modal
      setShowAddContact(false);
      setInviteModalData({
        phone: contactSearchNumber.trim(),
        inviteLink: `https://infinity-chat.web.app/invite?ref=${encodeURIComponent(currentUser.phone)}`
      });
      setContactSearchNumber("");
    }
  };

  // -------------------------------------------------------------
  // MESSAGING & SIMULATED INSTANT REPLY
  // -------------------------------------------------------------
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeContact) return;

    const newMsgId = `m_${Date.now()}`;
    const sentMsg = {
      id: newMsgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: inputText.trim(),
      type: "text",
      status: "sent",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    // 1. Add sent message
    setMessagesMap((prev) => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), sentMsg]
    }));

    setInputText("");

    // 2. Deliver tick after 1.2s
    setTimeout(() => {
      setMessagesMap((prev) => {
        const room = prev[activeContact.id] || [];
        return {
          ...prev,
          [activeContact.id]: room.map((m) => (m.id === newMsgId ? { ...m, status: "read" } : m))
        };
      });
    }, 1200);

    // 3. Automated Realistic Peer Response after 2.5s
    setTimeout(() => {
      const replyMsg = {
        id: `rep_${Date.now()}`,
        senderId: activeContact.id,
        senderName: activeContact.name,
        content: `Got it! Thanks for the update on Infinity Chat. 👍`,
        type: "text",
        status: "read",
        createdAt: new Date().toISOString()
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeContact.id]: [...(prev[activeContact.id] || []), replyMsg]
      }));
    }, 2800);

    // Vanish handling
    if (vanishMode) {
      setTimeout(() => {
        setMessagesMap((prev) => ({
          ...prev,
          [activeContact.id]: (prev[activeContact.id] || []).filter((m) => m.id !== newMsgId)
        }));
      }, 15000);
    }
  };

  const handleSendVoice = () => {
    const dur = recordSecs || 3;
    setIsRecording(false);

    const voiceMsg = {
      id: `v_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: `Voice Message (${dur}s)`,
      duration: dur,
      type: "voice",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), voiceMsg]
    }));

    setTimeout(() => {
      setMessagesMap((prev) => {
        const room = prev[activeContact.id] || [];
        return {
          ...prev,
          [activeContact.id]: room.map((m) => (m.id === voiceMsg.id ? { ...m, status: "read" } : m))
        };
      });
    }, 1000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact) return;

    const isImg = file.type.startsWith("image/");
    const blobUrl = URL.createObjectURL(file);

    const fileMsg = {
      id: `f_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: file.name,
      fileUrl: blobUrl,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      type: isImg ? "image" : "file",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), fileMsg]
    }));
  };

  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION / ONBOARDING SCREEN
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={styles.authLogoCircle}>
              <MessageSquare size={34} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: THEME.text, margin: 0 }}>
              Infinity Chat
            </h1>
            <p style={{ fontSize: "13px", color: THEME.textMuted, marginTop: "6px" }}>
              Next-generation WhatsApp & Telegram web client.
            </p>
          </div>

          {authError && <div style={styles.authErrorAlert}>{authError}</div>}

          <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Custom Avatar Upload */}
            <div style={{ textAlign: "center" }}>
              <input
                type="file"
                ref={avatarUploadRef}
                onChange={handleAvatarFile}
                accept="image/*"
                style={{ display: "none" }}
              />
              <div
                onClick={() => avatarUploadRef.current?.click()}
                style={styles.avatarUploadWrapper}
                title="Click to choose custom profile picture"
              >
                <img src={authAvatar} alt="" style={styles.avatarUploadImg} />
                <div style={styles.avatarCameraBadge}>
                  <Camera size={14} color="#fff" />
                </div>
              </div>
              <span style={{ fontSize: "11px", color: THEME.textMuted }}>Tap to choose photo</span>
            </div>

            <div>
              <label style={styles.inputLabel}>Display Name</label>
              <div style={styles.inputWrapper}>
                <User size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  style={styles.rawInput}
                />
              </div>
            </div>

            <div>
              <label style={styles.inputLabel}>Phone Number</label>
              <div style={styles.inputWrapper}>
                <Phone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="tel"
                  placeholder="+880 1711-000000"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  style={styles.rawInput}
                />
              </div>
            </div>

            <button type="submit" style={styles.authSubmitBtn}>
              <span>Enter Messenger</span>
              <CheckCircle size={18} />
            </button>
          </form>

          <div style={styles.authSecurityNote}>
            <Lock size={12} style={{ marginRight: "4px" }} />
            <span>End-to-End Encrypted & Persistent Local Session</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: FULL RESPONSIVE APP (SIDEBAR & CHAT WINDOW)
  // -------------------------------------------------------------
  return (
    <div style={styles.appContainer}>
      {/* ----------------- SIDEBAR ----------------- */}
      <aside
        style={{
          ...styles.sidebar,
          display: mobileView === "chat" ? "none" : "flex"
        }}
        className="app-sidebar"
      >
        {/* Top User Bar */}
        <div style={styles.userHeader}>
          <div
            onClick={() => setSidebarTab("settings")}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          >
            <img src={currentUser.avatar} alt="" style={styles.avatarMedium} />
            <div>
              <div style={styles.userNameText}>{currentUser.name}</div>
              <div style={{ fontSize: "11px", color: THEME.accent }}>● Online</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setShowAddContact(true)}
              style={styles.iconCircleBtn}
              title="Add New Contact"
            >
              <UserPlus size={16} color={THEME.secondary} />
            </button>
            <button
              onClick={() => setSidebarTab(sidebarTab === "chats" ? "settings" : "chats")}
              style={{
                ...styles.iconCircleBtn,
                backgroundColor: sidebarTab === "settings" ? THEME.primary : THEME.card
              }}
              title="Settings & Privacy"
            >
              <Settings size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* SIDEBAR TAB 1: CHATS LIST */}
        {sidebarTab === "chats" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Search Bar */}
            <div style={styles.searchBox}>
              <Search size={16} color={THEME.textMuted} style={{ marginRight: "8px" }} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.rawInput}
              />
            </div>

            {/* List Header */}
            <div style={styles.listHeaderRow}>
              <span>CHATS ({filteredContacts.length})</span>
              <button onClick={() => setShowAddContact(true)} style={styles.linkButton}>
                + New Contact
              </button>
            </div>

            {/* Contact Items */}
            <div style={styles.contactScrollArea}>
              {filteredContacts.map((contact) => {
                const isActive = contact.id === activeContact?.id;
                const roomMsgs = messagesMap[contact.id] || [];
                const lastMsg = roomMsgs[roomMsgs.length - 1];

                return (
                  <div
                    key={contact.id}
                    onClick={() => {
                      setActiveContact(contact);
                      setMobileView("chat");
                    }}
                    style={{
                      ...styles.contactItem,
                      backgroundColor: isActive ? THEME.cardHover : "transparent",
                      borderLeft: isActive ? `3px solid ${THEME.primary}` : "3px solid transparent"
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <img src={contact.avatar} alt="" style={styles.avatarMedium} />
                      {contact.isOnline && <div style={styles.activeDot} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.itemTitleRow}>
                        <span style={styles.contactName}>{contact.name}</span>
                        {lastMsg && (
                          <span style={styles.timestampText}>
                            {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        )}
                      </div>

                      <div style={styles.lastMsgRow}>
                        {lastMsg && lastMsg.senderId === currentUser.id && (
                          <span style={{ marginRight: "4px", display: "inline-flex" }}>
                            {lastMsg.status === "read" ? (
                              <CheckCheck size={14} color={THEME.tickRead} />
                            ) : (
                              <Check size={14} color={THEME.tickSent} />
                            )}
                          </span>
                        )}
                        <span style={styles.lastMsgText}>
                          {lastMsg ? lastMsg.content : contact.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SIDEBAR TAB 2: WHATSAPP-STYLE SETTINGS DRAWER */}
        {sidebarTab === "settings" && (
          <div style={styles.settingsDrawer}>
            <div style={styles.settingsDrawerHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Settings size={18} color={THEME.secondary} />
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>Settings</span>
              </div>
              <button
                onClick={() => setSidebarTab("chats")}
                style={styles.closeDrawerBtn}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.settingsBody}>
              {/* Profile Card Summary */}
              <div style={styles.settingsProfileCard}>
                <img src={currentUser.avatar} alt="" style={styles.avatarLarge} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: "700", fontSize: "15px" }}>{currentUser.name}</div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>{currentUser.phone}</div>
                  <div style={{ fontSize: "11px", color: THEME.accent, marginTop: "2px" }}>
                    "{currentUser.about}"
                  </div>
                </div>
              </div>

              {/* Menu List */}
              <div style={styles.settingsGroup}>
                <div style={styles.settingsItem}>
                  <div style={styles.settingsItemLeft}>
                    <Lock size={18} color="#a855f7" />
                    <div>
                      <div style={styles.settingsItemTitle}>Privacy & Security</div>
                      <div style={styles.settingsItemSub}>End-to-End Encryption, Vanish Mode</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={THEME.textMuted} />
                </div>

                <div style={styles.settingsItem}>
                  <div style={styles.settingsItemLeft}>
                    <Bell size={18} color="#f59e0b" />
                    <div>
                      <div style={styles.settingsItemTitle}>Notifications</div>
                      <div style={styles.settingsItemSub}>Sound alerts, Popups, Tone</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={THEME.textMuted} />
                </div>

                <div style={styles.settingsItem}>
                  <div style={styles.settingsItemLeft}>
                    <Database size={18} color="#06b6d4" />
                    <div>
                      <div style={styles.settingsItemTitle}>Chat Backup & Storage</div>
                      <div style={styles.settingsItemSub}>LocalStorage Synced (Auto-Persistent)</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={THEME.textMuted} />
                </div>

                <div style={styles.settingsItem}>
                  <div style={styles.settingsItemLeft}>
                    <HelpCircle size={18} color="#10b981" />
                    <div>
                      <div style={styles.settingsItemTitle}>Help & FAQ</div>
                      <div style={styles.settingsItemSub}>Infinity Chat v2.5 Architecture</div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={THEME.textMuted} />
                </div>
              </div>

              {/* Logout Button */}
              <button onClick={handleLogout} style={styles.logoutBtn}>
                <LogOut size={16} />
                <span>Log Out of Infinity Chat</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ----------------- ACTIVE CHAT AREA ----------------- */}
      <main
        style={{
          ...styles.chatWindow,
          display: mobileView === "list" ? "none" : "flex"
        }}
        className="app-chat-window"
      >
        {/* Top Header Controls (Audio/Video Calls) */}
        <header style={styles.chatHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setMobileView("list")}
              style={styles.mobileBackBtn}
              className="mobile-back-btn"
            >
              <ArrowLeft size={18} />
            </button>
            <div style={{ position: "relative" }}>
              <img src={activeContact?.avatar} alt="" style={styles.avatarMedium} />
              {activeContact?.isOnline && <div style={styles.activeDot} />}
            </div>
            <div>
              <div style={styles.headerTitle}>{activeContact?.name}</div>
              <div style={styles.headerSub}>
                {vanishMode ? "🔒 Vanish mode: 15s auto-wipe" : activeContact?.lastSeen || "Online"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Audio Call Action */}
            <button
              onClick={() => setActiveCall({ type: "voice", status: "ringing", secs: 0 })}
              style={styles.callIconBtn}
              title="Voice Call"
            >
              <Phone size={17} color={THEME.secondary} />
            </button>

            {/* Video Call Action */}
            <button
              onClick={() => setActiveCall({ type: "video", status: "ringing", secs: 0 })}
              style={styles.callIconBtn}
              title="Video Call"
            >
              <Video size={17} color={THEME.accent} />
            </button>

            {/* Vanish Mode Switch */}
            <button
              onClick={() => setVanishMode(!vanishMode)}
              style={{
                ...styles.vanishToggleBtn,
                backgroundColor: vanishMode ? "rgba(168, 85, 247, 0.25)" : THEME.card,
                borderColor: vanishMode ? THEME.vanish : THEME.border,
                color: vanishMode ? "#e9d5ff" : THEME.textMuted
              }}
              title="Disappearing messages"
            >
              <Timer size={14} />
              <span className="hide-mobile">Vanish {vanishMode ? "ON" : "OFF"}</span>
            </button>
          </div>
        </header>

        {/* Message Feed Area */}
        <div style={styles.messageFeed}>
          {currentMessages.length === 0 ? (
            <div style={styles.emptyFeedPlaceholder}>
              <MessageSquare size={38} color={THEME.textMuted} style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "14px", fontWeight: "600" }}>
                No messages yet with {activeContact?.name}
              </div>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "4px 0 0" }}>
                Send a message or try typing <code>/imagine [prompt]</code>
              </p>
            </div>
          ) : (
            currentMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.msgRow,
                    justifyContent: isMe ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      ...styles.msgBubble,
                      backgroundColor: msg.isVanish
                        ? "rgba(88, 28, 135, 0.4)"
                        : isMe
                        ? THEME.primary
                        : THEME.card,
                      border: msg.isVanish
                        ? "1px solid rgba(168, 85, 247, 0.6)"
                        : `1px solid ${THEME.border}`,
                      borderBottomRightRadius: isMe ? "4px" : "16px",
                      borderBottomLeftRadius: !isMe ? "4px" : "16px"
                    }}
                  >
                    <div style={styles.msgSenderName}>{msg.senderName}</div>

                    {/* Text Message */}
                    {msg.type === "text" && <div style={styles.msgContentText}>{msg.content}</div>}

                    {/* Image Attachment */}
                    {msg.type === "image" && (
                      <div>
                        <img src={msg.fileUrl} alt="" style={styles.chatImage} />
                        {msg.content && <div style={styles.imgCaptionText}>"{msg.content}"</div>}
                      </div>
                    )}

                    {/* Voice Note Bar */}
                    {msg.type === "voice" && (
                      <div style={styles.voiceNoteRow}>
                        <button
                          onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)}
                          style={styles.voicePlayBtn}
                        >
                          {playingVoiceId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div style={styles.voiceWaves}>
                          {[35, 75, 25, 90, 60, 100, 45, 80, 50, 70].map((h, idx) => (
                            <span
                              key={idx}
                              style={{
                                ...styles.waveStem,
                                height: `${h}%`,
                                backgroundColor: playingVoiceId === msg.id ? THEME.secondary : "#ffffffaa"
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: "11px", color: THEME.textMuted }}>{msg.duration}s</span>
                      </div>
                    )}

                    {/* Document File */}
                    {msg.type === "file" && (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={styles.fileAttachmentCard}>
                        <FileText size={20} color={THEME.secondary} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600" }}>{msg.content}</div>
                          <div style={{ fontSize: "10px", color: THEME.textMuted }}>{msg.fileSize}</div>
                        </div>
                      </a>
                    )}

                    {/* Bottom Metadata & Double Blue Ticks */}
                    <div style={styles.msgMetaRow}>
                      <span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.6)" }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      {isMe && (
                        <span style={{ display: "inline-flex", marginLeft: "4px" }}>
                          {msg.status === "read" ? (
                            <CheckCheck size={14} color={THEME.tickRead} />
                          ) : (
                            <Check size={14} color={THEME.tickSent} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ----------------- FIXED BOTTOM INPUT DOCK ----------------- */}
        <footer style={styles.chatFooter}>
          <div style={styles.dockInputContainer}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={styles.dockIconButton}
              title="Attach media or document"
            >
              <Paperclip size={18} />
            </button>

            {isRecording ? (
              <div style={styles.recordingDock}>
                <span style={{ color: THEME.danger, fontSize: "13px", fontWeight: "bold" }}>
                  ● Recording Voice: {recordSecs}s
                </span>
                <button onClick={handleSendVoice} style={styles.sendVoiceActionBtn}>
                  Send Voice Note
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder={
                  vanishMode
                    ? "Disappearing message..."
                    : `Message ${activeContact?.name || ""}...`
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                style={styles.dockInputField}
              />
            )}

            {!inputText.trim() && !isRecording ? (
              <button
                onClick={() => setIsRecording(true)}
                style={styles.dockIconButton}
                title="Hold / Tap to record voice note"
              >
                <Mic size={18} />
              </button>
            ) : isRecording ? (
              <button onClick={() => setIsRecording(false)} style={styles.dockIconButton}>
                <MicOff size={18} color={THEME.danger} />
              </button>
            ) : (
              <button onClick={handleSendMessage} style={styles.sendActionButton}>
                <Send size={15} color="#ffffff" />
              </button>
            )}
          </div>
        </footer>
      </main>

      {/* ----------------- 1. ADD CONTACT MODAL ----------------- */}
      {showAddContact && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color={THEME.secondary} />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Add Contact / Friend</span>
              </div>
              <button onClick={() => setShowAddContact(false)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyAndAddContact} style={{ padding: "18px" }}>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "0 0 12px" }}>
                Enter your friend's phone number. Infinity Chat checks against the global directory.
              </p>

              <label style={styles.inputLabel}>Mobile Number</label>
              <div style={styles.inputWrapper}>
                <Phone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="tel"
                  placeholder="+880 1711-234567 or +1 555-0199"
                  value={contactSearchNumber}
                  onChange={(e) => setContactSearchNumber(e.target.value)}
                  style={styles.rawInput}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  style={styles.ghostBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.modalPrimaryBtn}>
                  Verify & Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- 2. NUMBER NOT FOUND / INVITE MODAL ----------------- */}
      {inviteModalData && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={{ ...styles.modalHeader, borderBottom: "none", paddingBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={18} color="#f59e0b" />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Account Not Found</span>
              </div>
              <button onClick={() => setInviteModalData(null)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px 22px", textAlign: "center" }}>
              <div style={styles.inviteIconCircle}>
                <Share2 size={26} color={THEME.secondary} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "10px 0 4px" }}>
                {inviteModalData.phone}
              </h3>
              <p style={{ fontSize: "12px", color: THEME.textMuted, lineHeight: "1.5" }}>
                This phone number is not registered on Infinity Chat yet. You can invite them to join!
              </p>

              <div style={styles.inviteLinkBox}>
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>{inviteModalData.inviteLink}</span>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteModalData.inviteLink);
                  alert("Invitation link copied to clipboard!");
                  setInviteModalData(null);
                }}
                style={{ ...styles.modalPrimaryBtn, width: "100%", marginTop: "12px" }}
              >
                Copy Invite Link & Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 3. VOICE / VIDEO CALL MODAL ----------------- */}
      {activeCall && (
        <div style={styles.callBackdrop}>
          <div style={styles.callCardBox}>
            <div style={{ fontSize: "12px", color: THEME.textMuted, marginBottom: "8px" }}>
              {activeCall.type === "video" ? "Infinity HD Video Call" : "Infinity Encrypted Voice Call"}
            </div>

            {/* Video Preview or Avatar */}
            {activeCall.type === "video" && !isVideoOff ? (
              <div style={styles.callVideoViewport}>
                <img src={activeContact?.avatar} alt="" style={styles.callVideoAvatarBg} />
                <div style={styles.callSelfBadge}>You (Camera On)</div>
              </div>
            ) : (
              <div style={{ margin: "20px 0" }}>
                <img
                  src={activeContact?.avatar}
                  alt=""
                  style={{
                    width: "88px",
                    height: "88px",
                    borderRadius: "50%",
                    border: `3px solid ${activeCall.status === "connected" ? THEME.accent : THEME.primary}`,
                    boxShadow: "0 0 30px rgba(99, 102, 241, 0.4)"
                  }}
                />
              </div>
            )}

            <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "8px 0 4px" }}>
              {activeContact?.name}
            </h2>
            <div style={{ fontSize: "13px", color: activeCall.status === "connected" ? THEME.accent : THEME.textMuted }}>
              {activeCall.status === "connected"
                ? `Connected (${Math.floor(activeCall.secs / 60)}:${(activeCall.secs % 60).toString().padStart(2, "0")})`
                : "Ringing..."}
            </div>

            {/* Call Action Controls */}
            <div style={styles.callControlRow}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                style={{
                  ...styles.callBtnCircle,
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
                    ...styles.callBtnCircle,
                    backgroundColor: isVideoOff ? THEME.danger : THEME.card
                  }}
                  title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
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
                  ...styles.callBtnCircle,
                  backgroundColor: THEME.danger,
                  transform: "scale(1.15)"
                }}
                title="End Call"
              >
                <PhoneOff size={20} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Breakpoint CSS */}
      <style>{`
        @media (min-width: 768px) {
          .app-sidebar {
            display: flex !important;
            width: 330px !important;
          }
          .app-chat-window {
            display: flex !important;
          }
          .mobile-back-btn {
            display: none !important;
          }
        }
        @media (max-width: 520px) {
          .hide-mobile {
            display: none !important;
          }
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
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
  },
  authLogoCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    backgroundColor: THEME.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    boxShadow: "0 8px 20px rgba(99, 102, 241, 0.4)"
  },
  avatarUploadWrapper: {
    position: "relative",
    width: "72px",
    height: "72px",
    margin: "0 auto 6px",
    cursor: "pointer"
  },
  avatarUploadImg: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    border: `2px solid ${THEME.primary}`
  },
  avatarCameraBadge: {
    position: "absolute",
    bottom: "0",
    right: "0",
    backgroundColor: THEME.primary,
    borderRadius: "50%",
    padding: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  inputLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: THEME.textMuted,
    marginBottom: "6px"
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    backgroundColor: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "12px",
    padding: "10px 14px"
  },
  rawInput: {
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "13px",
    width: "100%",
    outline: "none"
  },
  authSubmitBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    backgroundColor: THEME.primary,
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "14px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "6px",
    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)"
  },
  authErrorAlert: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "12px",
    marginBottom: "14px"
  },
  authSecurityNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    color: THEME.textMuted,
    marginTop: "18px"
  },

  // Main Layout Styles
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
  userHeader: {
    padding: "14px 16px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  avatarMedium: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    objectFit: "cover"
  },
  avatarLarge: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    objectFit: "cover"
  },
  activeDot: {
    position: "absolute",
    bottom: "0",
    right: "0",
    width: "10px",
    height: "10px",
    backgroundColor: THEME.accent,
    borderRadius: "50%",
    border: `2px solid ${THEME.sidebar}`
  },
  userNameText: {
    fontSize: "14px",
    fontWeight: "700"
  },
  iconCircleBtn: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    padding: "7px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    margin: "12px 14px 6px",
    padding: "8px 12px",
    backgroundColor: THEME.card,
    borderRadius: "10px",
    border: `1px solid ${THEME.border}`
  },
  listHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    fontSize: "11px",
    fontWeight: "700",
    color: THEME.textMuted
  },
  linkButton: {
    background: "none",
    border: "none",
    color: THEME.secondary,
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer"
  },
  contactScrollArea: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 8px"
  },
  contactItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.15s ease",
    marginBottom: "3px"
  },
  itemTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  contactName: {
    fontSize: "13px",
    fontWeight: "600",
    color: THEME.text
  },
  timestampText: {
    fontSize: "10px",
    color: THEME.textMuted
  },
  lastMsgRow: {
    display: "flex",
    alignItems: "center",
    marginTop: "2px"
  },
  lastMsgText: {
    fontSize: "12px",
    color: THEME.textMuted,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  // Settings Drawer View
  settingsDrawer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden"
  },
  settingsDrawerHeader: {
    padding: "14px 16px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  closeDrawerBtn: {
    background: "none",
    border: "none",
    color: THEME.textMuted,
    cursor: "pointer"
  },
  settingsBody: {
    padding: "16px",
    overflowY: "auto",
    flex: 1
  },
  settingsProfileCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px",
    backgroundColor: THEME.card,
    borderRadius: "14px",
    border: `1px solid ${THEME.border}`,
    marginBottom: "16px"
  },
  settingsGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "20px"
  },
  settingsItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    backgroundColor: THEME.card,
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`,
    cursor: "pointer"
  },
  settingsItemLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  settingsItemTitle: {
    fontSize: "13px",
    fontWeight: "600"
  },
  settingsItemSub: {
    fontSize: "11px",
    color: THEME.textMuted,
    marginTop: "2px"
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#f87171",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer"
  },

  // Chat Area
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
  mobileBackBtn: {
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
  vanishToggleBtn: {
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

  // Message Feed
  messageFeed: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  emptyFeedPlaceholder: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: THEME.textMuted,
    textAlign: "center"
  },
  msgRow: {
    display: "flex",
    width: "100%"
  },
  msgBubble: {
    maxWidth: "75%",
    padding: "10px 14px",
    borderRadius: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
  },
  msgSenderName: {
    fontSize: "11px",
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: "4px"
  },
  msgContentText: {
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
  imgCaptionText: {
    fontSize: "11px",
    fontStyle: "italic",
    marginTop: "6px",
    color: "rgba(255, 255, 255, 0.8)"
  },
  voiceNoteRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "200px"
  },
  voicePlayBtn: {
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
  voiceWaves: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "18px"
  },
  waveStem: {
    width: "3px",
    borderRadius: "2px"
  },
  fileAttachmentCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: "10px",
    textDecoration: "none",
    color: THEME.text
  },
  msgMetaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: "4px"
  },

  // Dock Bottom Input
  chatFooter: {
    padding: "10px 14px",
    backgroundColor: THEME.sidebar,
    borderTop: `1px solid ${THEME.border}`
  },
  dockInputContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: THEME.card,
    borderRadius: "14px",
    padding: "4px 8px",
    border: `1px solid ${THEME.border}`
  },
  dockInputField: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "14px",
    padding: "8px",
    outline: "none"
  },
  dockIconButton: {
    background: "none",
    border: "none",
    color: THEME.textMuted,
    padding: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  sendActionButton: {
    backgroundColor: THEME.primary,
    border: "none",
    borderRadius: "10px",
    width: "34px",
    height: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer"
  },
  recordingDock: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px"
  },
  sendVoiceActionBtn: {
    backgroundColor: THEME.danger,
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer"
  },

  // Modals & Overlays
  modalBackdrop: {
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
  modalBox: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: THEME.sidebar,
    border: `1px solid ${THEME.border}`,
    borderRadius: "18px",
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
  ghostBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: THEME.textMuted,
    fontSize: "13px",
    padding: "8px 14px",
    cursor: "pointer"
  },
  modalPrimaryBtn: {
    backgroundColor: THEME.primary,
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    padding: "8px 16px",
    cursor: "pointer"
  },
  inviteIconCircle: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto"
  },
  inviteLinkBox: {
    backgroundColor: THEME.bg,
    border: `1px solid ${THEME.border}`,
    padding: "10px 12px",
    borderRadius: "10px",
    margin: "12px 0",
    wordBreak: "break-all"
  },

  // Voice/Video Call Overlay
  callBackdrop: {
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
  callCardBox: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: THEME.sidebar,
    borderRadius: "24px",
    border: `1px solid ${THEME.border}`,
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
  },
  callVideoViewport: {
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
  callSelfBadge: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    color: "#fff"
  },
  callControlRow: {
    display: "flex",
    justifyContent: "center",
    gap: "18px",
    marginTop: "24px"
  },
  callBtnCircle: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }
};
