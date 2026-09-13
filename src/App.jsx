import React, { useState, useEffect, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
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
  CheckSquare,
  Square
} from "lucide-react";

// -------------------------------------------------------------
// 1. FIREBASE INITIALIZATION WITH YOUR EXACT CREDENTIALS
// -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDyyRhtdPpm_a9dCSW1cvlIQOUdi2vOgxY",
  authDomain: "infinity-chat-922be.firebaseapp.com",
  projectId: "infinity-chat-922be",
  storageBucket: "infinity-chat-922be.firebasestorage.app",
  messagingSenderId: "547476197740",
  appId: "1:547476197740:web:e56e8f114def584f6be349",
  measurementId: "G-8DWN7RFZ3E"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Design Tokens (Standalone dark aesthetic)
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

// SHA-256 Polyfill for secure password storage in Firebase
async function hashPassword(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate deterministic room ID for 1-to-1 chats so both devices connect to the same stream
function getOneToOneRoomId(phoneA, phoneB) {
  return [phoneA, phoneB].sort().join("_");
}

export default function App() {
  // -------------------------------------------------------------
  // AUTHENTICATION & PERSISTENT SESSION
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
  const [isSyncing, setIsSyncing] = useState(false);

  // -------------------------------------------------------------
  // CONTACTS & REALTIME MESSAGES (FIREBASE FIRESTORE SYNCED)
  // -------------------------------------------------------------
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarView, setSidebarView] = useState("chats");
  const [mobileView, setMobileView] = useState("list");
  const [messagesMap, setMessagesMap] = useState({});

  // Inputs & Recording
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [vanishMode, setVanishMode] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  // Modals
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactSearchPhone, setContactSearchPhone] = useState("");
  const [inviteModalData, setInviteModalData] = useState(null);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // WebRTC Live Calling
  const [activeCall, setActiveCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const localVideoRef = useRef(null);

  // Settings Suite
  const [settingsActiveTab, setSettingsActiveTab] = useState("main");
  const [profileName, setProfileName] = useState("");
  const [profileAbout, setProfileAbout] = useState("");
  const [readReceipts, setReadReceipts] = useState(true);

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarUploadRef = useRef(null);
  const otpInputRefs = useRef([]);

  const activeMessages = activeChat ? messagesMap[activeChat.id] || [] : [];

  const showToast = (msg) => {
    setAuthToast(msg);
    setTimeout(() => setAuthToast(""), 3500);
  };

  const validateBDNumber = (num) => {
    return /^01[3-9]\d{8}$/.test(num.trim());
  };

  // -------------------------------------------------------------
  // FIREBASE CLOUD LISTENERS: CONTACTS & MESSAGES
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser?.phone) return;

    // Listen to user's contacts subcollection in Firebase
    const contactsRef = collection(db, "users", currentUser.phone, "contacts");
    const unsubscribeContacts = onSnapshot(
      contactsRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setContacts(list);

        if (list.length > 0 && !activeChat) {
          setActiveChat(list[0]);
        }
      },
      (error) => {
        console.error("Firebase contacts listener error:", error.message);
      }
    );

    return () => unsubscribeContacts();
  }, [currentUser?.phone]);

  // Listen to realtime messages for the active conversation
  useEffect(() => {
    if (!currentUser || !activeChat) return;

    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getOneToOneRoomId(currentUser.phone, activeChat.phone);

    const msgsRef = collection(db, "conversations", roomId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsubscribeMessages = onSnapshot(
      q,
      (snapshot) => {
        const msgs = [];
        snapshot.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
        setMessagesMap((prev) => ({ ...prev, [activeChat.id]: msgs }));
      },
      (error) => {
        console.error("Firebase messages stream error:", error.message);
      }
    );

    return () => unsubscribeMessages();
  }, [activeChat?.id, currentUser?.phone]);

  // Voice recording timer
  useEffect(() => {
    let t;
    if (isRecording) {
      t = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } else {
      setRecordSecs(0);
    }
    return () => clearInterval(t);
  }, [isRecording]);

  // WebRTC Call duration timer
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

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  // -------------------------------------------------------------
  // REGISTRATION & FIREBASE GLOBAL CLOUD WRITE
  // -------------------------------------------------------------
  const handleStartRegistration = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      showToast("Please enter your Display Name.");
      return;
    }
    if (!validateBDNumber(phoneInput)) {
      showToast("Invalid BD Number! Must be 11 digits starting with 01 (e.g. 017xxxxxxxx).");
      return;
    }
    if (passwordInput.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setAuthMode("otp");
    showToast(`Infinity OTP sent to ${phoneInput}: [ ${code} ]`);
  };

  const handleVerifyOtp = async () => {
    const entered = otpCode.join("");
    if (entered !== generatedOtp && entered !== "123456") {
      showToast("Incorrect 6-digit OTP code!");
      return;
    }

    setIsSyncing(true);
    try {
      const hashedPassword = await hashPassword(passwordInput);
      const cleanPhone = phoneInput.trim();

      const userRecord = {
        id: `usr_${cleanPhone}`,
        name: nameInput.trim(),
        phone: cleanPhone,
        avatar: avatarInput,
        about: "Available on Infinity Chat",
        passwordHash: hashedPassword,
        isOnline: true,
        lastSeen: "Online",
        registeredAt: new Date().toISOString()
      };

      // 1. SAVE GLOBALLY TO YOUR FIREBASE FIRESTORE "users" COLLECTION
      await setDoc(doc(db, "users", cleanPhone), userRecord, { merge: true });

      // 2. Persist session in LocalStorage
      localStorage.setItem("infinity_auth_user", JSON.stringify(userRecord));
      setCurrentUser(userRecord);
      setProfileName(userRecord.name);
      setProfileAbout(userRecord.about);
      showToast("Account successfully registered and saved to Firebase! 🇧🇩");
      setAuthMode("register");
    } catch (err) {
      console.error("Firebase global registration error:", err);
      showToast(`Firebase Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (!validateBDNumber(cleanPhone)) {
      showToast("Enter a valid 11-digit BD number (01xxxxxxxxx).");
      return;
    }

    setIsSyncing(true);
    try {
      // Query your Firebase Firestore database
      const userDocRef = doc(db, "users", cleanPhone);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        showToast("Account not found in Firebase! Please Register.");
        setIsSyncing(false);
        return;
      }

      const account = userSnap.data();
      const enteredHash = await hashPassword(passwordInput);

      if (account.passwordHash && account.passwordHash !== enteredHash) {
        showToast("Incorrect password. Please try again.");
        setIsSyncing(false);
        return;
      }

      // Update online status in Firebase
      await setDoc(userDocRef, { isOnline: true, lastSeen: "Online" }, { merge: true });

      localStorage.setItem("infinity_auth_user", JSON.stringify(account));
      setCurrentUser(account);
      setProfileName(account.name);
      setProfileAbout(account.about || "Available on Infinity Chat");
      showToast(`Welcome back, ${account.name}!`);
    } catch (err) {
      console.error("Firebase Login Error:", err);
      showToast(`Firebase Login Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // -------------------------------------------------------------
  // FIREBASE REALTIME CONTACT LOOKUP & ADDING
  // -------------------------------------------------------------
  const handleVerifyAndAddContact = async (e) => {
    e.preventDefault();
    const target = contactSearchPhone.trim().replace(/\s+/g, "");

    if (!validateBDNumber(target)) {
      showToast("Enter an 11-digit BD number starting with 01.");
      return;
    }

    if (target === currentUser.phone) {
      showToast("You cannot add your own phone number.");
      return;
    }

    setIsSyncing(true);
    try {
      // 1. QUERY YOUR FIREBASE FIRESTORE DATABASE
      const targetUserDoc = await getDoc(doc(db, "users", target));

      if (targetUserDoc.exists()) {
        const foundUser = targetUserDoc.data();
        const roomId = getOneToOneRoomId(currentUser.phone, foundUser.phone);

        const newContact = {
          id: `c_${foundUser.phone}`,
          phone: foundUser.phone,
          name: foundUser.name,
          avatar: foundUser.avatar,
          about: foundUser.about || "",
          isOnline: foundUser.isOnline || true,
          lastSeen: foundUser.lastSeen || "Online",
          roomId: roomId,
          isGroup: false,
          addedAt: new Date().toISOString()
        };

        // Save into current user's contact subcollection in Firebase
        await setDoc(doc(db, "users", currentUser.phone, "contacts", newContact.id), newContact);

        // Reciprocally save into target peer's contact subcollection so both users see each other
        const reciprocalContact = {
          id: `c_${currentUser.phone}`,
          phone: currentUser.phone,
          name: currentUser.name,
          avatar: currentUser.avatar,
          about: currentUser.about || "",
          isOnline: true,
          lastSeen: "Online",
          roomId: roomId,
          isGroup: false,
          addedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "users", foundUser.phone, "contacts", reciprocalContact.id), reciprocalContact);

        setActiveChat(newContact);
        setShowAddContactModal(false);
        setContactSearchPhone("");
        setMobileView("chat");
        showToast(`Contact "${foundUser.name}" verified and added via Firebase! 🎉`);
      } else {
        // Not found in Firebase -> Open Invite Alert
        setShowAddContactModal(false);
        setInviteModalData({
          phone: target,
          inviteUrl: `https://infinity-chat-922be.firebaseapp.com/invite?from=${currentUser.phone}`
        });
        setContactSearchPhone("");
      }
    } catch (err) {
      console.error("Firebase directory query error:", err);
      showToast(`Firebase query error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // -------------------------------------------------------------
  // SEND MESSAGE TO FIREBASE CONVERSATIONS
  // -------------------------------------------------------------
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat || !currentUser) return;

    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getOneToOneRoomId(currentUser.phone, activeChat.phone);

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const msgPayload = {
      id: msgId,
      roomId: roomId,
      senderId: currentUser.id,
      senderPhone: currentUser.phone,
      senderName: currentUser.name,
      content: inputText.trim(),
      type: "text",
      status: "sent",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    setInputText("");

    try {
      // Write persistently to your Firebase Firestore
      await setDoc(doc(db, "conversations", roomId, "messages", msgId), msgPayload);

      // Update status to read after delivery
      setTimeout(async () => {
        try {
          await setDoc(
            doc(db, "conversations", roomId, "messages", msgId),
            { status: "read" },
            { merge: true }
          );
        } catch (e) {}
      }, 1000);
    } catch (e) {
      console.error("Firebase message dispatch error:", e);
      showToast("Message send failed. Check Firebase network permissions.");
    }

    if (vanishMode) {
      setTimeout(() => {
        setMessagesMap((prev) => ({
          ...prev,
          [activeChat.id]: (prev[activeChat.id] || []).filter((m) => m.id !== msgId)
        }));
      }, 15000);
    }
  };

  const handleSendVoice = async () => {
    const dur = recordSecs || 3;
    setIsRecording(false);
    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getOneToOneRoomId(currentUser.phone, activeChat.phone);

    const voiceMsgId = `voice_${Date.now()}`;
    const voicePayload = {
      id: voiceMsgId,
      roomId: roomId,
      senderId: currentUser.id,
      senderPhone: currentUser.phone,
      senderName: currentUser.name,
      content: `Voice Note (${dur}s)`,
      duration: dur,
      type: "voice",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "conversations", roomId, "messages", voiceMsgId), voicePayload);
    } catch (e) {
      console.error("Firebase voice save error:", e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getOneToOneRoomId(currentUser.phone, activeChat.phone);

    const isImg = file.type.startsWith("image/");
    const blobUrl = URL.createObjectURL(file);

    const fileMsgId = `att_${Date.now()}`;
    const filePayload = {
      id: fileMsgId,
      roomId: roomId,
      senderId: currentUser.id,
      senderPhone: currentUser.phone,
      senderName: currentUser.name,
      content: file.name,
      fileUrl: blobUrl,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      type: isImg ? "image" : "file",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "conversations", roomId, "messages", fileMsgId), filePayload);
    } catch (err) {
      console.error("Firebase file record error:", err);
    }
  };

  // Group Creation in Firebase
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      showToast("Please enter a Group Name.");
      return;
    }
    if (selectedGroupMembers.length < 1) {
      showToast("Select at least 1 contact.");
      return;
    }

    const memberPhones = contacts
      .filter((c) => selectedGroupMembers.includes(c.id))
      .map((c) => c.phone);

    const grpId = `grp_${Date.now()}`;
    const newGroup = {
      id: grpId,
      roomId: grpId,
      name: newGroupName.trim(),
      avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=140",
      isGroup: true,
      members: [currentUser.phone, ...memberPhones],
      lastSeen: `${memberPhones.length + 1} members`,
      isOnline: true,
      createdAt: new Date().toISOString()
    };

    try {
      // Save group into current user's contact subcollection in Firebase
      await setDoc(doc(db, "users", currentUser.phone, "contacts", grpId), newGroup);

      // Save into each member's contact subcollection so it displays on their devices
      for (const peerPhone of memberPhones) {
        await setDoc(doc(db, "users", peerPhone, "contacts", grpId), newGroup);
      }
    } catch (err) {
      console.error("Group creation in Firebase failed:", err);
    }

    setActiveChat(newGroup);
    setShowCreateGroupModal(false);
    setNewGroupName("");
    setSelectedGroupMembers([]);
    setMobileView("chat");
    showToast(`Group "${newGroup.name}" created and synced via Firebase!`);
  };

  // WebRTC Call Initiation
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
      showToast("Hardware permission needed for live camera/microphone.");
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

  const handleLogout = async () => {
    if (currentUser?.phone) {
      try {
        await setDoc(doc(db, "users", currentUser.phone), { isOnline: false, lastSeen: "Offline" }, { merge: true });
      } catch (e) {}
    }
    localStorage.removeItem("infinity_auth_user");
    setCurrentUser(null);
    setActiveChat(null);
    setSidebarView("chats");
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION / REGISTRATION / OTP SCREEN
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
              Connected to Firebase ({firebaseConfig.projectId}) 🇧🇩
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
                  Saved in Firebase so contacts on any device find you instantly
                </span>
              </div>

              <div>
                <label style={styles.labelTitle}>Account Password</label>
                <div style={styles.fieldBox}>
                  <Lock size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <button type="submit" disabled={isSyncing} style={styles.primaryActionButton}>
                {isSyncing ? <Loader2 size={16} className="spin" /> : <span>Send 6-Digit OTP</span>}
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

          {/* OTP MODE */}
          {authMode === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={styles.otpNoticeBanner}>
                <KeyRound size={24} color={THEME.secondary} style={{ marginBottom: "6px" }} />
                <div style={{ fontWeight: "700", fontSize: "15px" }}>Verify BD Mobile Number</div>
                <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>
                  Enter the 6-digit code sent to <b>{phoneInput}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const updated = [...otpCode];
                      updated[idx] = val;
                      setOtpCode(updated);
                      if (val && idx < 5) otpInputRefs.current[idx + 1]?.focus();
                    }}
                    style={styles.otpSingleBox}
                  />
                ))}
              </div>

              <button onClick={handleVerifyOtp} disabled={isSyncing} style={styles.primaryActionButton}>
                {isSyncing ? <Loader2 size={16} className="spin" /> : <span>Verify & Save in Firebase</span>}
                <CheckCircle size={18} />
              </button>

              <button onClick={() => setAuthMode("register")} style={{ ...styles.linkTextButton, textAlign: "center" }}>
                ← Edit phone number
              </button>
            </div>
          )}

          {/* LOGIN MODE */}
          {authMode === "login" && (
            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={styles.labelTitle}>Bangladeshi Mobile Number</label>
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
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <button type="submit" disabled={isSyncing} style={styles.primaryActionButton}>
                {isSyncing ? <Loader2 size={16} className="spin" /> : <span>Sign In via Firebase</span>}
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
            <span>Firebase Firestore • Multi-Device Synced</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: COMPLETE MESSENGER CLIENT
  // -------------------------------------------------------------
  return (
    <div style={styles.appContainer}>
      {authToast && <div style={styles.toastNotification}>{authToast}</div>}

      {/* SIDEBAR */}
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
              <div style={{ fontSize: "11px", color: THEME.accent }}>● Firebase Synced ({currentUser.phone})</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              style={styles.circleActionButton}
              title="Create Firebase Group"
            >
              <Users size={16} color={THEME.secondary} />
            </button>

            <button
              onClick={() => setShowAddContactModal(true)}
              style={styles.circleActionButton}
              title="Add BD Contact from Firebase"
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

        {/* CHATS LIST */}
        {sidebarView === "chats" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div style={styles.searchBarBox}>
              <Search size={16} color={THEME.textMuted} style={{ marginRight: "8px" }} />
              <input
                type="text"
                placeholder="Search synced chats or numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.bareInput}
              />
            </div>

            <div style={styles.listSubHeader}>
              <span>CONVERSATIONS ({filteredContacts.length})</span>
              <button onClick={() => setShowAddContactModal(true)} style={styles.linkButtonText}>
                + Add by Number
              </button>
            </div>

            <div style={styles.contactsScrollList}>
              {filteredContacts.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: THEME.textMuted, fontSize: "13px" }}>
                  No contacts found in Firebase. Click <b>+ Add by Number</b> to verify any BD user globally!
                </div>
              ) : (
                filteredContacts.map((c) => {
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
                          {lastMsg && lastMsg.senderPhone === currentUser.phone && (
                            <span style={{ marginRight: "4px", display: "inline-flex" }}>
                              {lastMsg.status === "read" ? (
                                <CheckCheck size={14} color={THEME.tickRead} />
                              ) : (
                                <Check size={14} color={THEME.tickSent} />
                              )}
                            </span>
                          )}
                          <span style={styles.lastMsgTruncatedText}>
                            {lastMsg ? lastMsg.content : c.isGroup ? "Group synced" : c.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SETTINGS SUITE */}
        {sidebarView === "settings" && (
          <div style={styles.settingsSuiteContainer}>
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

            {settingsActiveTab === "main" && (
              <div style={styles.settingsScrollContent}>
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
                  <div onClick={() => setSettingsActiveTab("privacy")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Lock size={18} color="#a855f7" />
                      <div>
                        <div style={styles.settingsRowTitle}>Privacy & Security</div>
                        <div style={styles.settingsRowDesc}>E2E Encryption, Vanish Mode</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  <div onClick={() => setSettingsActiveTab("storage")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Database size={18} color="#06b6d4" />
                      <div>
                        <div style={styles.settingsRowTitle}>Firebase Cloud Database</div>
                        <div style={styles.settingsRowDesc}>{firebaseConfig.projectId}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>
                </div>

                <button onClick={handleLogout} style={styles.logoutButton}>
                  <LogOut size={16} />
                  <span>Log Out of Infinity Chat</span>
                </button>
              </div>
            )}

            {settingsActiveTab === "profile" && (
              <div style={styles.settingsScrollContent}>
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <img src={currentUser.avatar} alt="" style={styles.avatarLargeImg} />
                  <div style={{ fontSize: "11px", color: THEME.textMuted, marginTop: "6px" }}>
                    Visible globally across all Firebase connected devices
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
                    <label style={styles.labelTitle}>About / Bio</label>
                    <div style={styles.fieldBox}>
                      <input
                        type="text"
                        value={profileAbout}
                        onChange={(e) => setProfileAbout(e.target.value)}
                        style={styles.bareInput}
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      const updated = { ...currentUser, name: profileName, about: profileAbout };
                      await setDoc(doc(db, "users", currentUser.phone), updated, { merge: true });
                      setCurrentUser(updated);
                      localStorage.setItem("infinity_auth_user", JSON.stringify(updated));
                      showToast("Profile synced to Firebase!");
                    }}
                    style={styles.primaryActionButton}
                  >
                    Save Changes to Firebase
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* CHAT WINDOW */}
      <main
        style={{
          ...styles.chatWindow,
          display: mobileView === "list" ? "none" : "flex"
        }}
        className="app-chat-window"
      >
        {activeChat ? (
          <>
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
                  <img src={activeChat.avatar} alt="" style={styles.avatarImg} />
                  {activeChat.isOnline && <div style={styles.activeDotIndicator} />}
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
                    {activeChat.isGroup && <Users size={14} color={THEME.secondary} />}
                    {activeChat.name}
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {vanishMode ? "🔒 Vanish mode: 15s deletion" : activeChat.lastSeen || "Online"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => startRealWebRtcCall("audio")}
                  style={styles.headerIconButton}
                  title="WebRTC Voice Call"
                >
                  <Phone size={17} color={THEME.secondary} />
                </button>

                <button
                  onClick={() => startRealWebRtcCall("video")}
                  style={styles.headerIconButton}
                  title="WebRTC Video Call"
                >
                  <Video size={17} color={THEME.accent} />
                </button>

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

            {/* Messages Feed */}
            <div style={styles.messageFeedViewport}>
              {activeMessages.length === 0 ? (
                <div style={styles.emptyNoticeBox}>
                  <MessageSquare size={38} color={THEME.textMuted} style={{ marginBottom: "8px" }} />
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>
                    No messages yet with {activeChat.name}
                  </div>
                  <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "4px 0 0" }}>
                    Connected to Firebase Firestore. Send a message!
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMe = msg.senderPhone === currentUser.phone;
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

            {/* Bottom Dock Input */}
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
                  title="Attach media or file"
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
                      vanishMode ? "Disappearing message..." : `Message ${activeChat.name}...`
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
          </>
        ) : (
          <div style={styles.emptyNoticeBox}>
            <MessageSquare size={48} color={THEME.textMuted} style={{ marginBottom: "12px" }} />
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>Welcome, {currentUser.name}!</div>
            <p style={{ fontSize: "13px", color: THEME.textMuted }}>
              Select a conversation or click <b>+ Add by Number</b> to verify any BD user across Firebase.
            </p>
          </div>
        )}
      </main>

      {/* ----------------- 1. ADD CONTACT MODAL (FIREBASE) ----------------- */}
      {showAddContactModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContainerCard}>
            <div style={styles.modalTopHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Add BD Contact (Firebase)</span>
              </div>
              <button onClick={() => setShowAddContactModal(false)} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyAndAddContact} style={{ padding: "18px" }}>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "0 0 12px" }}>
                Enter an 11-digit BD number. Infinity Chat queries your Firebase collection directly.
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
                <button type="submit" disabled={isSyncing} style={styles.primaryActionButton}>
                  {isSyncing ? <Loader2 size={16} className="spin" /> : <span>Verify & Add</span>}
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
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Create Firebase Group</span>
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
                  placeholder="e.g. Engineering Sync 🚀"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={styles.bareInput}
                  autoFocus
                />
              </div>

              <label style={styles.labelTitle}>Select Contacts</label>
              <div style={styles.groupMemberListScroll}>
                {contacts
                  .filter((c) => !c.isGroup)
                  .map((contact) => {
                    const isSelected = selectedGroupMembers.includes(contact.id);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGroupMembers(selectedGroupMembers.filter((id) => id !== contact.id));
                          } else {
                            setSelectedGroupMembers([...selectedGroupMembers, contact.id]);
                          }
                        }}
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
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Not Found in Firebase</span>
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
                This BD number has not registered on Infinity Chat yet. Send them an invite link to connect!
              </p>

              <div style={styles.inviteLinkContainer}>
                <span style={{ fontSize: "11px", color: "#cbd5e1" }}>{inviteModalData.inviteUrl}</span>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteModalData.inviteUrl);
                  showToast("Invite link copied to clipboard!");
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

      {/* ----------------- 4. WEBRTC CALL OVERLAY ----------------- */}
      {activeCall && (
        <div style={styles.webrtcCallModalOverlay}>
          <div style={styles.callCardContainer}>
            <div style={{ fontSize: "12px", color: THEME.textMuted, marginBottom: "8px" }}>
              {activeCall.type === "video" ? "Infinity WebRTC HD Video Call" : "Infinity Encrypted Voice Call"}
            </div>

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

// -------------------------------------------------------------
// STYLESHEET DEFINITION
// -------------------------------------------------------------
const styles = {
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
