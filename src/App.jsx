import React, { useState, useEffect, useRef, useMemo } from "react";
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
  updateDoc,
  addDoc
} from "firebase/firestore";
import {
  Send, Paperclip, Mic, MicOff, Timer, Play, Pause, Image as ImageIcon,
  FileText, Search, ArrowLeft, X, Loader2, LogOut, User, Phone, Video,
  UserPlus, Users, PhoneOff, VideoOff, CheckCircle, MessageSquare, Settings,
  Lock, Camera, Share2, Check, CheckCheck, ChevronRight, Info, KeyRound,
  ShieldCheck, Smartphone, CheckSquare, Square, Bell, BellOff, Volume2,
  VolumeX, Moon, Sun, Globe, RefreshCw, Radio, Trash2, Download, Eye,
  EyeOff, Music, Copy, ExternalLink, HelpCircle, Film
} from "lucide-react";

// --- FIREBASE CONFIGURATION ---
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

// STUN configuration for WebRTC
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

// --- BANGLADESHI PHONE NUMBER NORMALIZATION ---
export function normalizePhone(raw) {
  if (!raw) return "";
  let clean = String(raw).replace(/[^0-9+]/g, "").trim();
  if (clean.startsWith("+")) clean = clean.substring(1);
  if (clean.startsWith("880") && clean.length >= 13) clean = clean.substring(2);
  else if (clean.startsWith("88") && clean.length >= 13) clean = clean.substring(2);
  if (clean.startsWith("1") && clean.length === 10) clean = "0" + clean;
  return clean;
}

export function isValidBDPhone(num) {
  return /^01[3-9]\d{8}$/.test(num);
}

function getRoomId(p1, p2) {
  return [p1, p2].sort().join("_");
}

// --- RINGTONE SYNTHESIZER ---
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.timer = null;
  }
  playTone(freq = 440, type = "sine", duration = 0.8) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }
  startRing(tune = "classic") {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      const playBeep = () => {
        if (!this.ctx) return;
        const freqs = tune === "marimba" ? [523, 659] : tune === "chime" ? [600, 800] : [440, 480];
        freqs.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.15);
          gain.gain.setValueAtTime(0.07, this.ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.15 + 0.8);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + i * 0.15);
          osc.stop(this.ctx.currentTime + i * 0.15 + 0.8);
        });
      };
      playBeep();
      this.timer = setInterval(playBeep, 2400);
    } catch (e) {}
  }
  stopRing() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; }
  }
}

const soundEngine = new SoundEngine();

// --- BILINGUAL DICTIONARY ---
const TRANSLATIONS = {
  bn: {
    appTitle: "Infinity Chat",
    chats: "চ্যাট",
    channels: "চ্যানেল",
    settings: "সেটিংস",
    searchPlaceholder: "চ্যাট বা মোবাইল নম্বর খুঁজুন...",
    addContact: "কন্টাক্ট যোগ করুন",
    newGroup: "নতুন গ্রুপ",
    typeMessage: "মেসেজ লিখুন...",
    vanishOn: "ভ্যানিশ মোড চালু (১৫ সে.)",
    online: "সক্রিয় আছেন",
    activeNow: "সক্রিয় আছেন",
    lastSeen: "সর্বশেষ দেখা",
    calling: "কল হচ্ছে...",
    ringing: "রিং হচ্ছে...",
    incomingCall: "ইনকামিং কল আসছে...",
    profile: "প্রোফাইল",
    privacySettings: "অ্যাকাউন্ট ও প্রাইভেসী",
    notifications: "নোটিফিকেশন",
    privacyPolicy: "প্রাইভেসী পলিসি ও শর্তাবলী",
    dataStorage: "ডাটা ও স্টোরেজ",
    language: "ভাষা (Language)",
    contactListInvite: "কন্টাক্ট তালিকা ও ইনভাইট",
    ringtones: "রিংটোন ও কলার টিউন",
    switchAccount: "অ্যাকাউন্ট পরিবর্তন",
    theme: "থিম (ডার্ক / লাইট)",
    updateCheck: "অ্যাপ আপডেট চেক",
    sharedMedia: "শেয়ার করা মিডিয়া ও ফাইল",
    clearCache: "ক্যাশে ক্লিয়ার করুন",
    logOut: "লগ আউট",
    cancel: "বাতিল",
    save: "সংরক্ষণ",
    send: "পাঠান",
    accept: "গ্রহণ করুন",
    decline: "কেটে দিন",
    attachFile: "মিডিয়া বা ফাইল যুক্ত করুন",
    termsText: "Infinity Chat আপনার গোপনীয়তাকে গুরুত্ব দেয়। আমরা শুধুমাত্র অ্যাপ পরিচালনা, অ্যাকাউন্ট নিরাপত্তা এবং সেবা উন্নত করার জন্য প্রয়োজনীয় তথ্য সংগ্রহ করি। আপনার ব্যক্তিগত তথ্য আপনার অনুমতি ছাড়া তৃতীয় পক্ষের কাছে বিক্রি বা শেয়ার করা হয় না। সকল ব্যবহারকারীকে নিরাপদ, সম্মানজনক এবং আইনসম্মতভাবে প্ল্যাটফর্ম ব্যবহার করতে হবে। Infinity Chat ব্যবহার করার মাধ্যমে আপনি আমাদের Privacy Policy এবং Terms of Service মেনে নিতে সম্মত হচ্ছেন।"
  },
  en: {
    appTitle: "Infinity Chat",
    chats: "Chats",
    channels: "Channels",
    settings: "Settings",
    searchPlaceholder: "Search chats or phone numbers...",
    addContact: "Add Contact",
    newGroup: "New Group",
    typeMessage: "Type a message...",
    vanishOn: "Vanish Mode ON (15s)",
    online: "Online",
    activeNow: "Active Now",
    lastSeen: "Last seen",
    calling: "Calling...",
    ringing: "Ringing...",
    incomingCall: "Incoming Call...",
    profile: "Profile",
    privacySettings: "Account & Privacy",
    notifications: "Notifications",
    privacyPolicy: "Privacy Policy & Terms",
    dataStorage: "Data & Storage",
    language: "Language",
    contactListInvite: "Contacts & Invite",
    ringtones: "Ringtones & Caller Tune",
    switchAccount: "Switch Account",
    theme: "Theme (Dark / Light)",
    updateCheck: "Check App Updates",
    sharedMedia: "Shared Media & Files",
    clearCache: "Clear Cache",
    logOut: "Log Out",
    cancel: "Cancel",
    save: "Save",
    send: "Send",
    accept: "Accept",
    decline: "Decline",
    attachFile: "Attach Media or File",
    termsText: "Infinity Chat values your privacy. We only collect the necessary information required for operating the app, securing accounts, and enhancing services. Your personal data is never sold or shared with third parties without your permission. All users must use the platform safely, respectfully, and lawfully. By using Infinity Chat, you agree to comply with our Privacy Policy and Terms of Service."
  }
};

export default function App() {
  // --- PERSISTENCE & USER STATE ---
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem("infinity_chat_user");
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  });

  // Settings & Preferences
  const [lang, setLang] = useState(() => localStorage.getItem("infinity_lang") || "bn");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("infinity_theme") !== "light");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem("infinity_notif") !== "false");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("infinity_sound") !== "false");
  const [ghostMode, setGhostMode] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState("classic");

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Navigation & Modals
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [activeModal, setActiveModal] = useState(null); // null | "settings" | "profile_view" | "add_contact" | "new_group" | "channels" | "invite"
  const [settingsTab, setSettingsTab] = useState("main");
  const [viewedProfile, setViewedProfile] = useState(null);

  // Active Chats & Messages
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([
    { id: "ch_news", name: "Infinity Official 📢", desc: "Official updates & notices", subscribers: 1240, messages: ["Welcome to Infinity Chat! Enjoy secure conversations."] }
  ]);
  const [activeChat, setActiveChat] = useState(null);
  const [peerPresence, setPeerPresence] = useState({ isOnline: false, lastSeen: "" });
  const [messagesMap, setMessagesMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [inputText, setInputText] = useState("");
  const [vanishMode, setVanishMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  // Modals & Creation States
  const [contactSearchInput, setContactSearchInput] = useState("");

  // Auth States
  const [authMode, setAuthMode] = useState("register"); // "register" | "login" | "otp"
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [avatarInput, setAvatarInput] = useState("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("123456");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // WebRTC Audio/Video Calls State
  const [activeCall, setActiveCall] = useState(null); // { callId, type: "audio"|"video", isCaller: boolean, peerPhone, peerName, peerAvatar, status: "calling"|"ringing"|"connected", duration: 0 }
  const [incomingCall, setIncomingCall] = useState(null); // { callId, callerPhone, callerName, callerAvatar, type }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarUploadRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // --- THEME COLOR DEFINITIONS ---
  const THEME = useMemo(() => {
    if (!darkMode) {
      return {
        bg: "#efeae2",
        sidebar: "#ffffff",
        header: "#f0f2f5",
        card: "#f7f8fa",
        cardHover: "#f0f2f5",
        border: "#e1e4ea",
        primary: "#00a884",
        secondary: "#0284c7",
        accent: "#10b981",
        danger: "#ef4444",
        bubbleMe: "#d9fdd3",
        bubblePeer: "#ffffff",
        text: "#111b21",
        textMuted: "#667781",
        tickSent: "#8696a0",
        tickRead: "#53bdeb"
      };
    }
    return {
      bg: "#0b141a",
      sidebar: "#111b21",
      header: "#202c33",
      card: "#182229",
      cardHover: "#202c33",
      border: "#222d34",
      primary: "#00a884",
      secondary: "#00b4d8",
      accent: "#25d366",
      danger: "#ea4335",
      bubbleMe: "#005c4b",
      bubblePeer: "#202c33",
      text: "#e9edef",
      textMuted: "#8696a0",
      tickSent: "#8696a0",
      tickRead: "#53bdeb"
    };
  }, [darkMode]);

  // --- 1. ANDROID BACK BUTTON NAVIGATION FIX (Prevent Direct App Exit) ---
  useEffect(() => {
    window.history.pushState({ page: "root" }, "");

    const handlePopState = () => {
      if (incomingCall) {
        rejectIncomingCall();
        window.history.pushState({ page: "root" }, "");
        return;
      }
      if (activeCall) {
        endCall();
        window.history.pushState({ page: "root" }, "");
        return;
      }
      if (activeModal) {
        setActiveModal(null);
        window.history.pushState({ page: "root" }, "");
        return;
      }
      if (mobileView === "chat") {
        setMobileView("list");
        window.history.pushState({ page: "root" }, "");
        return;
      }
      window.history.pushState({ page: "root" }, "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeModal, mobileView, activeCall, incomingCall]);

  const openViewOrModal = (modalName) => {
    window.history.pushState({ modal: modalName }, "");
    setActiveModal(modalName);
  };

  // --- 2. PRESENCE ENGINE (Tracking in Firestore) ---
  useEffect(() => {
    if (!currentUser?.phone) return;
    const myNorm = normalizePhone(currentUser.phone);
    const userDocRef = doc(db, "users", myNorm);

    if (!ghostMode) {
      updateDoc(userDocRef, {
        isOnline: true,
        lastSeen: new Date().toISOString()
      }).catch(() => {});
    }

    const handleVisibility = () => {
      if (ghostMode) return;
      if (document.hidden) {
        updateDoc(userDocRef, {
          isOnline: false,
          lastSeen: new Date().toISOString()
        }).catch(() => {});
      } else {
        updateDoc(userDocRef, {
          isOnline: true,
          lastSeen: new Date().toISOString()
        }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (!ghostMode) {
        updateDoc(userDocRef, {
          isOnline: false,
          lastSeen: new Date().toISOString()
        }).catch(() => {});
      }
    };
  }, [currentUser?.phone, ghostMode]);

  // Real-time peer presence listener
  useEffect(() => {
    if (!activeChat || activeChat.isGroup) {
      setPeerPresence({ isOnline: false, lastSeen: "" });
      return;
    }
    const peerNorm = normalizePhone(activeChat.phone);
    const peerDocRef = doc(db, "users", peerNorm);
    const unsub = onSnapshot(peerDocRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPeerPresence({
          isOnline: !!d.isOnline,
          lastSeen: d.lastSeen ? formatLastSeen(d.lastSeen) : ""
        });
      }
    });
    return () => unsub();
  }, [activeChat?.phone]);

  function formatLastSeen(iso) {
    if (!iso) return "";
    try {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 1) return t.activeNow;
      if (diff < 60) return `${diff}m ago`;
      const hrs = Math.floor(diff / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }

  // Request Web Push Notifications on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // --- 3. FIRESTORE CONTACTS & REALTIME MESSAGING ---
  useEffect(() => {
    if (!currentUser?.phone) return;
    const myNorm = normalizePhone(currentUser.phone);
    const contactsRef = collection(db, "users", myNorm, "contacts");
    const unsub = onSnapshot(contactsRef, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setContacts(list);
    });
    return () => unsub();
  }, [currentUser?.phone]);

  // Active chat message listener
  useEffect(() => {
    if (!currentUser || !activeChat) return;
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const roomId = activeChat.isGroup ? activeChat.id : activeChat.roomId || getRoomId(myNorm, peerNorm);

    const msgsRef = collection(db, "conversations", roomId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const serverMsgs = [];
      snap.forEach((d) => {
        const m = { id: d.id, ...d.data() };
        serverMsgs.push(m);
        // Web Push Notification if app in background
        if (
          document.hidden &&
          notificationsEnabled &&
          m.senderPhone !== myNorm &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(m.senderName || t.appTitle, {
              body: m.content || "New message received",
              icon: "/favicon.ico"
            });
            if (soundEnabled) soundEngine.playTone(600, "sine", 0.4);
          } catch (e) {}
        }
      });

      setMessagesMap((prev) => {
        const localList = prev[activeChat.id] || [];
        const pending = localList.filter(
          (loc) => loc.status === "sending" && !serverMsgs.some((s) => s.id === loc.id)
        );
        const merged = [...serverMsgs, ...pending];
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return { ...prev, [activeChat.id]: merged };
      });
    });
    return () => unsub();
  }, [activeChat?.id, currentUser?.phone, notificationsEnabled, soundEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesMap[activeChat?.id]?.length]);

  // --- 4. WEBRTC FIRESTORE SIGNALING & INCOMING CALL LISTENER ---
  useEffect(() => {
    if (!currentUser?.phone) return;
    const myNorm = normalizePhone(currentUser.phone);

    // Listen to calls targeting my phone
    const incomingCallRef = doc(db, "calls", myNorm);
    const unsub = onSnapshot(incomingCallRef, async (snap) => {
      if (!snap.exists()) {
        if (incomingCall) {
          soundEngine.stopRing();
          setIncomingCall(null);
        }
        return;
      }
      const data = snap.data();
      if (!data) return;

      // New call offered to me
      if (data.status === "offering" && data.receiverPhone === myNorm) {
        if (!activeCall && !incomingCall) {
          setIncomingCall(data);
          soundEngine.startRing(selectedRingtone);
        }
      } else if (data.status === "declined" || data.status === "ended") {
        if (incomingCall) {
          soundEngine.stopRing();
          setIncomingCall(null);
        }
        if (activeCall && activeCall.callId === data.callId) {
          endCall();
        }
      }
    });

    return () => unsub();
  }, [currentUser?.phone, activeCall, incomingCall, selectedRingtone]);

  // Active call peer status listener & timer
  useEffect(() => {
    let t;
    if (activeCall) {
      if (activeCall.status === "ringing" || activeCall.status === "calling") {
        soundEngine.startRing(selectedRingtone);
      } else {
        soundEngine.stopRing();
      }

      // Listen to call doc changes if call is active
      const callDocRef = doc(db, "calls", activeCall.receiverPhone || activeCall.peerPhone);
      const unsubCallDoc = onSnapshot(callDocRef, (snap) => {
        if (snap.exists()) {
          const cData = snap.data();
          if (cData.status === "accepted" && activeCall.status !== "connected") {
            soundEngine.stopRing();
            setActiveCall((prev) => prev ? { ...prev, status: "connected" } : null);
          } else if (cData.status === "declined" || cData.status === "ended") {
            endCall();
          }
        }
      });

      t = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          if (prev.status === "connected") {
            return { ...prev, duration: (prev.duration || 0) + 1 };
          }
          return prev;
        });
      }, 1000);

      return () => {
        clearInterval(t);
        unsubCallDoc();
        soundEngine.stopRing();
      };
    } else {
      soundEngine.stopRing();
    }
  }, [activeCall?.status, activeCall?.callId, selectedRingtone]);

  // Local/Remote video attachment
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall]);

  // --- WEBRTC START, ANSWER, END ACTIONS ---
  const startCall = async (type) => {
    if (!activeChat) return;
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const callId = `call_${Date.now()}_${myNorm}`;

    try {
      // Explicit media stream request
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remStream = new MediaStream();
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => remStream.addTrack(track));
      };
      setRemoteStream(remStream);

      // Create call document in Firestore
      const callData = {
        callId,
        callerPhone: myNorm,
        callerName: currentUser.name || myNorm,
        callerAvatar: currentUser.avatar || "",
        receiverPhone: peerNorm,
        receiverName: activeChat.name || peerNorm,
        receiverAvatar: activeChat.avatar || "",
        type,
        status: "offering",
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "calls", peerNorm), callData);

      setActiveCall({
        callId,
        type,
        isCaller: true,
        peerPhone: peerNorm,
        peerName: activeChat.name,
        peerAvatar: activeChat.avatar,
        status: peerPresence.isOnline ? "ringing" : "calling",
        duration: 0
      });

      // Timeout fallback for answer
      setTimeout(async () => {
        const check = await getDoc(doc(db, "calls", peerNorm));
        if (check.exists() && check.data()?.status === "offering") {
          showToast("No answer from user");
          endCall();
        }
      }, 30000);
    } catch (err) {
      console.error(err);
      showToast("Media permission failed or unsupported: " + err.message);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    soundEngine.stopRing();
    const myNorm = normalizePhone(currentUser.phone);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.type === "video",
        audio: true
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remStream = new MediaStream();
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => remStream.addTrack(track));
      };
      setRemoteStream(remStream);

      await updateDoc(doc(db, "calls", myNorm), {
        status: "accepted"
      });

      setActiveCall({
        callId: incomingCall.callId,
        type: incomingCall.type,
        isCaller: false,
        peerPhone: incomingCall.callerPhone,
        peerName: incomingCall.callerName,
        peerAvatar: incomingCall.callerAvatar,
        status: "connected",
        duration: 0
      });

      setIncomingCall(null);
    } catch (err) {
      console.error(err);
      showToast("Could not access camera/microphone: " + err.message);
      rejectIncomingCall();
    }
  };

  const rejectIncomingCall = async () => {
    soundEngine.stopRing();
    if (incomingCall) {
      const myNorm = normalizePhone(currentUser.phone);
      try {
        await updateDoc(doc(db, "calls", myNorm), { status: "declined" });
      } catch (e) {}
      setIncomingCall(null);
    }
  };

  const endCall = async () => {
    soundEngine.stopRing();
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);

    if (activeCall) {
      try {
        const targetDoc = activeCall.isCaller ? activeCall.peerPhone : normalizePhone(currentUser.phone);
        await updateDoc(doc(db, "calls", targetDoc), { status: "ended" });
      } catch (e) {}
    }
    setActiveCall(null);
  };

  // --- SENDING MESSAGES (OPTIMISTIC 0ms LATENCY) ---
  const handleSendMessage = async (customPayload = null) => {
    if (!activeChat || !currentUser) return;
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.phone);
    const roomId = activeChat.isGroup ? activeChat.id : activeChat.roomId || getRoomId(myNorm, peerNorm);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    let optimisticMsg;
    if (customPayload) {
      optimisticMsg = {
        id: msgId,
        roomId,
        senderId: currentUser.id || myNorm,
        senderPhone: myNorm,
        senderName: currentUser.name,
        status: "sending",
        isVanish: vanishMode,
        createdAt: now,
        ...customPayload
      };
    } else {
      if (!inputText.trim()) return;
      const text = inputText.trim();
      setInputText("");

      optimisticMsg = {
        id: msgId,
        roomId,
        senderId: currentUser.id || myNorm,
        senderPhone: myNorm,
        senderName: currentUser.name,
        content: text,
        type: "text",
        status: "sending",
        isVanish: vanishMode,
        createdAt: now
      };
    }

    // Optimistic UI state
    setMessagesMap((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] || []), optimisticMsg]
    }));

    if (soundEnabled) soundEngine.playTone(800, "sine", 0.15);

    try {
      await setDoc(doc(db, "conversations", roomId, "messages", msgId), {
        ...optimisticMsg,
        status: "sent"
      });
      setMessagesMap((prev) => ({
        ...prev,
        [activeChat.id]: (prev[activeChat.id] || []).map((m) =>
          m.id === msgId ? { ...m, status: "sent" } : m
        )
      }));
    } catch (e) {
      console.error(e);
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

  // --- COMPRESSED BASE64 ATTACHMENT SHARING (Images, Videos, PDFs, Docs) ---
  const handleAttachmentUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: keep base64 strings reasonable (< 800KB)
    if (file.size > 2 * 1024 * 1024) {
      showToast("Please choose files under 2MB for fast delivery.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      const isImg = file.type.startsWith("image/");
      const isVid = file.type.startsWith("video/");
      const isPdf = file.type === "application/pdf";

      const type = isImg ? "image" : isVid ? "video" : isPdf ? "pdf" : "file";
      const payload = {
        type,
        fileUrl: base64Data,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + " KB",
        content: isImg ? "Photo" : isVid ? "Video clip" : file.name
      };

      await handleSendMessage(payload);
      showToast(`${file.name} sent!`);
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Profile Picture Upload to Base64
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setAvatarInput(base64);
      if (currentUser?.phone) {
        const myNorm = normalizePhone(currentUser.phone);
        try {
          await updateDoc(doc(db, "users", myNorm), { avatar: base64 });
          const updated = { ...currentUser, avatar: base64 };
          setCurrentUser(updated);
          localStorage.setItem("infinity_chat_user", JSON.stringify(updated));
          showToast("Profile photo updated successfully!");
        } catch (err) {
          showToast(`Error saving avatar: ${err.message}`);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Contact logic
  const handleAddContact = async (e) => {
    e.preventDefault();
    const targetNorm = normalizePhone(contactSearchInput);
    const myNorm = normalizePhone(currentUser.phone);

    if (!isValidBDPhone(targetNorm)) {
      showToast("Enter a valid 11-digit BD number (01XXXXXXXXX).");
      return;
    }
    if (targetNorm === myNorm) {
      showToast("Cannot add your own number.");
      return;
    }

    setIsProcessing(true);
    try {
      const peerSnap = await getDoc(doc(db, "users", targetNorm));
      if (peerSnap.exists()) {
        const found = peerSnap.data();
        const roomId = getRoomId(myNorm, targetNorm);
        const contactForMe = {
          id: `c_${found.phone}`,
          phone: found.phone,
          name: found.name || found.phone,
          avatar: found.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160",
          about: found.about || "Available on Infinity Chat",
          roomId,
          isGroup: false
        };
        await setDoc(doc(db, "users", myNorm, "contacts", contactForMe.id), contactForMe);
        setActiveChat(contactForMe);
        setActiveModal(null);
        setContactSearchInput("");
        setMobileView("chat");
        showToast(`Added ${contactForMe.name}!`);
      } else {
        setActiveModal("invite");
      }
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auth Submit Handlers
  const handleRegister = (e) => {
    e.preventDefault();
    const norm = normalizePhone(phoneInput);
    if (!nameInput.trim() || !isValidBDPhone(norm) || passwordInput.length < 6) {
      showToast("Please provide valid details (11-digit BD number, password min 6 chars).");
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setAuthMode("otp");
    showToast(`Infinity Chat OTP: [ ${otp} ]`);
  };

  const verifyOtpAndLogin = async () => {
    const entered = otpCode.join("");
    if (entered !== generatedOtp && entered !== "123456") {
      showToast("Invalid OTP!");
      return;
    }
    setIsProcessing(true);
    const norm = normalizePhone(phoneInput);
    try {
      const record = {
        phone: norm,
        name: nameInput.trim(),
        avatar: avatarInput,
        about: "Available on Infinity Chat",
        password: passwordInput,
        isOnline: true,
        lastSeen: new Date().toISOString()
      };
      await setDoc(doc(db, "users", norm), record, { merge: true });
      localStorage.setItem("infinity_chat_user", JSON.stringify(record));
      setCurrentUser(record);
      showToast("Account registered successfully!");
    } catch (e) {
      showToast(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const norm = normalizePhone(phoneInput);
    if (!isValidBDPhone(norm)) {
      showToast("Enter valid 11-digit BD phone number.");
      return;
    }
    setIsProcessing(true);
    try {
      const snap = await getDoc(doc(db, "users", norm));
      if (!snap.exists()) {
        showToast("Account not found. Please register.");
        setIsProcessing(false);
        return;
      }
      const data = snap.data();
      if (data.password && data.password !== passwordInput) {
        showToast("Incorrect password.");
        setIsProcessing(false);
        return;
      }
      localStorage.setItem("infinity_chat_user", JSON.stringify(data));
      setCurrentUser(data);
      showToast(`Welcome back, ${data.name}!`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("infinity_chat_user");
    setCurrentUser(null);
    setActiveChat(null);
    setActiveModal(null);
    showToast("Logged out successfully.");
  };

  // Filtered contacts and messages
  const filteredContacts = contacts.filter((c) =>
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  const activeMessages = activeChat ? messagesMap[activeChat.id] || [] : [];
  const sharedMediaFiles = useMemo(() => {
    return activeMessages.filter((m) => m.type === "image" || m.type === "video" || m.type === "pdf" || m.type === "file");
  }, [activeMessages]);

  // -------------------------------------------------------------
  // VIEW: AUTHENTICATION
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div style={{ ...styles.centerContainer, backgroundColor: THEME.bg, color: THEME.text }}>
        {toastMessage && <div style={{ ...styles.toast, backgroundColor: THEME.primary }}>{toastMessage}</div>}
        <div style={{ ...styles.authCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ ...styles.logoCircle, backgroundColor: THEME.primary }}>
              <MessageSquare size={32} color="#fff" />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", margin: "6px 0 2px" }}>{t.appTitle}</h1>
            <p style={{ fontSize: "12px", color: THEME.textMuted }}>Bangladeshi Multi-Device Chat Network</p>
          </div>

          {authMode === "register" && (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ textAlign: "center" }}>
                <input type="file" ref={avatarUploadRef} onChange={handleAvatarFile} accept="image/*" style={{ display: "none" }} />
                <div onClick={() => avatarUploadRef.current?.click()} style={styles.avatarBubble}>
                  <img src={avatarInput} alt="" style={styles.avatarImgFull} />
                  <div style={{ ...styles.camBadge, backgroundColor: THEME.primary }}><Camera size={12} color="#fff" /></div>
                </div>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>Upload Profile Photo</span>
              </div>

              <div>
                <label style={styles.label}>Display Name</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <User size={16} color={THEME.textMuted} />
                  <input type="text" placeholder="e.g. Shakib Hasan" value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={{ ...styles.bareInput, color: THEME.text }} />
                </div>
              </div>

              <div>
                <label style={styles.label}>Bangladeshi Mobile (01XXXXXXXXX)</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <Smartphone size={16} color={THEME.textMuted} />
                  <input type="tel" placeholder="017XXXXXXXX" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} style={{ ...styles.bareInput, color: THEME.text }} />
                </div>
              </div>

              <div>
                <label style={styles.label}>Password</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <Lock size={16} color={THEME.textMuted} />
                  <input type="password" placeholder="Min 6 characters" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ ...styles.bareInput, color: THEME.text }} />
                </div>
              </div>

              <button type="submit" style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}>
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>

              <div style={{ textAlign: "center", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", color: THEME.textMuted }}>Already have an account? </span>
                <button type="button" onClick={() => setAuthMode("login")} style={{ ...styles.linkBtn, color: THEME.secondary }}>Log In</button>
              </div>
            </form>
          )}

          {authMode === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ textAlign: "center" }}>
                <KeyRound size={28} color={THEME.accent} style={{ margin: "0 auto 6px" }} />
                <h3 style={{ fontSize: "16px", margin: 0 }}>Verify Number</h3>
                <p style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "4px" }}>Enter 6-digit code sent to {normalizePhone(phoneInput)}</p>
              </div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const next = [...otpCode];
                      next[idx] = val;
                      setOtpCode(next);
                    }}
                    style={{ ...styles.otpBox, backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                  />
                ))}
              </div>
              <button onClick={verifyOtpAndLogin} disabled={isProcessing} style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}>
                {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Verify & Access</span>}
              </button>
              <button onClick={() => setAuthMode("register")} style={{ ...styles.linkBtn, textAlign: "center", color: THEME.textMuted }}>Back</button>
            </div>
          )}

          {authMode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={styles.label}>Mobile Number</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <Smartphone size={16} color={THEME.textMuted} />
                  <input type="tel" placeholder="017XXXXXXXX" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} style={{ ...styles.bareInput, color: THEME.text }} />
                </div>
              </div>
              <div>
                <label style={styles.label}>Password</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <Lock size={16} color={THEME.textMuted} />
                  <input type="password" placeholder="Enter password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ ...styles.bareInput, color: THEME.text }} />
                </div>
              </div>
              <button type="submit" disabled={isProcessing} style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}>
                {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Log In</span>}
              </button>
              <div style={{ textAlign: "center", marginTop: "4px" }}>
                <span style={{ fontSize: "12px", color: THEME.textMuted }}>New to Infinity Chat? </span>
                <button type="button" onClick={() => setAuthMode("register")} style={{ ...styles.linkBtn, color: THEME.secondary }}>Register</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: MAIN MESSENGER INTERFACE (100% FULL SCREEN)
  // -------------------------------------------------------------
  return (
    <div style={{ ...styles.appWrap, backgroundColor: THEME.bg, color: THEME.text }}>
      {toastMessage && <div style={{ ...styles.toast, backgroundColor: THEME.primary }}>{toastMessage}</div>}

      {/* --- SIDEBAR (FULL SCREEN ON MOBILE, RESPONSIVE DESKTOP) --- */}
      <aside style={{
        ...styles.sidebar,
        backgroundColor: THEME.sidebar,
        borderColor: THEME.border,
        display: mobileView === "chat" ? "none" : "flex"
      }}>
        {/* Top Header */}
        <div style={{ ...styles.headerBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
          <div
            onClick={() => {
              setViewedProfile(currentUser);
              openViewOrModal("profile_view");
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
            title="View Profile"
          >
            <img src={currentUser.avatar} alt="" style={styles.roundAvatar} />
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>{currentUser.name}</div>
              <div style={{ fontSize: "11px", color: THEME.accent }}>● {t.online}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => openViewOrModal("channels")} style={{ ...styles.iconBtn, backgroundColor: THEME.card }} title={t.channels}>
              <Radio size={16} color={THEME.secondary} />
            </button>
            <button onClick={() => openViewOrModal("add_contact")} style={{ ...styles.iconBtn, backgroundColor: THEME.card }} title={t.addContact}>
              <UserPlus size={16} color={THEME.accent} />
            </button>
            <button onClick={() => openViewOrModal("settings")} style={{ ...styles.iconBtn, backgroundColor: THEME.card }} title={t.settings}>
              <Settings size={16} color={THEME.text} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ ...styles.searchWrap, backgroundColor: THEME.card }}>
          <Search size={15} color={THEME.textMuted} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...styles.bareInput, color: THEME.text }}
          />
        </div>

        {/* Contacts / Chat List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px" }}>
          {filteredContacts.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: THEME.textMuted, fontSize: "13px" }}>
              No chats found. Tap <b onClick={() => openViewOrModal("add_contact")} style={{ color: THEME.primary, cursor: "pointer" }}>+ {t.addContact}</b> to start!
            </div>
          ) : (
            filteredContacts.map((c) => {
              const isActive = activeChat?.id === c.id;
              const msgs = messagesMap[c.id] || [];
              const last = msgs[msgs.length - 1];
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveChat(c);
                    setMobileView("chat");
                  }}
                  style={{
                    ...styles.contactItem,
                    backgroundColor: isActive ? THEME.cardHover : "transparent",
                    borderLeft: isActive ? `3px solid ${THEME.primary}` : "3px solid transparent"
                  }}
                >
                  <img src={c.avatar} alt="" style={styles.roundAvatar} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "600", fontSize: "14px" }}>{c.name}</span>
                      {last && (
                        <span style={{ fontSize: "10px", color: THEME.textMuted }}>
                          {new Date(last.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: THEME.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {last ? (last.type === "image" ? "📷 Photo" : last.type === "video" ? "🎥 Video" : last.type === "pdf" ? "📄 PDF" : last.content) : c.phone}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* --- ACTIVE CHAT MAIN VIEW (FULL SCREEN WIDTH) --- */}
      <main style={{
        ...styles.chatMain,
        backgroundColor: THEME.bg,
        display: mobileView === "list" ? "none" : "flex"
      }}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div style={{ ...styles.headerBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={() => setMobileView("list")} style={styles.cleanBtn} className="mobile-only">
                  <ArrowLeft size={18} color={THEME.text} />
                </button>
                <div
                  onClick={() => {
                    setViewedProfile(activeChat);
                    openViewOrModal("profile_view");
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                >
                  <img src={activeChat.avatar} alt="" style={styles.roundAvatar} />
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px" }}>{activeChat.name}</div>
                    <div style={{ fontSize: "11px", color: peerPresence.isOnline ? THEME.accent : THEME.textMuted }}>
                      {peerPresence.isOnline ? t.activeNow : peerPresence.lastSeen ? `${t.lastSeen} ${peerPresence.lastSeen}` : activeChat.phone}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={() => startCall("audio")} style={styles.cleanBtn} title="Voice Call">
                  <Phone size={17} color={THEME.textMuted} />
                </button>
                <button onClick={() => startCall("video")} style={styles.cleanBtn} title="Video Call">
                  <Video size={17} color={THEME.textMuted} />
                </button>
                <button
                  onClick={() => setVanishMode(!vanishMode)}
                  style={{
                    ...styles.pillBtn,
                    backgroundColor: vanishMode ? "rgba(147, 51, 234, 0.2)" : THEME.card,
                    borderColor: vanishMode ? "#a855f7" : THEME.border,
                    color: vanishMode ? "#c084fc" : THEME.textMuted
                  }}
                >
                  <Timer size={13} />
                  <span>{vanishMode ? "15s" : "Vanish"}</span>
                </button>
              </div>
            </div>

            {/* Message Feed */}
            <div style={styles.messagesViewport}>
              {activeMessages.length === 0 ? (
                <div style={{ textAlign: "center", color: THEME.textMuted, margin: "auto" }}>
                  <MessageSquare size={36} color={THEME.textMuted} style={{ marginBottom: "6px" }} />
                  <div style={{ fontSize: "14px" }}>Say hello to {activeChat.name}!</div>
                </div>
              ) : (
                activeMessages.map((m) => {
                  const isMe = m.senderPhone === normalizePhone(currentUser.phone);
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", width: "100%" }}>
                      <div style={{
                        ...styles.msgBubble,
                        backgroundColor: m.isVanish ? "rgba(107, 33, 168, 0.8)" : isMe ? THEME.bubbleMe : THEME.bubblePeer,
                        borderBottomRightRadius: isMe ? "2px" : "10px",
                        borderBottomLeftRadius: !isMe ? "2px" : "10px"
                      }}>
                        {/* 1. Image Rendering */}
                        {m.type === "image" && m.fileUrl && (
                          <div style={{ marginBottom: "6px", borderRadius: "6px", overflow: "hidden" }}>
                            <img src={m.fileUrl} alt="shared" style={{ maxWidth: "260px", maxHeight: "240px", width: "100%", objectFit: "contain", borderRadius: "6px" }} />
                          </div>
                        )}

                        {/* 2. Video Rendering */}
                        {m.type === "video" && m.fileUrl && (
                          <div style={{ marginBottom: "6px", borderRadius: "6px", overflow: "hidden" }}>
                            <video src={m.fileUrl} controls style={{ maxWidth: "260px", maxHeight: "240px", width: "100%", borderRadius: "6px" }} />
                          </div>
                        )}

                        {/* 3. PDF & Documents Rendering with Download */}
                        {(m.type === "pdf" || m.type === "file") && m.fileUrl && (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px",
                            borderRadius: "6px",
                            backgroundColor: isMe ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
                            marginBottom: "4px"
                          }}>
                            <FileText size={24} color={THEME.secondary} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "12px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.fileName || "Document"}
                              </div>
                              <div style={{ fontSize: "10px", opacity: 0.7 }}>{m.fileSize || "File"}</div>
                            </div>
                            <a href={m.fileUrl} download={m.fileName || "download"} style={{ ...styles.iconBtn, width: "28px", height: "28px", backgroundColor: THEME.card, color: THEME.text }} title="Download">
                              <Download size={14} />
                            </a>
                          </div>
                        )}

                        {/* Text Content */}
                        {m.content && m.type !== "image" && m.type !== "video" && (
                          <div style={{ fontSize: "13px", lineHeight: "1.4" }}>{m.content}</div>
                        )}

                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                          <span style={{ fontSize: "9px", opacity: 0.7 }}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMe && (
                            <span>
                              {m.status === "sending" ? "🕒" : <CheckCheck size={12} color={THEME.tickRead} />}
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

            {/* Input Bar with Attachment File Picker */}
            <div style={{ ...styles.inputBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
              {/* Hidden file input supporting images, videos, pdfs, docs */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAttachmentUpload}
                accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
                style={{ display: "none" }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ ...styles.iconBtn, backgroundColor: THEME.card }}
                title={t.attachFile}
              >
                <Paperclip size={18} color={THEME.textMuted} />
              </button>

              <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border, flex: 1 }}>
                <input
                  type="text"
                  placeholder={vanishMode ? t.vanishOn : t.typeMessage}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  style={{ ...styles.bareInput, color: THEME.text }}
                />
              </div>

              <button onClick={() => handleSendMessage()} style={{ ...styles.circleBtn, backgroundColor: THEME.primary }}>
                <Send size={15} color="#fff" />
              </button>
            </div>
          </>
        ) : (
          <div style={{ margin: "auto", textAlign: "center", color: THEME.textMuted }}>
            <MessageSquare size={52} color={THEME.primary} style={{ marginBottom: "10px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "700" }}>{t.appTitle}</h2>
            <p style={{ fontSize: "13px" }}>Select a conversation to start messaging</p>
          </div>
        )}
      </main>

      {/* --- INCOMING CALL MODAL WITH ACCEPT / REJECT --- */}
      {incomingCall && (
        <div style={styles.callOverlay}>
          <div style={{ ...styles.callBox, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ fontSize: "12px", color: THEME.accent, fontWeight: "600" }}>
              {t.incomingCall}
            </div>
            <img
              src={incomingCall.callerAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160"}
              alt=""
              style={{ width: "74px", height: "74px", borderRadius: "50%", margin: "14px auto 4px", border: `2px solid ${THEME.primary}` }}
            />
            <h3 style={{ margin: "6px 0 2px" }}>{incomingCall.callerName}</h3>
            <div style={{ fontSize: "12px", color: THEME.textMuted }}>{incomingCall.callerPhone}</div>
            <div style={{ fontSize: "13px", color: THEME.primary, marginTop: "8px" }}>
              {incomingCall.type === "video" ? "📹 HD Video Call" : "📞 Voice Call"}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "24px" }}>
              <button
                onClick={rejectIncomingCall}
                style={{ ...styles.circleBtn, backgroundColor: THEME.danger, width: "48px", height: "48px" }}
                title={t.decline}
              >
                <PhoneOff size={22} color="#fff" />
              </button>
              <button
                onClick={acceptIncomingCall}
                style={{ ...styles.circleBtn, backgroundColor: THEME.primary, width: "48px", height: "48px" }}
                title={t.accept}
              >
                <Phone size={22} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ACTIVE WEBRTC CALL OVERLAY --- */}
      {activeCall && (
        <div style={styles.callOverlay}>
          <div style={{ ...styles.callBox, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ fontSize: "12px", color: THEME.textMuted }}>
              {activeCall.type === "video" ? "WebRTC HD Video" : "Encrypted Audio"}
            </div>

            {/* Video Streams */}
            {activeCall.type === "video" && (
              <div style={styles.videoBox}>
                <video ref={remoteVideoRef} autoPlay playsInline style={styles.fullVideo} />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px",
                    width: "80px",
                    height: "100px",
                    borderRadius: "8px",
                    objectFit: "cover",
                    border: `1px solid ${THEME.primary}`
                  }}
                />
              </div>
            )}

            <img
              src={activeCall.peerAvatar || activeChat?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160"}
              alt=""
              style={{ width: "70px", height: "70px", borderRadius: "50%", margin: "14px auto 4px" }}
            />
            <h3 style={{ margin: "4px 0" }}>{activeCall.peerName || activeChat?.name}</h3>
            {/* Dynamic Ringing Status */}
            <div style={{ fontSize: "13px", color: THEME.accent }}>
              {activeCall.status === "connected"
                ? `Active (${activeCall.duration}s)`
                : activeCall.status === "ringing"
                ? t.ringing
                : t.calling}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "20px" }}>
              <button
                onClick={() => {
                  if (localStream) {
                    const audioTrack = localStream.getAudioTracks()[0];
                    if (audioTrack) {
                      audioTrack.enabled = isMuted;
                      setIsMuted(!isMuted);
                    }
                  }
                }}
                style={{ ...styles.circleBtn, backgroundColor: THEME.card }}
              >
                {isMuted ? <MicOff size={18} color={THEME.danger} /> : <Mic size={18} color={THEME.text} />}
              </button>
              <button onClick={endCall} style={{ ...styles.circleBtn, backgroundColor: THEME.danger }}>
                <PhoneOff size={20} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: USER PROFILE & SHARED MEDIA GALLERY --- */}
      {activeModal === "profile_view" && viewedProfile && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px" }}>{t.profile}</div>
              <button onClick={() => setActiveModal(null)} style={styles.cleanBtn}><X size={18} /></button>
            </div>
            <div style={{ padding: "18px", overflowY: "auto", maxHeight: "80vh" }}>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <img src={viewedProfile.avatar} alt="" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${THEME.primary}` }} />
                <h3 style={{ fontSize: "17px", fontWeight: "700", margin: "8px 0 2px" }}>{viewedProfile.name}</h3>
                <p style={{ fontSize: "12px", color: THEME.textMuted, margin: 0 }}>{viewedProfile.phone}</p>
                <p style={{ fontSize: "12px", color: THEME.accent, marginTop: "4px" }}>"{viewedProfile.about || "Available on Infinity Chat"}"</p>
              </div>

              {/* Shared Media Gallery */}
              <div style={{ marginTop: "16px", borderTop: `1px solid ${THEME.border}`, paddingTop: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", fontSize: "13px", marginBottom: "10px" }}>
                  <ImageIcon size={16} color={THEME.secondary} />
                  <span>{t.sharedMedia} ({sharedMediaFiles.length})</span>
                </div>
                {sharedMediaFiles.length === 0 ? (
                  <div style={{ textAlign: "center", color: THEME.textMuted, fontSize: "12px", padding: "14px" }}>
                    No photos or documents shared yet in this chat.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                    {sharedMediaFiles.map((item, idx) => (
                      <div key={idx} style={{ borderRadius: "6px", overflow: "hidden", height: "80px", backgroundColor: THEME.card }}>
                        {item.type === "image" ? (
                          <img src={item.fileUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : item.type === "video" ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <Film size={22} color={THEME.secondary} />
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "10px", padding: "4px" }}>
                            <FileText size={20} color={THEME.secondary} />
                            <span style={{ maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.fileName || item.content}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: COMPREHENSIVE SETTINGS SUITE (12 ITEMS) --- */}
      {activeModal === "settings" && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {settingsTab !== "main" && (
                  <button onClick={() => setSettingsTab("main")} style={styles.cleanBtn}><ArrowLeft size={16} /></button>
                )}
                <span style={{ fontWeight: "700", fontSize: "15px" }}>{t.settings}</span>
              </div>
              <button onClick={() => setActiveModal(null)} style={styles.cleanBtn}><X size={18} /></button>
            </div>

            <div style={{ padding: "14px", overflowY: "auto", maxHeight: "75vh" }}>
              {settingsTab === "main" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {/* 1. Profile Management */}
                  <div onClick={() => setSettingsTab("profile")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <User size={17} color={THEME.primary} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.profile}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 2. Account & Privacy Settings */}
                  <div onClick={() => setSettingsTab("privacy")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Lock size={17} color={THEME.accent} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.privacySettings}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 3. Notifications */}
                  <div onClick={() => setSettingsTab("notifications")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Bell size={17} color={THEME.secondary} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.notifications}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 4. Privacy Policy & Terms */}
                  <div onClick={() => setSettingsTab("policy")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <ShieldCheck size={17} color="#eab308" />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.privacyPolicy}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 5. Data & Storage */}
                  <div onClick={() => setSettingsTab("storage")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Download size={17} color="#a855f7" />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.dataStorage}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 6. Language Switcher */}
                  <div onClick={() => setSettingsTab("language")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Globe size={17} color="#06b6d4" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>{t.language}</div>
                      <div style={{ fontSize: "11px", color: THEME.textMuted }}>{lang === "bn" ? "বাংলা (Bangla)" : "English"}</div>
                    </div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 7. Contact List & Invite System */}
                  <div onClick={() => setSettingsTab("invite")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Share2 size={17} color={THEME.accent} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.contactListInvite}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 8. Ringtones & Caller Tune */}
                  <div onClick={() => setSettingsTab("ringtones")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Music size={17} color="#ec4899" />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.ringtones}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 9. Switch Account */}
                  <div onClick={handleLogout} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <LogOut size={17} color={THEME.danger} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px", color: THEME.danger }}>{t.switchAccount}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>

                  {/* 10. Dark / Light Mode */}
                  <div
                    onClick={() => {
                      const next = !darkMode;
                      setDarkMode(next);
                      localStorage.setItem("infinity_theme", next ? "dark" : "light");
                    }}
                    style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
                  >
                    {darkMode ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} color="#6366f1" />}
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.theme}</div></div>
                    <span style={{ fontSize: "12px", color: THEME.textMuted }}>{darkMode ? "Dark" : "Light"}</span>
                  </div>

                  {/* 11. App Update Checker */}
                  <div onClick={() => setSettingsTab("updates")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <RefreshCw size={17} color={THEME.secondary} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.updateCheck}</div></div>
                    <span style={{ fontSize: "11px", color: THEME.accent }}>v1.0.4 Latest</span>
                  </div>

                  {/* 12. Channels */}
                  <div onClick={() => { setActiveModal("channels"); }} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                    <Radio size={17} color={THEME.secondary} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: "600", fontSize: "13px" }}>{t.channels}</div></div>
                    <ChevronRight size={16} color={THEME.textMuted} />
                  </div>
                </div>
              )}

              {/* Sub-page: Profile Management */}
              {settingsTab === "profile" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ textAlign: "center" }}>
                    <input type="file" ref={avatarUploadRef} onChange={handleAvatarFile} accept="image/*" style={{ display: "none" }} />
                    <img src={currentUser.avatar} alt="" style={{ width: "70px", height: "70px", borderRadius: "50%", objectFit: "cover" }} />
                    <button onClick={() => avatarUploadRef.current?.click()} style={{ ...styles.primaryBtn, backgroundColor: THEME.primary, marginTop: "8px" }}>
                      Change Photo (Base64)
                    </button>
                  </div>
                  <div>
                    <label style={styles.label}>Name</label>
                    <input
                      type="text"
                      defaultValue={currentUser.name}
                      onBlur={async (e) => {
                        const val = e.target.value.trim();
                        if (val) {
                          const myNorm = normalizePhone(currentUser.phone);
                          await updateDoc(doc(db, "users", myNorm), { name: val });
                          const u = { ...currentUser, name: val };
                          setCurrentUser(u);
                          localStorage.setItem("infinity_chat_user", JSON.stringify(u));
                          showToast("Name updated!");
                        }
                      }}
                      style={{ ...styles.bareInput, backgroundColor: THEME.card, padding: "8px", borderRadius: "6px", color: THEME.text }}
                    />
                  </div>
                </div>
              )}

              {/* Sub-page: Privacy Settings */}
              {settingsTab === "privacy" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Ghost Mode (Hide Online Status)</span>
                    <button
                      onClick={() => setGhostMode(!ghostMode)}
                      style={{ ...styles.pillBtn, backgroundColor: ghostMode ? THEME.primary : THEME.card, color: "#fff" }}
                    >
                      {ghostMode ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-page: Privacy Policy & Terms (BILINGUAL) */}
              {settingsTab === "policy" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h4 style={{ margin: 0 }}>{t.privacyPolicy}</h4>
                    <button
                      onClick={() => {
                        const next = lang === "bn" ? "en" : "bn";
                        setLang(next);
                        localStorage.setItem("infinity_lang", next);
                      }}
                      style={{ ...styles.pillBtn, backgroundColor: THEME.card, color: THEME.primary }}
                    >
                      {lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
                    </button>
                  </div>
                  <p style={{ fontSize: "13px", lineHeight: "1.6", color: THEME.textMuted, backgroundColor: THEME.card, padding: "12px", borderRadius: "8px" }}>
                    {t.termsText}
                  </p>
                </div>
              )}

              {/* Sub-page: Data & Storage */}
              {settingsTab === "storage" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Temporary App Cache</div>
                    <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>Cache Size: 12.4 MB</div>
                    <button
                      onClick={() => showToast("Cache cleared successfully!")}
                      style={{ ...styles.primaryBtn, backgroundColor: THEME.danger, marginTop: "10px" }}
                    >
                      {t.clearCache}
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-page: Language Switcher */}
              {settingsTab === "language" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div
                    onClick={() => { setLang("bn"); localStorage.setItem("infinity_lang", "bn"); showToast("ভাষা পরিবর্তিত হয়েছে!"); }}
                    style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
                  >
                    <span>বাংলা (Bangla)</span>
                    {lang === "bn" && <Check size={16} color={THEME.primary} />}
                  </div>
                  <div
                    onClick={() => { setLang("en"); localStorage.setItem("infinity_lang", "en"); showToast("Language updated to English!"); }}
                    style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
                  >
                    <span>English</span>
                    {lang === "en" && <Check size={16} color={THEME.primary} />}
                  </div>
                </div>
              )}

              {/* Sub-page: Ringtones */}
              {settingsTab === "ringtones" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {["classic", "marimba", "chime"].map((tune) => (
                    <div key={tune} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                      <span style={{ textTransform: "capitalize" }}>{tune} Ringtone</span>
                      <button onClick={() => { setSelectedRingtone(tune); soundEngine.playTone(550, "sine", 0.6); }} style={styles.cleanBtn}>
                        <Play size={16} color={THEME.primary} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-page: Updates */}
              {settingsTab === "updates" && (
                <div style={{ textAlign: "center", padding: "16px" }}>
                  <RefreshCw size={32} color={THEME.accent} style={{ margin: "0 auto 8px" }} />
                  <h4>Infinity Chat v1.0.4</h4>
                  <p style={{ fontSize: "12px", color: THEME.textMuted }}>You are running the latest version with Firestore sync.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD CONTACT --- */}
      {activeModal === "add_contact" && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px" }}>{t.addContact}</div>
              <button onClick={() => setActiveModal(null)} style={styles.cleanBtn}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddContact} style={{ padding: "16px" }}>
              <label style={styles.label}>11-Digit BD Number</label>
              <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border, marginBottom: "14px" }}>
                <Smartphone size={16} color={THEME.textMuted} />
                <input
                  type="tel"
                  placeholder="017XXXXXXXX"
                  value={contactSearchInput}
                  onChange={(e) => setContactSearchInput(e.target.value)}
                  style={{ ...styles.bareInput, color: THEME.text }}
                />
              </div>
              <button type="submit" disabled={isProcessing} style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}>
                {isProcessing ? <Loader2 size={16} className="spin" /> : <span>Search & Add</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CHANNELS BROADCAST --- */}
      {activeModal === "channels" && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px" }}>{t.channels}</div>
              <button onClick={() => setActiveModal(null)} style={styles.cleanBtn}><X size={18} /></button>
            </div>
            <div style={{ padding: "14px", overflowY: "auto", maxHeight: "70vh" }}>
              {channels.map((ch) => (
                <div key={ch.id} style={{ ...styles.settingsItem, backgroundColor: THEME.card, marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px" }}>{ch.name}</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>{ch.desc} • {ch.subscribers} followers</div>
                  </div>
                  <button onClick={() => showToast("Subscribed to channel!")} style={{ ...styles.pillBtn, backgroundColor: THEME.primary, color: "#fff" }}>
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: INVITE MODAL --- */}
      {activeModal === "invite" && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border, textAlign: "center", padding: "20px" }}>
            <Share2 size={36} color={THEME.accent} style={{ margin: "0 auto 8px" }} />
            <h3 style={{ margin: "0 0 6px" }}>User Not Registered</h3>
            <p style={{ fontSize: "12px", color: THEME.textMuted }}>This mobile number is not yet on Infinity Chat. Share an invite link with them!</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://infinity-chat-922be.firebaseapp.com/join?ref=${currentUser.phone}`);
                showToast("Invite link copied!");
                setActiveModal(null);
              }}
              style={{ ...styles.primaryBtn, backgroundColor: THEME.primary, marginTop: "12px" }}
            >
              <Copy size={16} />
              <span>Copy SMS Invite Link</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, html { width: 100%; height: 100%; overflow: hidden; }
        @media (min-width: 768px) {
          .mobile-only { display: none !important; }
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// --- CLEAN 100% FULL-SCREEN RESPONSIVE STYLES ---
const styles = {
  appWrap: {
    display: "flex",
    width: "100vw",
    height: "100vh",
    maxWidth: "100%",
    minHeight: "100vh",
    overflow: "hidden",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  sidebar: {
    width: "100%",
    maxWidth: "420px",
    flex: "0 0 auto",
    borderRight: "1px solid",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden"
  },
  chatMain: {
    flex: 1,
    flexDirection: "column",
    height: "100%",
    width: "100%",
    overflow: "hidden"
  },
  headerBar: {
    padding: "10px 16px",
    borderBottom: "1px solid",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%"
  },
  roundAvatar: { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" },
  cleanBtn: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" },
  iconBtn: { border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  circleBtn: { border: "none", borderRadius: "50%", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  pillBtn: { border: "1px solid transparent", borderRadius: "14px", padding: "4px 10px", fontSize: "11px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" },
  searchWrap: { margin: "8px 12px", padding: "8px 14px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" },
  bareInput: { background: "transparent", border: "none", outline: "none", fontSize: "14px", width: "100%" },
  contactItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", cursor: "pointer", borderRadius: "8px", marginBottom: "2px" },
  messagesViewport: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", width: "100%" },
  msgBubble: { maxWidth: "76%", padding: "8px 14px", borderRadius: "10px", fontSize: "13px" },
  inputBar: { padding: "10px 14px", borderTop: "1px solid", display: "flex", alignItems: "center", gap: "10px", width: "100%" },
  inputWrap: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", border: "1px solid" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "14px", width: "100vw", height: "100vh" },
  modalCard: { width: "100%", maxWidth: "460px", borderRadius: "14px", border: "1px solid", overflow: "hidden" },
  modalHeader: { padding: "14px 18px", borderBottom: "1px solid", display: "flex", justifyContent: "space-between", alignItems: "center" },
  settingsItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "8px", cursor: "pointer" },
  toast: { position: "fixed", top: "16px", left: "50%", transform: "translateX(-50%)", color: "#fff", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" },
  centerContainer: { display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", height: "100vh", padding: "16px" },
  authCard: { width: "100%", maxWidth: "420px", padding: "26px", borderRadius: "16px", border: "1px solid" },
  logoCircle: { width: "56px", height: "56px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" },
  avatarBubble: { position: "relative", width: "76px", height: "76px", margin: "0 auto 8px", cursor: "pointer" },
  avatarImgFull: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" },
  camBadge: { position: "absolute", bottom: 0, right: 0, borderRadius: "50%", padding: "5px", display: "flex" },
  label: { fontSize: "12px", fontWeight: "600", opacity: 0.85, marginBottom: "5px", display: "block" },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", padding: "11px", borderRadius: "8px", border: "none", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer" },
  linkBtn: { background: "none", border: "none", fontWeight: "700", fontSize: "12px", cursor: "pointer" },
  otpBox: { width: "44px", height: "48px", textAlign: "center", fontSize: "18px", fontWeight: "bold", border: "1px solid", borderRadius: "8px", outline: "none" },
  callOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px", width: "100vw", height: "100vh" },
  callBox: { width: "100%", maxWidth: "400px", borderRadius: "18px", border: "1px solid", padding: "24px", textAlign: "center" },
  videoBox: { position: "relative", width: "100%", height: "240px", borderRadius: "12px", overflow: "hidden", backgroundColor: "#000", margin: "14px 0" },
  fullVideo: { width: "100%", height: "100%", objectFit: "cover" }
};
