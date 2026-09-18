import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// --- FIREBASE CONFIGURATION ---
export const firebaseConfig = {
  apiKey: "AIzaSyDyyRhtdPpm_a9dCSW1cvlIQOUdi2vOgxY",
  authDomain: "infinity-chat-922be.firebaseapp.com",
  projectId: "infinity-chat-922be",
  storageBucket: "infinity-chat-922be.firebasestorage.app",
  messagingSenderId: "547476197740",
  appId: "1:547476197740:web:e56e8f114def584f6be349",
  measurementId: "G-8DWN7RFZ3E"
};

// Initialize or retrieve Firebase instances
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable Firestore offline persistence via IndexedDB
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Multiple tabs open, persistence enabled in first tab only.");
    } else if (err.code === "unimplemented") {
      console.warn("Current browser environment does not support IndexedDB offline persistence.");
    }
  });
}

// Google STUN configuration for WebRTC voice & video calling
export const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

// --- BANGLADESHI PHONE NUMBER HELPERS ---
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

export function getRoomId(p1, p2) {
  return [p1, p2].sort().join("_");
}

// --- RINGTONE SYNTHESIZER ---
export class SoundEngine {
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
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();

// --- BILINGUAL TRANSLATIONS ---
export const TRANSLATIONS = {
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

// --- THEME DEFINITIONS ---
export function getTheme(darkMode) {
  if (!darkMode) {
    return {
      bg: "#f0f2f5",
      sidebar: "#ffffff",
      header: "#f0f2f5",
      card: "#ffffff",
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
}

// --- SHARED STYLES ---
export const styles = {
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
