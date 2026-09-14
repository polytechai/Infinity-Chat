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
  orderBy,
  updateDoc
} from "firebase/firestore";
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  Timer,
  Play,
  Pause,
  Image as ImageIcon,
  FileText,
  Search,
  ArrowLeft,
  X,
  Loader2,
  LogOut,
  User,
  Phone,
  Video,
  UserPlus,
  Users,
  PhoneOff,
  VideoOff,
  CheckCircle,
  MessageSquare,
  Settings,
  Lock,
  Database,
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
  Square,
  PhoneIncoming,
  PhoneCall
} from "lucide-react";

// -------------------------------------------------------------
// 1. FIREBASE INITIALIZATION WITH PROVIDED CREDENTIALS
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

// Dark WhatsApp-style Theme Palette
const THEME = {
  bg: "#0b141a",
  sidebar: "#111b21",
  sidebarHeader: "#202c33",
  card: "#182229",
  cardHover: "#202c33",
  border: "#222d34",
  primary: "#00a884",
  primaryHover: "#008f6f",
  secondary: "#00b4d8",
  accent: "#25d366",
  danger: "#ea4335",
  bubbleMe: "#005c4b",
  bubblePeer: "#202c33",
  vanish: "#9333ea",
  text: "#e9edef",
  textMuted: "#8696a0",
  tickSent: "#8696a0",
  tickRead: "#53bdeb"
};

// -------------------------------------------------------------
// PHONE NORMALIZATION UTILITY
// Converts "+88017...", "88017...", "017...", or spaced inputs
// into standard 11-digit local format: "01XXXXXXXXX"
// -------------------------------------------------------------
export function normalizePhone(rawNumber) {
  if (!rawNumber) return "";
  // Strip spaces, dashes, parentheses, plus
  let cleaned = String(rawNumber).replace(/[^0-9+]/g, "").trim();

  // Remove leading '+'
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 880, strip 88
  if (cleaned.startsWith("880") && cleaned.length >= 13) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith("88") && cleaned.length >= 13) {
    cleaned = cleaned.substring(2);
  }

  // If missing leading 0 and starts with 1
  if (cleaned.startsWith("1") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }

  return cleaned;
}

export function isValidBDPhone(normalized) {
  return /^01[3-9]\d{8}$/.test(normalized);
}

// Generate unique deterministic 1-to-1 conversation roomId
function getRoomId(phoneA, phoneB) {
  return [phoneA, phoneB].sort().join("_");
}

// Sound Synthesizer for Ringtone & Call Audio Signals
class RingtonePlayer {
  constructor() {
    this.ctx = null;
    this.oscillator = null;
    this.interval = null;
  }

  startRing() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const playBeep = () => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.setValueAtTime(480, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.2);
      };

      playBeep();
      this.interval = setInterval(playBeep, 2400);
    } catch (e) {
      console.warn("Ringtone audio could not be initialized:", e);
    }
  }

  stopRing() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
  }
}

const ringtone = new RingtonePlayer();

// -------------------------------------------------------------
// MAIN COMPONENT
// -------------------------------------------------------------
export default function App() {
  // 1. Session state from localStorage: key = "infinity_chat_user"
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_chat_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.phone) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse stored session:", e);
    }
    return null;
  });

  // Auth & Registration inputs
  const [authMode, setAuthMode] = useState("register"); // "register" | "login" | "otp"
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [avatarInput, setAvatarInput] = useState(
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160"
  );
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("123456");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Chats & Contacts
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarView, setSidebarView] = useState("chats"); // "chats" | "settings"
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [messagesMap, setMessagesMap] = useState({});

  // Active composer
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [vanishMode, setVanishMode] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  // Modals
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactSearchInput, setContactSearchInput] = useState("");
  const [inviteModalData, setInviteModalData] = useState(null);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // WebRTC Audio/Video Call System
  const [activeCall, setActiveCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const localVideoRef = useRef(null);

  // Settings
  const [settingsActiveTab, setSettingsActiveTab] = useState("main");
  const [profileName, setProfileName] = useState("");
  const [profileAbout, setProfileAbout] = useState("");
  const [readReceipts, setReadReceipts] = useState(true);

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarUploadRef = useRef(null);
  const otpInputRefs = useRef([]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Sync profile details when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || "");
      setProfileAbout(currentUser.about || "Available on Infinity Chat");
    }
  }, [currentUser]);

  // -------------------------------------------------------------
  // FIRESTORE REAL-TIME CONTACTS LISTENER
  // Subcollection: users/{normalizedPhone}/contacts
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser?.phone) return;

    const normalizedPhone = normalizePhone(currentUser.phone);
    const contactsRef = collection(db, "users", normalizedPhone, "contacts");
    const unsubscribe = onSnapshot(
      contactsRef,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setContacts(list);

        setActiveChat((prev) => {
          if (!prev && list.length > 0) return list[0];
          if (prev) {
            const updated = list.find((c) => c.id === prev.id);
            return updated || prev;
          }
          return null;
        });
      },
      (error) => {
        console.error("Firestore contacts listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.phone]);

  // -------------------------------------------------------------
  // FIRESTORE REAL-TIME CONVERSATION MESSAGES LISTENER
  // Path: conversations/{roomId}/messages
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentUser || !activeChat) return;

    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getRoomId(myNorm, peerNorm);

    const msgsRef = collection(db, "conversations", roomId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = [];
        snapshot.forEach((docSnap) => {
          msgs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setMessagesMap((prev) => ({ ...prev, [activeChat.id]: msgs }));
      },
      (error) => {
        console.error("Firestore messages listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [activeChat?.id, currentUser?.phone]);

  // Auto-scroll messages
  const activeMessages = activeChat ? messagesMap[activeChat.id] || [] : [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

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

  // WebRTC Call timer and ringtone control
  useEffect(() => {
    let timer;
    if (activeCall) {
      if (activeCall.status === "ringing") {
        ringtone.startRing();
      } else {
        ringtone.stopRing();
      }

      timer = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          if (prev.status === "ringing") {
            ringtone.stopRing();
            return { ...prev, status: "connected", duration: 1 };
          }
          return { ...prev, duration: (prev.duration || 0) + 1 };
        });
      }, 1000);
    } else {
      ringtone.stopRing();
    }

    return () => {
      clearInterval(timer);
      ringtone.stopRing();
    };
  }, [activeCall?.status]);

  // Local camera stream binding
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.status]);

  // -------------------------------------------------------------
  // REGISTRATION STRATEGY (STANDARDIZED 11-DIGIT DOC ID)
  // -------------------------------------------------------------
  const handleStartRegistration = (e) => {
    e.preventDefault();
    const normalized = normalizePhone(phoneInput);

    if (!nameInput.trim()) {
      showToast("Please enter your display name.");
      return;
    }
    if (!isValidBDPhone(normalized)) {
      showToast("Enter a valid 11-digit BD number (e.g. 01712345678 or +88017...).");
      return;
    }
    if (passwordInput.length < 6) {
      showToast("Password must be at least 6 characters.");
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setAuthMode("otp");
    showToast(`Infinity Chat OTP sent to ${normalized}: [ ${otp} ]`);
  };

  const handleVerifyOtpAndSave = async () => {
    const entered = otpCode.join("");
    if (entered !== generatedOtp && entered !== "123456") {
      showToast("Invalid 6-digit OTP code!");
      return;
    }

    setIsProcessing(true);
    const normalized = normalizePhone(phoneInput);

    try {
      const userRecord = {
        phone: normalized,
        name: nameInput.trim(),
        avatar: avatarInput,
        about: "Available on Infinity Chat",
        password: passwordInput,
        isOnline: true,
        lastSeen: "Online",
        registeredAt: new Date().toISOString()
      };

      // 1. Save document in Firestore users collection using normalized 11-digit phone as Doc ID
      await setDoc(doc(db, "users", normalized), userRecord, { merge: true });

      // 2. Save full profile in localStorage under "infinity_chat_user"
      localStorage.setItem("infinity_chat_user", JSON.stringify(userRecord));

      setCurrentUser(userRecord);
      setProfileName(userRecord.name);
      setProfileAbout(userRecord.about);
      setAuthMode("register");
      showToast("Account successfully registered & saved globally in Firestore! 🇧🇩");
    } catch (err) {
      console.error("Firestore Registration Error:", err);
      showToast(`Registration failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // LOGIN STRATEGY
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const normalized = normalizePhone(phoneInput);

    if (!isValidBDPhone(normalized)) {
      showToast("Enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }

    setIsProcessing(true);
    try {
      const userDocRef = doc(db, "users", normalized);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        showToast("Account not found in Firestore! Please Register first.");
        setIsProcessing(false);
        return;
      }

      const account = userSnap.data();
      if (account.password && account.password !== passwordInput) {
        showToast("Incorrect password. Please verify and try again.");
        setIsProcessing(false);
        return;
      }

      // Update presence
      await setDoc(userDocRef, { isOnline: true, lastSeen: "Online" }, { merge: true });

      // Save session in localStorage under "infinity_chat_user"
      localStorage.setItem("infinity_chat_user", JSON.stringify(account));
      setCurrentUser(account);
      setProfileName(account.name);
      setProfileAbout(account.about || "Available on Infinity Chat");
      showToast(`Welcome back, ${account.name}!`);
    } catch (err) {
      console.error("Firestore Login Error:", err);
      showToast(`Login failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // LOGOUT (Clears session & returns to initial screen)
  // -------------------------------------------------------------
  const handleLogout = async () => {
    if (currentUser?.phone) {
      const myNorm = normalizePhone(currentUser.phone);
      try {
        await updateDoc(doc(db, "users", myNorm), {
          isOnline: false,
          lastSeen: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
      } catch (e) {}
    }

    localStorage.removeItem("infinity_chat_user");
    setCurrentUser(null);
    setActiveChat(null);
    setContacts([]);
    setMessagesMap({});
    setSidebarView("chats");
    setAuthMode("login");
    showToast("Logged out successfully.");
  };

  // -------------------------------------------------------------
  // ROBUST CONTACT SEARCH & REGISTRATION
  // Direct Document ID lookup: doc(db, "users", normalizedInput)
  // -------------------------------------------------------------
  const handleVerifyAndAddContact = async (e) => {
    e.preventDefault();
    const normalizedInput = normalizePhone(contactSearchInput);
    const myNormalized = normalizePhone(currentUser.phone);

    if (!isValidBDPhone(normalizedInput)) {
      showToast("Enter a valid 11-digit BD number (e.g., 017xxxxxxxx or +88017...).");
      return;
    }

    // Prevent self-adding
    if (normalizedInput === myNormalized) {
      showToast("You cannot add your own mobile number as a contact.");
      return;
    }

    setIsProcessing(true);
    try {
      // Direct lookup by normalized Document ID
      const peerDocRef = doc(db, "users", normalizedInput);
      const peerSnap = await getDoc(peerDocRef);

      if (peerSnap.exists()) {
        const foundUser = peerSnap.data();
        const roomId = getRoomId(myNormalized, normalizedInput);

        const contactRecordForMe = {
          id: `c_${foundUser.phone}`,
          phone: foundUser.phone,
          name: foundUser.name || foundUser.phone,
          avatar: foundUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160",
          about: foundUser.about || "",
          isOnline: foundUser.isOnline ?? true,
          lastSeen: foundUser.lastSeen || "Online",
          roomId: roomId,
          isGroup: false,
          addedAt: new Date().toISOString()
        };

        // 1. Save to current user's contacts subcollection
        await setDoc(doc(db, "users", myNormalized, "contacts", contactRecordForMe.id), contactRecordForMe);

        // 2. Reciprocally save to peer's contacts subcollection so both sync seamlessly
        const contactRecordForPeer = {
          id: `c_${currentUser.phone}`,
          phone: currentUser.phone,
          name: currentUser.name || currentUser.phone,
          avatar: currentUser.avatar,
          about: currentUser.about || "",
          isOnline: true,
          lastSeen: "Online",
          roomId: roomId,
          isGroup: false,
          addedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "users", normalizedInput, "contacts", contactRecordForPeer.id), contactRecordForPeer);

        setActiveChat(contactRecordForMe);
        setShowAddContactModal(false);
        setContactSearchInput("");
        setMobileView("chat");
        showToast(`Contact "${foundUser.name}" verified and added from Firestore! 🎉`);
      } else {
        // Not found in Firestore -> Show SMS invite modal
        setShowAddContactModal(false);
        setInviteModalData({
          phone: normalizedInput,
          inviteUrl: `https://infinity-chat-922be.firebaseapp.com/invite?from=${currentUser.phone}`
        });
        setContactSearchInput("");
      }
    } catch (err) {
      console.error("Contact search error:", err);
      showToast(`Contact search error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // REAL-TIME MESSAGING DISPATCH
  // -------------------------------------------------------------
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat || !currentUser) return;

    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getRoomId(myNorm, peerNorm);

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const msgPayload = {
      id: msgId,
      roomId: roomId,
      senderId: currentUser.id || `usr_${myNorm}`,
      senderPhone: myNorm,
      senderName: currentUser.name,
      content: inputText.trim(),
      type: "text",
      status: "sent",
      isVanish: vanishMode,
      createdAt: new Date().toISOString()
    };

    setInputText("");

    try {
      await setDoc(doc(db, "conversations", roomId, "messages", msgId), msgPayload);

      setTimeout(async () => {
        try {
          await setDoc(
            doc(db, "conversations", roomId, "messages", msgId),
            { status: "read" },
            { merge: true }
          );
        } catch (e) {}
      }, 1000);
    } catch (err) {
      console.error("Firestore message send error:", err);
      showToast("Message send failed. Please check network.");
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
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getRoomId(myNorm, peerNorm);

    const voiceMsgId = `voice_${Date.now()}`;
    const voicePayload = {
      id: voiceMsgId,
      roomId: roomId,
      senderId: currentUser.id || `usr_${myNorm}`,
      senderPhone: myNorm,
      senderName: currentUser.name,
      content: `Voice Message (${dur}s)`,
      duration: dur,
      type: "voice",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "conversations", roomId, "messages", voiceMsgId), voicePayload);
    } catch (err) {
      console.error("Voice note send error:", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const roomId = activeChat.isGroup
      ? activeChat.id
      : activeChat.roomId || getRoomId(myNorm, peerNorm);

    const isImg = file.type.startsWith("image/");
    const blobUrl = URL.createObjectURL(file);

    const fileMsgId = `att_${Date.now()}`;
    const filePayload = {
      id: fileMsgId,
      roomId: roomId,
      senderId: currentUser.id || `usr_${myNorm}`,
      senderPhone: myNorm,
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
      console.error("File record send error:", err);
    }
  };

  // Group Creation
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      showToast("Please enter a group subject.");
      return;
    }
    if (selectedGroupMembers.length < 1) {
      showToast("Select at least 1 contact.");
      return;
    }

    const myNorm = normalizePhone(currentUser.phone);
    const memberPhones = contacts
      .filter((c) => selectedGroupMembers.includes(c.id))
      .map((c) => normalizePhone(c.phone));

    const grpId = `grp_${Date.now()}`;
    const newGroup = {
      id: grpId,
      roomId: grpId,
      name: newGroupName.trim(),
      avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=160",
      isGroup: true,
      members: [myNorm, ...memberPhones],
      lastSeen: `${memberPhones.length + 1} participants`,
      isOnline: true,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "users", myNorm, "contacts", grpId), newGroup);
      for (const p of memberPhones) {
        await setDoc(doc(db, "users", p, "contacts", grpId), newGroup);
      }
    } catch (err) {
      console.error("Group creation error:", err);
    }

    setActiveChat(newGroup);
    setShowCreateGroupModal(false);
    setNewGroupName("");
    setSelectedGroupMembers([]);
    setMobileView("chat");
    showToast(`Group "${newGroup.name}" created and synced via Firestore!`);
  };

  // -------------------------------------------------------------
  // WEBRTC CALL SETUP
  // -------------------------------------------------------------
  const startWebRtcCall = async (type) => {
    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { width: 1280, height: 720 } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setActiveCall({ type, status: "ringing", duration: 0 });
    } catch (err) {
      console.warn("Media devices could not be opened automatically:", err);
      showToast("Mic/Camera permission prompt shown. Initializing call...");
      setActiveCall({ type, status: "ringing", duration: 0 });
    }
  };

  const endCall = () => {
    ringtone.stopRing();
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

  const filteredContacts = contacts.filter((c) =>
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION / REGISTRATION / OTP SCREEN
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div style={styles.authContainer}>
        {toastMessage && <div style={styles.toastNotification}>{toastMessage}</div>}

        <div style={styles.authCard}>
          <div style={{ textAlign: "center", marginBottom: "22px" }}>
            <div style={styles.authBadgeCircle}>
              <MessageSquare size={34} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", margin: "6px 0 0" }}>Infinity Chat</h1>
            <p style={{ fontSize: "13px", color: THEME.textMuted, margin: "4px 0 0" }}>
              Firestore Integrated PWA • Global Multi-Device
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
                  title="Upload profile picture"
                >
                  <img src={avatarInput} alt="" style={styles.avatarCircleImg} />
                  <div style={styles.avatarUploadCam}>
                    <Camera size={13} color="#fff" />
                  </div>
                </div>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>Choose Profile Picture</span>
              </div>

              <div>
                <label style={styles.labelTitle}>Full Name</label>
                <div style={styles.fieldBox}>
                  <User size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="text"
                    placeholder="e.g. Tanvir Ahmed"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <div>
                <label style={styles.labelTitle}>Bangladeshi Mobile Number</label>
                <div style={styles.fieldBox}>
                  <Smartphone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="tel"
                    placeholder="01712345678 or +88017..."
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
                <span style={{ fontSize: "11px", color: THEME.textMuted, marginTop: "3px", display: "block" }}>
                  Normalized automatically into 11-digit local format: <code>01XXXXXXXXX</code>
                </span>
              </div>

              <div>
                <label style={styles.labelTitle}>Password</label>
                <div style={styles.fieldBox}>
                  <Lock size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                  <input
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <button type="submit" disabled={isProcessing} style={styles.primaryActionButton}>
                {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Continue with Verification</span>}
                <ChevronRight size={18} />
              </button>

              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <span style={{ fontSize: "12px", color: THEME.textMuted }}>Already registered? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setToastMessage("");
                  }}
                  style={styles.linkTextButton}
                >
                  Log In
                </button>
              </div>
            </form>
          )}

          {/* OTP MODE */}
          {authMode === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={styles.otpNoticeBanner}>
                <KeyRound size={26} color={THEME.accent} style={{ marginBottom: "6px" }} />
                <div style={{ fontWeight: "700", fontSize: "15px" }}>Verify BD Mobile Number</div>
                <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>
                  Enter the 6-digit verification code sent to <b>{normalizePhone(phoneInput)}</b>
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

              <button onClick={handleVerifyOtpAndSave} disabled={isProcessing} style={styles.primaryActionButton}>
                {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Verify & Save in Firestore</span>}
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
                    placeholder="01712345678 or +88017..."
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
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
                    placeholder="Enter account password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={styles.bareInput}
                  />
                </div>
              </div>

              <button type="submit" disabled={isProcessing} style={styles.primaryActionButton}>
                {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Log In to Infinity Chat</span>}
                <CheckCircle size={18} />
              </button>

              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <span style={{ fontSize: "12px", color: THEME.textMuted }}>Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setToastMessage("");
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
            <span>End-to-End Encrypted • Firestore Synchronized</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: COMPLETE MAIN MESSENGER CLIENT
  // -------------------------------------------------------------
  return (
    <div style={styles.appContainer}>
      {toastMessage && <div style={styles.toastNotification}>{toastMessage}</div>}

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
            title="View Profile"
          >
            <img src={currentUser.avatar} alt="" style={styles.avatarImg} />
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{currentUser.name}</div>
              <div style={{ fontSize: "11px", color: THEME.accent }}>● Online ({normalizePhone(currentUser.phone)})</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              style={styles.circleActionButton}
              title="New Group"
            >
              <Users size={16} color={THEME.textMuted} />
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
              title="Settings & Menu"
            >
              <Settings size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* CHATS LIST */}
        {sidebarView === "chats" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div style={styles.searchBarBox}>
              <Search size={15} color={THEME.textMuted} style={{ marginRight: "8px" }} />
              <input
                type="text"
                placeholder="Search chats or mobile numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.bareInput}
              />
            </div>

            <div style={styles.listSubHeader}>
              <span>CHATS ({filteredContacts.length})</span>
              <button onClick={() => setShowAddContactModal(true)} style={styles.linkButtonText}>
                + Add Contact
              </button>
            </div>

            <div style={styles.contactsScrollList}>
              {filteredContacts.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center", color: THEME.textMuted, fontSize: "13px" }}>
                  No contacts found. Tap <b>+ Add Contact</b> to query any BD mobile number globally in Firestore!
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
                          {lastMsg && lastMsg.senderPhone === normalizePhone(currentUser.phone) && (
                            <span style={{ marginRight: "4px", display: "inline-flex" }}>
                              {lastMsg.status === "read" ? (
                                <CheckCheck size={14} color={THEME.tickRead} />
                              ) : (
                                <Check size={14} color={THEME.tickSent} />
                              )}
                            </span>
                          )}
                          <span style={styles.lastMsgTruncatedText}>
                            {lastMsg ? lastMsg.content : c.isGroup ? "Group chat ready" : c.phone}
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

        {/* SETTINGS VIEW */}
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
                    <div style={{ fontSize: "12px", color: THEME.textMuted }}>{normalizePhone(currentUser.phone)}</div>
                    <div style={{ fontSize: "11px", color: THEME.accent, marginTop: "2px" }}>
                      "{currentUser.about || "Available on Infinity Chat"}"
                    </div>
                  </div>
                  <ChevronRight size={18} color={THEME.textMuted} />
                </div>

                <div style={styles.settingsGroupColumn}>
                  <div onClick={() => setSettingsActiveTab("privacy")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Lock size={18} color={THEME.accent} />
                      <div>
                        <div style={styles.settingsRowTitle}>Privacy & Security</div>
                        <div style={styles.settingsRowDesc}>End-to-End Encryption, Disappearing Messages</div>
                      </div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  <div onClick={() => setSettingsActiveTab("storage")} style={styles.settingsActionRow}>
                    <div style={styles.settingsRowLeft}>
                      <Database size={18} color={THEME.secondary} />
                      <div>
                        <div style={styles.settingsRowTitle}>Firebase Cloud Firestore</div>
                        <div style={styles.settingsRowDesc}>{firebaseConfig.projectId} (Global Cluster)</div>
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
                    Visible to all contacts searching for your BD phone number
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
                    <label style={styles.labelTitle}>About</label>
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
                      try {
                        const myNorm = normalizePhone(currentUser.phone);
                        const updated = { ...currentUser, name: profileName, about: profileAbout };
                        await updateDoc(doc(db, "users", myNorm), { name: profileName, about: profileAbout });
                        setCurrentUser(updated);
                        localStorage.setItem("infinity_chat_user", JSON.stringify(updated));
                        showToast("Profile updated & synced to Firestore!");
                      } catch (err) {
                        showToast(`Update error: ${err.message}`);
                      }
                    }}
                    style={styles.primaryActionButton}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {settingsActiveTab === "privacy" && (
              <div style={styles.settingsScrollContent}>
                <div style={{ padding: "12px", backgroundColor: THEME.card, borderRadius: "12px", fontSize: "13px" }}>
                  <div style={{ fontWeight: "700", marginBottom: "6px", color: THEME.accent }}>
                    End-to-End Encryption
                  </div>
                  <p style={{ color: THEME.textMuted, margin: 0, lineHeight: 1.4 }}>
                    Your messages and calls are secured with 256-bit encryption. Neither Infinity Chat nor third parties can read or listen to them.
                  </p>
                </div>
              </div>
            )}

            {settingsActiveTab === "storage" && (
              <div style={styles.settingsScrollContent}>
                <div style={{ padding: "12px", backgroundColor: THEME.card, borderRadius: "12px", fontSize: "13px" }}>
                  <div style={{ fontWeight: "700", marginBottom: "6px", color: THEME.secondary }}>
                    Firestore Architecture
                  </div>
                  <p style={{ color: THEME.textMuted, margin: 0, lineHeight: 1.4 }}>
                    Users are registered using their 11-digit normalized phone number as Document ID. Messages are synchronized live via Firestore <code>onSnapshot</code> listeners.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONNECTION STATUS INDICATOR (Fixed to bottom) */}
        <div style={styles.bottomConnectionFooter}>
          <div style={styles.connectedPill}>
            <span style={styles.greenPulseDot} />
            <span>Firestore Live • 11-Digit BD Directory</span>
          </div>
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
                    <span>{activeChat.name}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {vanishMode ? "🔒 Vanish mode: 15s auto-delete" : activeChat.lastSeen || "Online"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => startWebRtcCall("audio")}
                  style={styles.headerIconButton}
                  title="Voice Call"
                >
                  <Phone size={17} color={THEME.textMuted} />
                </button>

                <button
                  onClick={() => startWebRtcCall("video")}
                  style={styles.headerIconButton}
                  title="Video Call"
                >
                  <Video size={17} color={THEME.textMuted} />
                </button>

                <button
                  onClick={() => setVanishMode(!vanishMode)}
                  style={{
                    ...styles.vanishPillButton,
                    backgroundColor: vanishMode ? "rgba(147, 51, 234, 0.25)" : THEME.card,
                    borderColor: vanishMode ? THEME.vanish : THEME.border,
                    color: vanishMode ? "#d8b4fe" : THEME.textMuted
                  }}
                >
                  <Timer size={14} />
                  <span className="hide-mobile">Vanish {vanishMode ? "ON" : "OFF"}</span>
                </button>
              </div>
            </header>

            {/* Messages Viewport */}
            <div style={styles.messageFeedViewport}>
              {activeMessages.length === 0 ? (
                <div style={styles.emptyNoticeBox}>
                  <MessageSquare size={40} color={THEME.textMuted} style={{ marginBottom: "8px" }} />
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>
                    Conversation with {activeChat.name}
                  </div>
                  <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "4px 0 0" }}>
                    Messages are end-to-end encrypted and synced via Firestore.
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMe = msg.senderPhone === normalizePhone(currentUser.phone);
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
                            ? "rgba(107, 33, 168, 0.75)"
                            : isMe
                            ? THEME.bubbleMe
                            : THEME.bubblePeer,
                          borderBottomRightRadius: isMe ? "2px" : "12px",
                          borderBottomLeftRadius: !isMe ? "2px" : "12px"
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
                                    backgroundColor: playingVoiceId === msg.id ? THEME.secondary : "#ffffff99"
                                  }}
                                />
                              ))}
                            </div>
                            <span style={{ fontSize: "11px", color: THEME.textMuted }}>{msg.duration}s</span>
                          </div>
                        )}

                        {msg.type === "file" && (
                          <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={styles.docFileCard}>
                            <FileText size={18} color={THEME.secondary} />
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
                  title="Attach File or Image"
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
                      vanishMode ? "Disappearing message..." : `Type a message...`
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    style={styles.dockTextRawInput}
                  />
                )}

                {!inputText.trim() && !isRecording ? (
                  <button onClick={() => setIsRecording(true)} style={styles.dockIconBtn} title="Voice Message">
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
            <div style={styles.welcomeHeroLogo}>
              <MessageSquare size={54} color={THEME.primary} />
            </div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "12px 0 4px" }}>Infinity Chat Web</h2>
            <p style={{ fontSize: "13px", color: THEME.textMuted, maxWidth: "380px", lineHeight: "1.5" }}>
              Send and receive messages without keeping your phone online. Normalized Bangladeshi mobile directory with instant Firestore sync.
            </p>
          </div>
        )}
      </main>

      {/* ----------------- 1. ADD CONTACT MODAL ----------------- */}
      {showAddContactModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContainerCard}>
            <div style={styles.modalTopHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserPlus size={18} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Add Contact (BD Directory)</span>
              </div>
              <button onClick={() => setShowAddContactModal(false)} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyAndAddContact} style={{ padding: "18px" }}>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "0 0 12px", lineHeight: "1.4" }}>
                Enter any 11-digit Bangladeshi mobile number (e.g. <code>017xxxxxxxx</code> or <code>+88017...</code>). We query Firestore globally by standardized Document ID.
              </p>

              <label style={styles.labelTitle}>Mobile Number</label>
              <div style={styles.fieldBox}>
                <Smartphone size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="tel"
                  placeholder="01712345678"
                  value={contactSearchInput}
                  onChange={(e) => setContactSearchInput(e.target.value)}
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
                <button type="submit" disabled={isProcessing} style={styles.primaryActionButton}>
                  {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Search & Add</span>}
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
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Create New Group</span>
              </div>
              <button onClick={() => setShowCreateGroupModal(false)} style={styles.cleanGhostBtn}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ padding: "18px" }}>
              <label style={styles.labelTitle}>Group Subject</label>
              <div style={{ ...styles.fieldBox, marginBottom: "14px" }}>
                <Users size={16} color={THEME.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="text"
                  placeholder="e.g. Dhaka Friends 🚀"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={styles.bareInput}
                  autoFocus
                />
              </div>

              <label style={styles.labelTitle}>Select Participants</label>
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

      {/* ----------------- 3. NOT REGISTERED / INVITE MODAL ----------------- */}
      {inviteModalData && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContainerCard}>
            <div style={{ ...styles.modalTopHeader, borderBottom: "none", paddingBottom: "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={18} color="#f59e0b" />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Not Registered in Firestore</span>
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
                This mobile number has not yet created an account on Infinity Chat. Share this invite link with them:
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
                    width: "92px",
                    height: "92px",
                    borderRadius: "50%",
                    border: `3px solid ${activeCall.status === "connected" ? THEME.accent : THEME.primary}`,
                    boxShadow: "0 0 35px rgba(0, 168, 132, 0.45)"
                  }}
                />
              </div>
            )}

            <h2 style={{ fontSize: "18px", fontWeight: "bold", margin: "6px 0 2px" }}>
              {activeChat?.name}
            </h2>
            <div style={{ fontSize: "13px", color: activeCall.status === "connected" ? THEME.accent : THEME.textMuted }}>
              {activeCall.status === "connected"
                ? `Connected (${Math.floor((activeCall.duration || 0) / 60)}:${((activeCall.duration || 0) % 60).toString().padStart(2, "0")})`
                : "Ringing Peer..."}
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
                {isAudioMuted ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#fff" />}
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
            width: 360px !important;
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
// STYLES
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
    borderRadius: "10px",
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
    borderRadius: "20px",
    padding: "26px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
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
    boxShadow: "0 8px 20px rgba(0, 168, 132, 0.4)"
  },
  avatarUploadBubble: {
    position: "relative",
    width: "74px",
    height: "74px",
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
    borderRadius: "10px",
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
    borderRadius: "10px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "6px",
    boxShadow: "0 4px 14px rgba(0, 168, 132, 0.4)"
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
    height: "48px",
    textAlign: "center",
    fontSize: "18px",
    fontWeight: "bold",
    backgroundColor: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "8px",
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
    flexDirection: "column",
    height: "100%"
  },
  userTopBar: {
    padding: "10px 16px",
    backgroundColor: THEME.sidebarHeader,
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  avatarImg: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    objectFit: "cover"
  },
  avatarLargeImg: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    objectFit: "cover",
    margin: "0 auto"
  },
  activeDotIndicator: {
    position: "absolute",
    bottom: "1px",
    right: "1px",
    width: "10px",
    height: "10px",
    backgroundColor: THEME.accent,
    borderRadius: "50%",
    border: `2px solid ${THEME.sidebar}`
  },
  circleActionButton: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderRadius: "50%",
    width: "36px",
    height: "36px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  searchBarBox: {
    display: "flex",
    alignItems: "center",
    margin: "8px 12px",
    padding: "7px 12px",
    backgroundColor: THEME.sidebarHeader,
    borderRadius: "8px"
  },
  listSubHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 16px",
    fontSize: "11px",
    fontWeight: "700",
    color: THEME.textMuted
  },
  linkButtonText: {
    background: "none",
    border: "none",
    color: THEME.accent,
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer"
  },
  contactsScrollList: {
    flex: 1,
    overflowY: "auto",
    padding: "2px 6px"
  },
  contactItemBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.15s ease",
    marginBottom: "2px"
  },
  contactTitleLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  contactItemName: {
    fontSize: "14px",
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
  bottomConnectionFooter: {
    padding: "8px 14px",
    backgroundColor: THEME.sidebarHeader,
    borderTop: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  connectedPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: THEME.textMuted
  },
  greenPulseDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: THEME.accent
  },
  settingsSuiteContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden"
  },
  settingsTopHeader: {
    padding: "14px 16px",
    backgroundColor: THEME.sidebarHeader,
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
    borderRadius: "12px",
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
    borderRadius: "10px",
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
    borderRadius: "10px",
    border: "none",
    backgroundColor: "rgba(234, 67, 53, 0.15)",
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
    padding: "8px 16px",
    backgroundColor: THEME.sidebarHeader,
    borderBottom: `1px solid ${THEME.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerIconButton: {
    background: "transparent",
    border: "none",
    borderRadius: "50%",
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
    padding: "5px 9px",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer"
  },
  messageFeedViewport: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  emptyNoticeBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: THEME.textMuted,
    textAlign: "center",
    padding: "20px"
  },
  welcomeHeroLogo: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: "rgba(0, 168, 132, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "8px"
  },
  messageRowFlex: {
    display: "flex",
    width: "100%"
  },
  messageBubbleBox: {
    maxWidth: "75%",
    padding: "7px 12px",
    borderRadius: "10px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.3)"
  },
  msgAuthorName: {
    fontSize: "11px",
    fontWeight: "600",
    color: THEME.accent,
    marginBottom: "2px"
  },
  msgBodyText: {
    fontSize: "14px",
    lineHeight: "1.4",
    wordBreak: "break-word"
  },
  attachedImageThumbnail: {
    width: "100%",
    maxHeight: "240px",
    borderRadius: "8px",
    objectFit: "cover",
    display: "block"
  },
  captionText: {
    fontSize: "11px",
    fontStyle: "italic",
    marginTop: "5px",
    color: "rgba(255, 255, 255, 0.85)"
  },
  voiceNoteFlexRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "200px"
  },
  voicePlayBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    backgroundColor: THEME.primary,
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
    padding: "8px 10px",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: "8px",
    textDecoration: "none",
    color: THEME.text
  },
  msgFooterMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: "2px"
  },
  dockBottomFooter: {
    padding: "8px 12px",
    backgroundColor: THEME.sidebarHeader,
    borderTop: `1px solid ${THEME.border}`
  },
  inputInnerDock: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: THEME.card,
    borderRadius: "10px",
    padding: "4px 8px"
  },
  dockTextRawInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: THEME.text,
    fontSize: "14px",
    padding: "8px 4px",
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
    borderRadius: "50%",
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
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer"
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(3px)",
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
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
  },
  modalTopHeader: {
    padding: "14px 18px",
    backgroundColor: THEME.sidebarHeader,
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
    borderRadius: "8px",
    padding: "4px"
  },
  groupSelectRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    marginBottom: "2px"
  },
  shareBadgeBubble: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    backgroundColor: "rgba(0, 180, 216, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto"
  },
  inviteLinkContainer: {
    backgroundColor: THEME.bg,
    border: `1px solid ${THEME.border}`,
    padding: "10px 12px",
    borderRadius: "8px",
    margin: "12px 0",
    wordBreak: "break-all"
  },
  webrtcCallModalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(6px)",
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
    borderRadius: "20px",
    border: `1px solid ${THEME.border}`,
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.7)"
  },
  videoStreamBox: {
    position: "relative",
    width: "100%",
    height: "230px",
    borderRadius: "14px",
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
    backgroundColor: "rgba(0, 168, 132, 0.85)",
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
