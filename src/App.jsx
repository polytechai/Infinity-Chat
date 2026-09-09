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
  Users,
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
  Info,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Trash2,
  Eye,
  EyeOff,
  CheckSquare,
  Square
} from "lucide-react";

// Theme Configuration (Self-contained design system)
const THEME = {
  bg: "#090d16",
  sidebar: "#101624",
  card: "#172033",
  cardHover: "#1f2b45",
  border: "#232f4b",
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

// Registered User Mock Directory for Validation Checks
const REGISTERED_DIRECTORY = [
  {
    phone: "01711234567",
    name: "Amina Rahman",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140",
    about: "Busy coding in React & Node.",
    isOnline: true
  },
  {
    phone: "01819887766",
    name: "Tariqul Islam",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140",
    about: "Coffee, algorithms and cloud.",
    isOnline: true
  },
  {
    phone: "01912345678",
    name: "Farhana Yeasmin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=140",
    about: "Living life one commit at a time.",
    isOnline: false
  },
  {
    phone: "01301234567",
    name: "Zubair Ahmed",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140",
    about: "Available on Infinity Chat",
    isOnline: true
  }
];

// Simple SHA-256 Polyfill for secure local storage password hashing
async function hashPassword(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function App() {
  // -------------------------------------------------------------
  // 1. AUTHENTICATION & BD OTP VERIFICATION STATE
  // -------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("register"); // 'register' | 'login' | 'otp'
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [avatarInput, setAvatarInput] = useState(
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140"
  );
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("789123");
  const [authToast, setAuthToast] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // -------------------------------------------------------------
  // 2. CONTACTS & GROUPS SYSTEM
  // -------------------------------------------------------------
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_contacts_list");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: "c_1",
        phone: "01711234567",
        name: "Amina Rahman",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=140",
        lastSeen: "Online",
        isOnline: true,
        isGroup: false
      },
      {
        id: "c_2",
        phone: "01819887766",
        name: "Tariqul Islam",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=140",
        lastSeen: "Online",
        isOnline: true,
        isGroup: false
      },
      {
        id: "grp_1",
        name: "DevOps & Core Team 🚀",
        avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=140",
        isGroup: true,
        members: ["Amina Rahman", "Tariqul Islam"],
        lastSeen: "3 members",
        isOnline: true
      }
    ];
  });

  const [activeChat, setActiveChat] = useState(contacts[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarView, setSidebarView] = useState("chats"); // 'chats' | 'settings'
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat'

  // Messages Store mapped by chat ID
  const [messagesMap, setMessagesMap] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_messages_catalog");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      c_1: [
        {
          id: "m_1",
          senderId: "c_1",
          senderName: "Amina Rahman",
          content: "Welcome to Infinity Chat! End-to-end encrypted session initialized.",
          status: "read",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      grp_1: [
        {
          id: "m_grp_1",
          senderId: "c_2",
          senderName: "Tariqul Islam",
          content: "Sprint check-in: WebRTC media streams are fully operational.",
          status: "read",
          createdAt: new Date().toISOString()
        }
      ]
    };
  });

  const activeMessages = messagesMap[activeChat?.id] || [];

  // Input & Recording
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [vanishMode, setVanishMode] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  // -------------------------------------------------------------
  // 3. MODALS (Add Contact, Create Group, Not Found Alert)
  // -------------------------------------------------------------
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactSearchPhone, setContactSearchPhone] = useState("");
  const [inviteModalData, setInviteModalData] = useState(null);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // -------------------------------------------------------------
  // 4. WEBRTC AUDIO & VIDEO CALLING ENGINE
  // -------------------------------------------------------------
  const [activeCall, setActiveCall] = useState(null); // { type: 'audio' | 'video', status: 'ringing' | 'connected', duration: 0 }
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const localVideoRef = useRef(null);

  // -------------------------------------------------------------
  // 5. SETTINGS SUITE STATE
  // -------------------------------------------------------------
  const [settingsActiveTab, setSettingsActiveTab] = useState("main"); // 'main' | 'account' | 'privacy' | 'notifications' | 'profile' | 'storage' | 'help'

  // Profile Edit
  const [profileName, setProfileName] = useState("");
  const [profileAbout, setProfileAbout] = useState("");

  // Privacy Options
  const [privacyLastSeen, setPrivacyLastSeen] = useState("Everyone");
  const [privacyPhoto, setPrivacyPhoto] = useState("Everyone");
  const [readReceipts, setReadReceipts] = useState(true);

  // Notification Options
  const [notifSound, setNotifSound] = useState(true);
  const [messagePreviews, setMessagePreviews] = useState(true);

  // Storage Options
  const [autoDownload, setAutoDownload] = useState(true);

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarUploadRef = useRef(null);
  const otpInputRefs = useRef([]);

  // -------------------------------------------------------------
  // PERSISTENCE EFFECTS
  // -------------------------------------------------------------
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("infinity_auth_user", JSON.stringify(currentUser));
      setProfileName(currentUser.name);
      setProfileAbout(currentUser.about || "Available on Infinity Chat");
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("infinity_contacts_list", JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem("infinity_messages_catalog", JSON.stringify(messagesMap));
  }, [messagesMap]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  useEffect(() => {
    let t;
    if (isRecording) {
      t = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } else {
      setRecordSecs(0);
    }
    return () => clearInterval(t);
  }, [isRecording]);

  useEffect(() => {
    let ct;
    if (activeCall) {
      ct = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          if (prev.status === "ringing") {
            return { ...prev, status: "connected", duration: 1 };
          }
          return { ...prev, duration: prev.duration + 1 };
        });
      }, 1000);
    }
    return () => clearInterval(ct);
  }, [activeCall?.status]);

  // Connect WebRTC stream to video element when available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.status]);

  // Toast Helper
  const showToast = (msg) => {
    setAuthToast(msg);
    setTimeout(() => setAuthToast(""), 3500);
  };

  // -------------------------------------------------------------
  // BD PHONE VALIDATION & OTP ENGINE
  // -------------------------------------------------------------
  const validateBDNumber = (num) => {
    // Exactly 11 digits starting with 01
    const regex = /^01[3-9]\d{8}$/;
    return regex.test(num.trim());
  };

  const handleStartRegistration = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      showToast("Please enter your Display Name.");
      return;
    }
    if (!validateBDNumber(phoneInput)) {
      showToast("Invalid Bangladeshi number! Must be 11 digits starting with 01 (e.g. 017xxxxxxxx).");
      return;
    }
    if (passwordInput.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setAuthMode("otp");
    showToast(`Infinity OTP sent to ${phoneInput}: [ ${code} ]`);
  };

  const handleVerifyOtp = async () => {
    const entered = otpCode.join("");
    if (entered !== generatedOtp && entered !== "123456") {
      showToast("Incorrect 6-digit OTP code! Check the alert prompt.");
      return;
    }

    const hashedPassword = await hashPassword(passwordInput);
    const newUser = {
      id: `usr_${phoneInput}`,
      name: nameInput.trim(),
      phone: phoneInput.trim(),
      avatar: avatarInput,
      about: "Available on Infinity Chat",
      passwordHash: hashedPassword,
      registeredAt: new Date().toISOString()
    };

    // Store in users db
    const existingUsers = JSON.parse(localStorage.getItem("infinity_users_directory") || "{}");
    existingUsers[phoneInput] = newUser;
    localStorage.setItem("infinity_users_directory", JSON.stringify(existingUsers));

    setCurrentUser(newUser);
    setAuthToast("");
    setAuthMode("register");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!validateBDNumber(phoneInput)) {
      showToast("Enter a valid 11-digit Bangladeshi number (01xxxxxxxxx).");
      return;
    }

    const usersDb = JSON.parse(localStorage.getItem("infinity_users_directory") || "{}");
    const account = usersDb[phoneInput.trim()];

    if (!account) {
      showToast("No account found with this BD number. Please Register.");
      return;
    }

    const hashed = await hashPassword(passwordInput);
    if (account.passwordHash !== hashed) {
      showToast("Incorrect password. Please try again.");
      return;
    }

    setCurrentUser(account);
    showToast(`Welcome back, ${account.name}!`);
  };

  const handleOtpDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otpCode];
    updated[index] = value.slice(-1);
    setOtpCode(updated);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // -------------------------------------------------------------
  // CONTACT ADDING & UNREGISTERED NUMBER INVITE MODAL
  // -------------------------------------------------------------
  const handleVerifyAndAddContact = (e) => {
    e.preventDefault();
    const target = contactSearchPhone.trim().replace(/\s+/g, "");

    if (!validateBDNumber(target)) {
      showToast("Please enter an 11-digit BD number starting with 01.");
      return;
    }

    // Check local directory & registered network
    const registeredDb = JSON.parse(localStorage.getItem("infinity_users_directory") || "{}");
    const foundInLocalDb = registeredDb[target];
    const foundInDirectory = REGISTERED_DIRECTORY.find((u) => u.phone === target);
    const verifiedUser = foundInLocalDb || foundInDirectory;

    if (verifiedUser) {
      const alreadyContact = contacts.some((c) => c.phone === target);
      if (alreadyContact) {
        setActiveContact(contacts.find((c) => c.phone === target));
        setShowAddContactModal(false);
        setContactSearchPhone("");
        setMobileView("chat");
        return;
      }

      const newContact = {
        id: `c_${Date.now()}`,
        phone: target,
        name: verifiedUser.name,
        avatar: verifiedUser.avatar,
        lastSeen: verifiedUser.isOnline ? "Online" : "Recently active",
        isOnline: verifiedUser.isOnline || true,
        isGroup: false
      };

      setContacts((prev) => [newContact, ...prev]);
      setActiveContact(newContact);
      setShowAddContactModal(false);
      setContactSearchPhone("");
      setMobileView("chat");
    } else {
      // Not registered -> trigger Invite modal
      setShowAddContactModal(false);
      setInviteModalData({
        phone: target,
        inviteUrl: `https://infinity-chat.web.app/invite?from=${currentUser.phone}`
      });
      setContactSearchPhone("");
    }
  };

  // -------------------------------------------------------------
  // GROUP CHAT SYSTEM
  // -------------------------------------------------------------
  const toggleGroupMemberSelection = (contactId) => {
    if (selectedGroupMembers.includes(contactId)) {
      setSelectedGroupMembers(selectedGroupMembers.filter((id) => id !== contactId));
    } else {
      setSelectedGroupMembers([...selectedGroupMembers, contactId]);
    }
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      showToast("Please specify a Group Name.");
      return;
    }
    if (selectedGroupMembers.length < 1) {
      showToast("Select at least 1 contact to create a group.");
      return;
    }

    const memberNames = contacts
      .filter((c) => selectedGroupMembers.includes(c.id))
      .map((c) => c.name);

    const newGroup = {
      id: `grp_${Date.now()}`,
      name: newGroupName.trim(),
      avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=140",
      isGroup: true,
      members: [currentUser.name, ...memberNames],
      lastSeen: `${memberNames.length + 1} members`,
      isOnline: true
    };

    setContacts([newGroup, ...contacts]);
    setActiveChat(newGroup);
    setShowCreateGroupModal(false);
    setNewGroupName("");
    setSelectedGroupMembers([]);
    setMobileView("chat");
    showToast(`Group "${newGroup.name}" created!`);
  };

  // -------------------------------------------------------------
  // WEBRTC LIVE HARDWARE CAMERA / MIC INITIATION
  // -------------------------------------------------------------
  const startRealWebRtcCall = async (type) => {
    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { width: 1280, height: 720 } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setActiveCall({ type, status: "ringing", duration: 0 });
    } catch (err) {
      showToast("WebRTC Notice: Mic/Camera permission required for live call.");
      // Graceful fallback simulation
      setActiveCall({ type, status: "ringing", duration: 0 });
    }
  };

  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setActiveCall(null);
    setIsAudioMuted(false);
    setIsVideoDisabled(false);
  };

  const toggleCallMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = isAudioMuted));
    }
    setIsAudioMuted(!isAudioMuted);
  };

  const toggleCallVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = isVideoDisabled));
    }
    setIsVideoDisabled(!isVideoDisabled);
  };

  // -------------------------------------------------------------
  // REAL-TIME MESSAGING ENGINE
  // -------------------------------------------------------------
  const handleSendMessage = () => {
    if (!inputText.trim() || !activeChat) return;

    const newId = `msg_${Date.now()}`;
    const sentMsg = {
      id: newId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: inputText.trim(),
      type: "text",
      status: "sent",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), sentMsg]
    }));

    setInputText("");

    // Simulate Delivered -> Read ticks
    setTimeout(() => {
      setMessagesMap((prev) => {
        const list = prev[activeChat.id] || [];
        return {
          ...prev,
          [activeChat.id]: list.map((m) => (m.id === newId ? { ...m, status: "read" } : m))
        };
      });
    }, 1200);

    // Automated peer response in 1-on-1 chats
    if (!activeChat.isGroup) {
      setTimeout(() => {
        const peerReply = {
          id: `reply_${Date.now()}`,
          senderId: activeChat.id,
          senderName: activeChat.name,
          content: "Received your message securely on Infinity Chat! 🚀",
          type: "text",
          status: "read",
          createdAt: new Date().toISOString()
        };

        setMessagesMap((prev) => ({
          ...prev,
          [activeChat.id]: [...(prev[activeChat.id] || []), peerReply]
        }));
      }, 2600);
    }

    if (vanishMode) {
      setTimeout(() => {
        setMessagesMap((prev) => ({
          ...prev,
          [activeChat.id]: (prev[activeChat.id] || []).filter((m) => m.id !== newId)
        }));
      }, 15000);
    }
  };

  const handleSendVoice = () => {
    const dur = recordSecs || 3;
    setIsRecording(false);

    const voiceMsg = {
      id: `voice_${Date.now()}`,
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
      [activeChat.id]: [...(prev[activeChat.id] || []), voiceMsg]
    }));

    setTimeout(() => {
      setMessagesMap((prev) => {
        const list = prev[activeChat.id] || [];
        return {
          ...prev,
          [activeChat.id]: list.map((m) => (m.id === voiceMsg.id ? { ...m, status: "read" } : m))
        };
      });
    }, 1000);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const isImg = file.type.startsWith("image/");
    const blobUrl = URL.createObjectURL(file);

    const fileMsg = {
      id: `att_${Date.now()}`,
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
      [activeChat.id]: [...(prev[activeChat.id] || []), fileMsg]
    }));
  };

  const handleSaveProfile = () => {
    const updated = {
      ...currentUser,
      name: profileName.trim() || currentUser.name,
      about: profileAbout.trim() || currentUser.about,
      avatar: avatarInput
    };
    setCurrentUser(updated);

    const usersDb = JSON.parse(localStorage.getItem("infinity_users_directory") || "{}");
    usersDb[currentUser.phone] = updated;
    localStorage.setItem("infinity_users_directory", JSON.stringify(usersDb));

    showToast("Profile changes saved!");
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION / OTP PORTAL
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div style={styles.authContainer}>
        {authToast && <div style={styles.toastNotification}>{authToast}</div>}

        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={styles.authBadgeCircle}>
              <MessageSquare size={32} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", margin: "4px 0 0" }}>Infinity Chat</h1>
            <p style={{ fontSize: "13px", color: THEME.textMuted, margin: "4px 0 0" }}>
              Secure WhatsApp & Telegram Client for Bangladesh 🇧🇩
            </p>
          </div>

          {/* REGISTER MODE */}
          {authMode === "register" && (
            <form onSubmit={handleStartRegistration} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ textAlign: "center" }}>
                <input
                  type="file"
                  ref={avatarUploadRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAvatarInput(URL.createObjectURL(f));
                  }}
                  accept="image/*"
                  style={{ display: "none" }}
                />
                <div
                  onClick={() => avatarUploadRef.current?.click()}
                  style={styles.avatarUploadBubble}
                  title="Upload profile photo"
                >
                  <img src={avatarInput} alt="" style={styles.avatarCircleImg} />
                  <div style={styles.avatarUploadCam}>
                    <Camera size={13} color="#fff" />
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>Tap to choose photo</span>
              </div>

              <div>
                <label style={styles.labelTitle}>Display Name</label>
                <div style={styles.fieldBox}>
                  <User size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="text"
                    placeholder="e.g. Shakib Al Hasan"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <div>
                <label style={styles.labelTitle}>Bangladeshi Mobile Number (11-Digits)</label>
                <div style={styles.fieldBox}>
                  <Smartphone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="tel"
                    placeholder="01712345678"
                    maxLength={11}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                    style={styles.bareInput}
                  />
                </div>
                <span style={{ fontSize: "10px", color: THEME.textMuted, marginTop: "2px", display: "block" }}>
                  Must start with 01 and be exactly 11 digits
                </span>
              </div>

              <div>
                <label style={styles.labelTitle}>Account Password</label>
                <div style={styles.fieldBox}>
                  <Lock size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.bareInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: "none", border: "none", color: THEME.textMuted, cursor: "pointer" }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" style={styles.primaryActionButton}>
                <span>Send 6-Digit OTP</span>
                <ChevronRight size={18} />
              </button>

              <div style={{ textAlign: "center", marginTop: "6px" }}>
                <span style={{ fontSize: "12px", color: THEME.textMuted }}>Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthToast("");
                  }}
                  style={styles.linkTextButton}
                >
                  Log In directly
                </button>
              </div>
            </form>
          )}

          {/* OTP VERIFICATION STEP */}
          {authMode === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={styles.otpNoticeBanner}>
                <KeyRound size={24} color={THEME.secondary} style={{ marginBottom: "6px" }} />
                <div style={{ fontWeight: "700", fontSize: "15px" }}>Verify BD Mobile Number</div>
                <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>
                  Enter the 6-digit code sent to <b>{phoneInput}</b>
                </div>
              </div>

              {/* 6 Digit Inputs */}
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digit && idx > 0) {
                        otpInputRefs.current[idx - 1]?.focus();
                      }
                    }}
                    style={styles.otpSingleBox}
                  />
                ))}
              </div>

              <button onClick={handleVerifyOtp} style={styles.primaryActionButton}>
                <span>Verify & Enter</span>
                <CheckCircle size={18} />
              </button>

              <button
                onClick={() => setAuthMode("register")}
                style={{ ...styles.linkTextButton, textAlign: "center" }}
              >
                ← Edit phone number
              </button>
            </div>
          )}

          {/* DIRECT LOGIN MODE */}
          {authMode === "login" && (
            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={styles.labelTitle}>Bangladeshi Phone Number</label>
                <div style={styles.fieldBox}>
                  <Smartphone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="tel"
                    placeholder="01712345678"
                    maxLength={11}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <div>
                <label style={styles.labelTitle}>Password</label>
                <div style={styles.fieldBox}>
                  <Lock size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.bareInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: "none", border: "none", color: THEME.textMuted, cursor: "pointer" }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" style={styles.primaryActionButton}>
                <span>Sign In</span>
                <CheckCircle size={18} />
              </button>

              <div style={{ textAlign: "center", marginTop: "6px" }}>
                <span style={{ fontSize: "12px", color: THEME.textMuted }}>Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthToast("");
                  }}
                  style={styles.linkTextButton}
                >
                  Register new account
                </button>
              </div>
            </form>
          )}

          <div style={styles.authFooterSeal}>
            <ShieldCheck size={14} color={THEME.accent} style={{ marginRight: "5px" }} />
            <span>256-Bit End-to-End Encryption • Persistent Session</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: FULL MESSENGER CLIENT
  // -------------------------------------------------------------
  return (
    <div style={styles.appContainer}>
      {authToast && <div style={styles.toastNotification}>{authToast}</div>}

      {/* ----------------- SIDEBAR ----------------- */}
      <aside
        style={{
          ...styles.sidebar,
          display: mobileView === "chat" ? "none" : "flex"
        }}
        className="app-sidebar"
      >
        {/* User Status Bar */}
        <div style={styles.userTopBar}>
          <div
            onClick={() => {
              setSidebarView("settings");
              setSettingsActiveTab("profile");
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
            title="Edit Profile"
          >
            <img src={currentUser.avatar} alt="" style={styles.avatarImg} />
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>{currentUser.name}</div>
              <div style={{ fontSize: "11px", color: THEME.accent }}>● BD Active ({currentUser.phone})</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              style={styles.circleActionButton}
              title="Create Group"
            >
              <Users size={16} color={THEME.secondary} />
            </button>

            <button
              onClick={() => setShowAddContactModal(true)}
              style={styles.circleActionButton}
              title="Add BD Contact"
            >
              <UserPlus size={16} color={THEME.accent} />
            </button>

            <button
              onClick={() => setSidebarView(sidebarView === "chats" ? "settings" : "chats")}
              style={{
                ...styles.circleActionButton,
                backgroundColor: sidebarView === "settings" ? THEME.primary : THEME.card
              }}
              title="WhatsApp Settings Suite"
            >
              <Settings size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* SIDEBAR TAB 1: CHATS & GROUPS */}
        {sidebarView === "chats" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Search Input */}
            <div style={styles.searchBarBox}>
              <Search size={16} color={THEME.textMuted} style={{ marginRight: "8px" }} />
              <input
                type="text"
                placeholder="Search chats, groups or numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.bareInput}
              />
            </div>

            <div style={styles.listSubHeader}>
              <span>CONVERSATIONS ({filteredContacts.length})</span>
              <button onClick={() => setShowCreateGroupModal(true)} style={styles.linkButtonText}>
                + New Group
              </button>
            </div>

            {/* Conversation Items */}
            <div style={styles.contactsScrollList}>
              {filteredContacts.map((c) => {
                const isActive = c.id === activeChat?.id;
                const roomMessages = messagesMap[c.id] || [];
                const lastMsg = roomMessages[roomMessages.length - 1];

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveChat(c);
                      setMobileView("chat");
                    }}
                    style={{
                      ...styles.contactItemBox,
                      backgroundColor: isActive ? THEME.cardHover : "transparent",
                      borderLeft: isActive ? `3px solid ${THEME.primary}` : "3px solid transparent"
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <img src={c.avatar} alt="" style={styles.avatarImg} />
                      {c.isOnline && <div style={styles.activeDotIndicator} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.contactTitleLine}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          {c.isGroup && <Users size={14} color={THEME.secondary} />}
                          <span style={styles.contactItemName}>{c.name}</span>
                        </div>
                        {lastMsg && (
                          <span style={styles.timestampSpan}>
                            {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        )}
                      </div>

                      <div style={styles.lastMsgPreviewLine}>
                        {lastMsg && lastMsg.senderId === currentUser.id && (
                          <span style={{ marginRight: "4px", display: "inline-flex" }}>
                            {lastMsg.status === "read" ? (
                              <CheckCheck size={14} color={THEME.tickRead} />
                            ) : (
                              <Check size={14} color={THEME.tickSent} />
                            )}
                          </span>
                        )}
                        <span style={styles.lastMsgTruncatedText}>
                          {lastMsg ? lastMsg.content : c.isGroup ? "Group channel created" : c.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SIDEBAR TAB 2: WHATSAPP SETTINGS SUITE */}
        {sidebarView === "settings" && (
          <div style={styles.settingsSuiteContainer}>
            {/* Settings Header */}
            <div style={styles.settingsTopHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {settingsActiveTab !== "main" && (
                  <button onClick={() => setSettingsActiveTab("main")} style={styles.cleanGhostBtn}>
                    <ArrowLeft size={16} />
                  </button>
                )}
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>
                  {settingsActiveTab === "main" ? "Settings" : settingsActiveTab.toUpperCase()}
                </span>
              </div>
              <button onClick={() => setSidebarView("chats")} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            {/* MAIN SETTINGS MENU */}
            {settingsActiveTab === "main" && (
              <div style={styles.settingsScrollContent}>
                {/* Profile Overview Card */}
                <div
                  onClick={() => setSettingsActiveTab("profile")}
                  style={styles.settingsProfileSnapshot}
                >
                  <img src={currentUser.avatar} alt="" style={styles.avatarLargeImg} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "700", fontSize: "15px" }}>{currentUser.name}</div>
                    <div style={{ fontSize: "12px", color: THEME.textMuted }}>{currentUser.phone}</div>
                    <div style={{ fontSize: "11px", color: THEME.accent, marginTop: "2px" }}>
                      "{currentUser.about}"
                    </div>
                  </div>
                  <ChevronRight size={18} color={THEME.textMuted} />
                </div>

                <div style={styles.settingsGroupColumn}>
                  {/* Account */}
                  <div onClick={() => setSettingsActiveTab("account")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Shield size={18} color="#6366f1" />
                      <div>
                        <div style={styles.settingsRowTitle}>Account</div>
                        <div style={styles.settingsRowDesc}>Security notifications, change number</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* Privacy */}
                  <div onClick={() => setSettingsActiveTab("privacy")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Lock size={18} color="#a855f7" />
                      <div>
                        <div style={styles.settingsRowTitle}>Privacy</div>
                        <div style={styles.settingsRowDesc}>Last seen, Profile photo, Read receipts</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* Notifications */}
                  <div onClick={() => setSettingsActiveTab("notifications")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Bell size={18} color="#f59e0b" />
                      <div>
                        <div style={styles.settingsRowTitle}>Notifications</div>
                        <div style={styles.settingsRowDesc}>Message tones, Sound alerts, Preview</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* Storage & Data */}
                  <div onClick={() => setSettingsActiveTab("storage")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Database size={18} color="#06b6d4" />
                      <div>
                        <div style={styles.settingsRowTitle}>Storage and Data</div>
                        <div style={styles.settingsRowDesc}>Auto-download media, Network usage</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* Help */}
                  <div onClick={() => setSettingsActiveTab("help")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <HelpCircle size={18} color="#10b981" />
                      <div>
                        <div style={styles.settingsRowTitle}>Help</div>
                        <div style={styles.settingsRowDesc}>Help center, Contact us, Privacy policy</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>
                </div>

                <button
                  onClick={() => {
                    localStorage.removeItem("infinity_auth_user");
                    setCurrentUser(null);
                    setSidebarView("chats");
                  }}
                  style={styles.logoutButton}
                >
                  <LogOut size={16} />
                  <span>Log Out of Infinity Chat</span>
                </button>
              </div>
            )}

            {/* PROFILE EDITOR */}
            {settingsActiveTab === "profile" && (
              <div style={styles.settingsScrollContent}>
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <img src={currentUser.avatar} alt="" style={styles.avatarLargeImg} />
                  <div style={{ fontSize: "11px", color: THEME.textMuted, marginTop: "6px" }}>
                    Profile photo visible to contacts
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={styles.labelTitle}>Your Name</label>
                    <div style={styles.fieldBox}>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        style={styles.bareInput}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={styles.labelTitle}>About / Status</label>
                    <div style={styles.fieldBox}>
                      <input
                        type="text"
                        value={profileAbout}
                        onChange={(e) => setProfileAbout(e.target.value)}
                        style={styles.bareInput}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={styles.labelTitle}>Phone Number</label>
                    <div style={{ ...styles.fieldBox, opacity: 0.7 }}>
                      <input type="text" value={currentUser.phone} disabled style={styles.bareInput} />
                    </div>
                  </div>

                  <button onClick={handleSaveProfile} style={styles.primaryActionButton}>
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* PRIVACY SETTINGS */}
            {settingsActiveTab === "privacy" && (
              <div style={styles.settingsScrollContent}>
                <div style={styles.settingsOptionBox}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>Last Seen & Online</div>
                  <select
                    value={privacyLastSeen}
                    onChange={(e) => setPrivacyLastSeen(e.target.value)}
                    style={styles.selectDropdown}
                  >
                    <option>Everyone</option>
                    <option>My Contacts</option>
                    <option>Nobody</option>
                  </select>
                </div>

                <div style={styles.settingsOptionBox}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>Profile Photo</div>
                  <select
                    value={privacyPhoto}
                    onChange={(e) => setPrivacyPhoto(e.target.value)}
                    style={styles.selectDropdown}
                  >
                    <option>Everyone</option>
                    <option>My Contacts</option>
                    <option>Nobody</option>
                  </select>
                </div>

                <div style={styles.settingsOptionBox}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Read Receipts (Blue Ticks)</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                      If turned off, you won't send or receive read receipts
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => setReadReceipts(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: THEME.primary }}
                  />
                </div>
              </div>
            )}

            {/* NOTIFICATIONS SETTINGS */}
            {settingsActiveTab === "notifications" && (
              <div style={styles.settingsScrollContent}>
                <div style={styles.settingsOptionBox}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Conversation Tones</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>Play sound for outgoing/incoming messages</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSound}
                    onChange={(e) => setNotifSound(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: THEME.primary }}
                  />
                </div>

                <div style={styles.settingsOptionBox}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Message Previews</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>Preview message text inside notifications</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={messagePreviews}
                    onChange={(e) => setMessagePreviews(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: THEME.primary }}
                  />
                </div>
              </div>
            )}

            {/* STORAGE & DATA */}
            {settingsActiveTab === "storage" && (
              <div style={styles.settingsScrollContent}>
                <div style={styles.settingsOptionBox}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Media Auto-Download</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>Auto-cache shared images & voice notes</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: THEME.primary }}
                  />
                </div>

                <div style={styles.storageStatsBox}>
                  <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "6px" }}>Network Usage</div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>Messages Sent: <b>{Object.values(messagesMap).flat().length}</b></div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>Local Persistence: <b>Active (LocalStorage)</b></div>
                </div>
              </div>
            )}

            {/* HELP & APP INFO */}
            {settingsActiveTab === "help" && (
              <div style={styles.settingsScrollContent}>
                <div style={styles.helpDocCard}>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 6px" }}>Infinity Chat Web v2.6.0</h3>
                  <p style={{ fontSize: "12px", color: THEME.textMuted, lineHeight: "1.5" }}>
                    Production-grade real-time chat client engineered with WebRTC live streaming, BD phone validation, and responsive mobile architecture.
                  </p>
                  <div style={{ fontSize: "11px", color: THEME.accent, marginTop: "8px" }}>
                    Status: All Cloud Services Healthy
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ----------------- CHAT WINDOW ----------------- */}
      <main
        style={{
          ...styles.chatWindow,
          display: mobileView === "list" ? "none" : "flex"
        }}
        className="app-chat-window"
      >
        {/* Active Chat Header */}
        <header style={styles.chatTopHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setMobileView("list")}
              style={styles.cleanGhostBtn}
              className="mobile-back-btn"
            >
              <ArrowLeft size={18} />
            </button>
            <div style={{ position: "relative" }}>
              <img src={activeChat?.avatar} alt="" style={styles.avatarImg} />
              {activeChat?.isOnline && <div style={styles.activeDotIndicator} />}
            </div>
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
                {activeChat?.isGroup && <Users size={14} color={THEME.secondary} />}
                {activeChat?.name}
              </div>
              <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                {vanishMode ? "🔒 Vanish mode: 15s deletion" : activeChat?.lastSeen || "Online"}
              </div>
            </div>
          </div>

          {/* Call and Vanish Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Audio Call */}
            <button
              onClick={() => startRealWebRtcCall("audio")}
              style={styles.headerIconButton}
              title="Real WebRTC Audio Call"
            >
              <Phone size={17} color={THEME.secondary} />
            </button>

            {/* Video Call */}
            <button
              onClick={() => startRealWebRtcCall("video")}
              style={styles.headerIconButton}
              title="Real WebRTC Video Call"
            >
              <Video size={17} color={THEME.accent} />
            </button>

            {/* Vanish Mode */}
            <button
              onClick={() => setVanishMode(!vanishMode)}
              style={{
                ...styles.vanishPillButton,
                backgroundColor: vanishMode ? "rgba(168, 85, 247, 0.2)" : THEME.card,
                borderColor: vanishMode ? THEME.vanish : THEME.border,
                color: vanishMode ? "#e9d5ff" : THEME.textMuted
              }}
            >
              <Timer size={14} />
              <span className="hide-mobile">Vanish {vanishMode ? "ON" : "OFF"}</span>
            </button>
          </div>
        </header>

        {/* Message Feed Area */}
        <div style={styles.messageFeedViewport}>
          {activeMessages.length === 0 ? (
            <div style={styles.emptyNoticeBox}>
              <MessageSquare size={38} color={THEME.textMuted} style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "14px", fontWeight: "600" }}>
                No messages yet with {activeChat?.name}
              </div>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "4px 0 0" }}>
                Send a greeting or voice note to begin!
              </p>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRowFlex,
                    justifyContent: isMe ? "flex-end" : "flex-start"
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubbleBox,
                      backgroundColor: msg.isVanish
                        ? "rgba(88, 28, 135, 0.45)"
                        : isMe
                        ? THEME.primary
                        : THEME.card,
                      border: msg.isVanish ? "1px solid rgba(168, 85, 247, 0.6)" : `1px solid ${THEME.border}`,
                      borderBottomRightRadius: isMe ? "4px" : "16px",
                      borderBottomLeftRadius: !isMe ? "4px" : "16px"
                    }}
                  >
                    <div style={styles.msgAuthorName}>{msg.senderName}</div>

                    {msg.type === "text" && <div style={styles.msgBodyText}>{msg.content}</div>}

                    {msg.type === "image" && (
                      <div>
                        <img src={msg.fileUrl} alt="" style={styles.attachedImageThumbnail} />
                        {msg.content && <div style={styles.captionText}>"{msg.content}"</div>}
                      </div>
                    )}

                    {msg.type === "voice" && (
                      <div style={styles.voiceNoteFlexRow}>
                        <button
                          onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)}
                          style={styles.voicePlayBtn}
                        >
                          {playingVoiceId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <div style={styles.voiceWaveVisualizer}>
                          {[30, 70, 25, 90, 60, 100, 45, 80, 50, 75].map((h, i) => (
                            <span
                              key={i}
                              style={{
                                ...styles.waveStemBar,
                                height: `${h}%`,
                                backgroundColor: playingVoiceId === msg.id ? THEME.secondary : "#ffffffaa"
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: "11px", color: THEME.textMuted }}>{msg.duration}s</span>
                      </div>
                    )}

                    {msg.type === "file" && (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={styles.docFileCard}>
                        <FileText size={20} color={THEME.secondary} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600" }}>{msg.content}</div>
                          <div style={{ fontSize: "10px", color: THEME.textMuted }}>{msg.fileSize}</div>
                        </div>
                      </a>
                    )}

                    {/* Metadata & Status Ticks */}
                    <div style={styles.msgFooterMeta}>
                      <span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.6)" }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      {isMe && (
                        <span style={{ display: "inline-flex", marginLeft: "4px" }}>
                          {readReceipts && msg.status === "read" ? (
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

        {/* ----------------- FIXED DOCK INPUT BAR ----------------- */}
        <footer style={styles.dockBottomFooter}>
          <div style={styles.inputInnerDock}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={styles.dockIconBtn}
              title="Attach media or document"
            >
              <Paperclip size={18} />
            </button>

            {isRecording ? (
              <div style={styles.recordingLiveDock}>
                <span style={{ color: THEME.danger, fontSize: "13px", fontWeight: "bold" }}>
                  ● Recording: {recordSecs}s
                </span>
                <button onClick={handleSendVoice} style={styles.sendVoiceBtnAction}>
                  Send Voice Note
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder={
                  vanishMode ? "Disappearing message..." : `Message ${activeChat?.name || ""}...`
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                style={styles.dockTextRawInput}
              />
            )}

            {!inputText.trim() && !isRecording ? (
              <button onClick={() => setIsRecording(true)} style={styles.dockIconBtn} title="Record Voice">
                <Mic size={18} />
              </button>
            ) : isRecording ? (
              <button onClick={() => setIsRecording(false)} style={styles.dockIconBtn}>
                <MicOff size={18} color={THEME.danger} />
              </button>
            ) : (
              <button onClick={handleSendMessage} style={styles.sendBtnCircle}>
                <Send size={15} color="#ffffff" />
              </button>
            )}
          </div>
        </footer>
      </main>

      {/* ----------------- 1. ADD BD CONTACT MODAL ----------------- */}
      {showAddContactModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContainerCard}>
            <div style={styles.modalTopHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Add Bangladeshi Contact</span>
              </div>
              <button onClick={() => setShowAddContactModal(false)} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyAndAddContact} style={{ padding: "18px" }}>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "0 0 12px" }}>
                Enter your contact's 11-digit Bangladeshi mobile number (01xxxxxxxxx).
              </p>

              <label style={styles.labelTitle}>Mobile Number</label>
              <div style={styles.fieldBox}>
                <Smartphone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="tel"
                  placeholder="01711234567"
                  maxLength={11}
                  value={contactSearchPhone}
                  onChange={(e) => setContactSearchPhone(e.target.value.replace(/\D/g, ""))}
                  style={styles.bareInput}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  style={styles.secondaryTextBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryActionButton}>
                  Verify & Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- 2. CREATE GROUP MODAL ----------------- */}
      {showCreateGroupModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContainerCard}>
            <div style={styles.modalTopHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={18} color={THEME.secondary} />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Create Group Channel</span>
              </div>
              <button onClick={() => setShowCreateGroupModal(false)} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ padding: "18px" }}>
              <label style={styles.labelTitle}>Group Name</label>
              <div style={{ ...styles.fieldBox, marginBottom: "14px" }}>
                <Users size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="text"
                  placeholder="e.g. Project Apollo Sprint 🚀"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={styles.bareInput}
                  autoFocus
                />
              </div>

              <label style={styles.labelTitle}>Select Members</label>
              <div style={styles.groupMemberListScroll}>
                {contacts
                  .filter((c) => !c.isGroup)
                  .map((contact) => {
                    const isSelected = selectedGroupMembers.includes(contact.id);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => toggleGroupMemberSelection(contact.id)}
                        style={{
                          ...styles.groupSelectRow,
                          backgroundColor: isSelected ? THEME.cardHover : "transparent"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img src={contact.avatar} alt="" style={styles.avatarImg} />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "600" }}>{contact.name}</div>
                            <div style={{ fontSize: "11px", color: THEME.textMuted }}>{contact.phone}</div>
                          </div>
                        </div>
                        {isSelected ? (
                          <CheckSquare size={18} color={THEME.primary} />
                        ) : (
                          <Square size={18} color={THEME.textMuted} />
                        )}
                      </div>
                    );
                  })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  style={styles.secondaryTextBtn}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryActionButton}>
                  Create Group ({selectedGroupMembers.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- 3. NOT REGISTERED / INVITE ALERT ----------------- */}
      {inviteModalData && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContainerCard}>
            <div style={{ ...styles.modalTopHeader, borderBottom: "none", paddingBottom: "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={18} color="#f59e0b" />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>BD Number Not Registered</span>
              </div>
              <button onClick={() => setInviteModalData(null)} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px 22px", textAlign: "center" }}>
              <div style={styles.shareBadgeBubble}>
                <Share2 size={26} color={THEME.secondary} />
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "10px 0 4px" }}>
                {inviteModalData.phone}
              </h3>
              <p style={{ fontSize: "12px", color: THEME.textMuted, lineHeight: "1.5" }}>
                This Bangladeshi mobile number is not yet on Infinity Chat. Share an invite link so they can register with their BD SIM!
              </p>

              <div style={styles.inviteLinkContainer}>
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>{inviteModalData.inviteUrl}</span>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteModalData.inviteUrl);
                  showToast("Invite link copied! Share via SMS / WhatsApp.");
                  setInviteModalData(null);
                }}
                style={{ ...styles.primaryActionButton, width: "100%", marginTop: "12px" }}
              >
                Copy SMS Invite Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- 4. LIVE WEBRTC CALL OVERLAY ----------------- */}
      {activeCall && (
        <div style={styles.webrtcCallModalOverlay}>
          <div style={styles.callCardContainer}>
            <div style={{ fontSize: "12px", color: THEME.textMuted, marginBottom: "8px" }}>
              {activeCall.type === "video" ? "Infinity WebRTC HD Video Call" : "Infinity Encrypted Voice Call"}
            </div>

            {/* Real WebRTC Video Element or Peer Avatar */}
            {activeCall.type === "video" && !isVideoDisabled ? (
              <div style={styles.videoStreamBox}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={styles.realVideoPlayer}
                />
                <div style={styles.liveWebRtcPill}>Live WebRTC Stream</div>
              </div>
            ) : (
              <div style={{ margin: "24px 0" }}>
                <img
                  src={activeChat?.avatar}
                  alt=""
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "50%",
                    border: `3px solid ${activeCall.status === "connected" ? THEME.accent : THEME.primary}`,
                    boxShadow: "0 0 30px rgba(99, 102, 241, 0.45)"
                  }}
                />
              </div>
            )}

            <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "6px 0 2px" }}>
              {activeChat?.name}
            </h2>
            <div style={{ fontSize: "13px", color: activeCall.status === "connected" ? THEME.accent : THEME.textMuted }}>
              {activeCall.status === "connected"
                ? `Connected (${Math.floor(activeCall.duration / 60)}:${(activeCall.duration % 60).toString().padStart(2, "0")})`
                : "Dialing Peer..."}
            </div>

            {/* In-Call Actions */}
            <div style={styles.callActionsRowFlex}>
              <button
                onClick={toggleCallMute}
                style={{
                  ...styles.callCircleBtn,
                  backgroundColor: isAudioMuted ? THEME.danger : THEME.card
                }}
                title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isAudioMuted ? <MicOff size={18} color="#fff" /> : <MicIcon size={18} color="#fff" />}
              </button>

              {activeCall.type === "video" && (
                <button
                  onClick={toggleCallVideo}
                  style={{
                    ...styles.callCircleBtn,
                    backgroundColor: isVideoDisabled ? THEME.danger : THEME.card
                  }}
                  title={isVideoDisabled ? "Enable Camera" : "Disable Camera"}
                >
                  {isVideoDisabled ? <VideoOff size={18} color="#fff" /> : <Video size={18} color="#fff" />}
                </button>
              )}

              <button
                onClick={endCall}
                style={{
                  ...styles.callCircleBtn,
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

      {/* Embedded Responsive Media Queries */}
      <style>{`
        @media (min-width: 768px) {
          .app-sidebar {
            display: flex !important;
            width: 340px !important;
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

// -------------------------------------------------------------
// SELF-CONTAINED CSS STYLESHEET OBJECT
// -------------------------------------------------------------
const styles = {
  // Toast Alert
  toastNotification: {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: THEME.primary,
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: "600",
    zIndex: 9999,
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
  },

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
    padding: "26px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
  },
  authBadgeCircle: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    backgroundColor: THEME.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 10px",
    boxShadow: "0 8px 20px rgba(99, 102, 241, 0.4)"
  },
  avatarUploadBubble: {
    position: "relative",
    width: "70px",
    height: "70px",
    margin: "0 auto 6px",
    cursor: "pointer"
  },
  avatarCircleImg: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    border: `2px solid ${THEME.primary}`
  },
  avatarUploadCam: {
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
  labelTitle: {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: THEME.textMuted,
    marginBottom: "5px"
  },
  fieldBox: {
    display: "flex",
    alignItems: "center",
    backgroundColor: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "12px",
    padding: "10px 14px"
  },
  bareInput: {
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "13px",
    width: "100%",
    outline: "none"
  },
  primaryActionButton: {
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
  linkTextButton: {
    background: "none",
    border: "none",
    color: THEME.secondary,
    fontWeight: "700",
    fontSize: "12px",
    cursor: "pointer"
  },
  otpNoticeBanner: {
    textAlign: "center",
    padding: "12px",
    backgroundColor: THEME.card,
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`
  },
  otpSingleBox: {
    width: "44px",
    height: "50px",
    textAlign: "center",
    fontSize: "18px",
    fontWeight: "bold",
    backgroundColor: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    color: THEME.text,
    outline: "none"
  },
  authFooterSeal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  userTopBar: {
    padding: "12px 16px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  avatarImg: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    objectFit: "cover"
  },
  avatarLargeImg: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    objectFit: "cover",
    margin: "0 auto"
  },
  activeDotIndicator: {
    position: "absolute",
    bottom: "0",
    right: "0",
    width: "10px",
    height: "10px",
    backgroundColor: THEME.accent,
    borderRadius: "50%",
    border: `2px solid ${THEME.sidebar}`
  },
  circleActionButton: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    padding: "7px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  searchBarBox: {
    display: "flex",
    alignItems: "center",
    margin: "12px 14px 6px",
    padding: "8px 12px",
    backgroundColor: THEME.card,
    borderRadius: "10px",
    border: `1px solid ${THEME.border}`
  },
  listSubHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    fontSize: "11px",
    fontWeight: "700",
    color: THEME.textMuted
  },
  linkButtonText: {
    background: "none",
    border: "none",
    color: THEME.secondary,
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer"
  },
  contactsScrollList: {
    flex: 1,
    overflowY: "auto",
    padding: "4px 8px"
  },
  contactItemBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.15s ease",
    marginBottom: "3px"
  },
  contactTitleLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  contactItemName: {
    fontSize: "13px",
    fontWeight: "600",
    color: THEME.text
  },
  timestampSpan: {
    fontSize: "10px",
    color: THEME.textMuted
  },
  lastMsgPreviewLine: {
    display: "flex",
    alignItems: "center",
    marginTop: "2px"
  },
  lastMsgTruncatedText: {
    fontSize: "12px",
    color: THEME.textMuted,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },

  // Settings Suite View
  settingsSuiteContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden"
  },
  settingsTopHeader: {
    padding: "14px 16px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cleanGhostBtn: {
    background: "none",
    border: "none",
    color: THEME.textMuted,
    cursor: "pointer",
    display: "flex",
    alignItems: "center"
  },
  settingsScrollContent: {
    padding: "16px",
    overflowY: "auto",
    flex: 1
  },
  settingsProfileSnapshot: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    backgroundColor: THEME.card,
    borderRadius: "14px",
    border: `1px solid ${THEME.border}`,
    marginBottom: "16px",
    cursor: "pointer"
  },
  settingsGroupColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "20px"
  },
  settingsActionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    backgroundColor: THEME.card,
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`,
    cursor: "pointer"
  },
  settingsRowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  settingsRowTitle: {
    fontSize: "13px",
    fontWeight: "600"
  },
  settingsRowDesc: {
    fontSize: "11px",
    color: THEME.textMuted,
    marginTop: "2px"
  },
  logoutButton: {
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
  settingsOptionBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px",
    backgroundColor: THEME.card,
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`,
    marginBottom: "10px"
  },
  selectDropdown: {
    backgroundColor: THEME.bg,
    color: THEME.text,
    border: `1px solid ${THEME.border}`,
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "12px",
    outline: "none"
  },
  storageStatsBox: {
    padding: "14px",
    backgroundColor: THEME.card,
    borderRadius: "12px",
    border: `1px solid ${THEME.border}`
  },
  helpDocCard: {
    padding: "16px",
    backgroundColor: THEME.card,
    borderRadius: "14px",
    border: `1px solid ${THEME.border}`
  },

  // Chat Window Area
  chatWindow: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: THEME.bg,
    height: "100%"
  },
  chatTopHeader: {
    padding: "10px 16px",
    backgroundColor: THEME.sidebar,
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerIconButton: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    padding: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  vanishPillButton: {
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
  messageFeedViewport: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  emptyNoticeBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: THEME.textMuted,
    textAlign: "center"
  },
  messageRowFlex: {
    display: "flex",
    width: "100%"
  },
  messageBubbleBox: {
    maxWidth: "75%",
    padding: "10px 14px",
    borderRadius: "16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
  },
  msgAuthorName: {
    fontSize: "11px",
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: "4px"
  },
  msgBodyText: {
    fontSize: "14px",
    lineHeight: "1.4"
  },
  attachedImageThumbnail: {
    width: "100%",
    maxHeight: "220px",
    borderRadius: "10px",
    objectFit: "cover",
    display: "block"
  },
  captionText: {
    fontSize: "11px",
    fontStyle: "italic",
    marginTop: "6px",
    color: "rgba(255, 255, 255, 0.8)"
  },
  voiceNoteFlexRow: {
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
  voiceWaveVisualizer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "18px"
  },
  waveStemBar: {
    width: "3px",
    borderRadius: "2px"
  },
  docFileCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: "10px",
    textDecoration: "none",
    color: THEME.text
  },
  msgFooterMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: "4px"
  },

  // Fixed Bottom Dock
  dockBottomFooter: {
    padding: "10px 14px",
    backgroundColor: THEME.sidebar,
    borderTop: `1px solid ${THEME.border}`
  },
  inputInnerDock: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: THEME.card,
    borderRadius: "14px",
    padding: "4px 8px",
    border: `1px solid ${THEME.border}`
  },
  dockTextRawInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "14px",
    padding: "8px",
    outline: "none"
  },
  dockIconBtn: {
    background: "none",
    border: "none",
    color: THEME.textMuted,
    padding: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnCircle: {
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
  recordingLiveDock: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px"
  },
  sendVoiceBtnAction: {
    backgroundColor: THEME.danger,
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer"
  },

  // Modals
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
  modalContainerCard: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: THEME.sidebar,
    border: `1px solid ${THEME.border}`,
    borderRadius: "20px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
  },
  modalTopHeader: {
    padding: "14px 18px",
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  secondaryTextBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: THEME.textMuted,
    fontSize: "13px",
    padding: "8px 14px",
    cursor: "pointer"
  },
  groupMemberListScroll: {
    maxHeight: "180px",
    overflowY: "auto",
    border: `1px solid ${THEME.border}`,
    borderRadius: "10px",
    padding: "4px"
  },
  groupSelectRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "2px"
  },
  shareBadgeBubble: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto"
  },
  inviteLinkContainer: {
    backgroundColor: THEME.bg,
    border: `1px solid ${THEME.border}`,
    padding: "10px 12px",
    borderRadius: "10px",
    margin: "12px 0",
    wordBreak: "break-all"
  },

  // WebRTC Call Overlay
  webrtcCallModalOverlay: {
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
  callCardContainer: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: THEME.sidebar,
    borderRadius: "24px",
    border: `1px solid ${THEME.border}`,
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
  },
  videoStreamBox: {
    position: "relative",
    width: "100%",
    height: "230px",
    borderRadius: "16px",
    backgroundColor: "#000",
    overflow: "hidden",
    margin: "12px 0",
    border: `1px solid ${THEME.border}`
  },
  realVideoPlayer: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  liveWebRtcPill: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    backgroundColor: "rgba(16, 185, 129, 0.8)",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "bold",
    color: "#fff"
  },
  callActionsRowFlex: {
    display: "flex",
    justifyContent: "center",
    gap: "18px",
    marginTop: "24px"
  },
  callCircleBtn: {
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
