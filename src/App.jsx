import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  MessageSquare,
  Radio,
  Share2,
  Download,
  Settings as SettingsIcon,
  Plus,
  Search,
  Users,
  X,
  Send,
  Pin,
  BellOff,
  ShieldCheck,
  RotateCcw,
  Phone,
  ArrowRight
} from "lucide-react";

// Modular Imports
import {
  auth,
  db,
  RTC_CONFIG,
  normalizePhone,
  isValidBDPhone,
  getRoomId,
  soundEngine,
  TRANSLATIONS,
  getTheme,
  styles
} from "./firebase";
import Feed from "./components/Feed";
import Channels from "./components/Channels";
import ChatView from "./components/ChatView";
import CallModal from "./components/CallModal";
import Settings from "./components/Settings";
import OtpInput from "./components/OtpInput";

export default function App() {
  // --- USER AUTH & PERSISTENCE ---
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem("infinity_chat_user");
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  });

  // Auth Form State
  const [authStep, setAuthStep] = useState("login"); // "login" | "otp"
  const [phoneInput, setPhoneInput] = useState("");
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-login prompt for Google users without a phone number
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [promptPhoneInput, setPromptPhoneInput] = useState("");

  const recaptchaVerifierRef = useRef(null);

  // Settings & Theme Preferences
  const [lang, setLang] = useState(() => localStorage.getItem("infinity_lang") || "bn");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("infinity_theme") !== "light");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem("infinity_notif") !== "false");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("infinity_sound") !== "false");
  const [ghostMode, setGhostMode] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState("classic");

  const THEME = useMemo(() => getTheme(darkMode), [darkMode]);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Navigation & Modals
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [mainTab, setMainTab] = useState("chats"); // "chats" | "feed" | "channels"
  const [activeModal, setActiveModal] = useState(null); // null | "settings" | "profile_view" | "add_contact"
  const [viewedProfile, setViewedProfile] = useState(null);

  // Active Chats, Channels & Feed Data
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelPosts, setChannelPosts] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [peerPresence, setPeerPresence] = useState({ isOnline: false, lastSeen: "" });
  const [messagesMap, setMessagesMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [vanishMode, setVanishMode] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Pinned & Muted Chats
  const [pinnedChats, setPinnedChats] = useState(() => {
    try {
      const p = localStorage.getItem("infinity_pinned_chats");
      return p ? JSON.parse(p) : [];
    } catch (e) { return []; }
  });
  const [mutedChats, setMutedChats] = useState(() => {
    try {
      const m = localStorage.getItem("infinity_muted_chats");
      return m ? JSON.parse(m) : [];
    } catch (e) { return []; }
  });

  // Forwarding & Lightbox
  const [forwardModalMsg, setForwardModalMsg] = useState(null);
  const [selectedForwardTargets, setSelectedForwardTargets] = useState([]);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [contactSearchInput, setContactSearchInput] = useState("");

  // WebRTC Call State
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("Calling...");
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callDurationTimerRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // --- ANDROID BACK BUTTON HARDWARE BEHAVIOR ---
  useEffect(() => {
    window.history.pushState({ page: "root" }, "");
    const handlePopState = () => {
      if (incomingCall) {
        rejectIncomingCall();
        window.history.pushState({ page: "root" }, "");
      } else if (activeCall) {
        endCall();
        window.history.pushState({ page: "root" }, "");
      } else if (lightboxMedia) {
        setLightboxMedia(null);
        window.history.pushState({ page: "root" }, "");
      } else if (forwardModalMsg) {
        setForwardModalMsg(null);
        window.history.pushState({ page: "root" }, "");
      } else if (activeModal) {
        setActiveModal(null);
        window.history.pushState({ page: "root" }, "");
      } else if (mobileView === "chat") {
        setMobileView("list");
        setActiveChat(null);
        setActiveChannel(null);
        window.history.pushState({ page: "root" }, "");
      } else {
        window.history.pushState({ page: "root" }, "");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [incomingCall, activeCall, lightboxMedia, forwardModalMsg, activeModal, mobileView]);

  // Check if logged-in user needs a phone number setup
  useEffect(() => {
    if (currentUser && !currentUser.phone) {
      setShowPhonePrompt(true);
    }
  }, [currentUser]);

  // --- RECAPTCHA INITIALIZER ---
  const initRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const container = document.getElementById("recaptcha-container");
    if (!container) return null;

    try {
      const verifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => {},
          "expired-callback": () => {
            showToast("Recaptcha expired. Please try sending OTP again.");
          }
        }
      );
      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (err) {
      console.error("Recaptcha init failed:", err);
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {}
      }
    };
  }, []);

  // --- 1. 1-CLICK GOOGLE SIGN-IN ---
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const gUser = result.user;

      const userDocRef = doc(db, "users", gUser.uid);
      const snap = await getDoc(userDocRef);

      let fullUser;
      if (snap.exists()) {
        fullUser = { ...snap.data(), id: gUser.uid, uid: gUser.uid };
      } else {
        fullUser = {
          id: gUser.uid,
          uid: gUser.uid,
          name: gUser.displayName || "Infinity User",
          email: gUser.email,
          phone: "",
          avatar: gUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
          isOnline: true,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, fullUser, { merge: true });
      }

      setCurrentUser(fullUser);
      localStorage.setItem("infinity_chat_user", JSON.stringify(fullUser));
      showToast(`Welcome, ${fullUser.name}!`);

      if (!fullUser.phone) {
        setShowPhonePrompt(true);
      }
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        showToast("Google Login failed: " + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 2. PHONE SMS OTP: SEND CODE ---
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const clean = normalizePhone(phoneInput);
    if (!isValidBDPhone(clean)) {
      showToast("Please enter a valid 11-digit Bangladeshi mobile number (013-019)");
      return;
    }

    setIsSubmitting(true);
    try {
      const verifier = initRecaptcha();
      if (!verifier) {
        throw new Error("reCAPTCHA element not ready in DOM.");
      }

      const formattedNumber = `+88${clean}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, verifier);
      setConfirmationResult(confirmation);
      setAuthStep("otp");
      showToast(`6-Digit OTP sent via SMS to ${formattedNumber}`);
    } catch (err) {
      console.error("SMS OTP error:", err);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (e) {}
      }
      showToast("Failed to send OTP: " + (err.message || "Request rejected."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 2. PHONE SMS OTP: VERIFY CODE ---
  const handleVerifyOtp = async (enteredOtp) => {
    const code = enteredOtp || otpArray.join("");
    if (code.length !== 6) {
      showToast("Please enter the complete 6-digit OTP code");
      return;
    }

    if (!confirmationResult) {
      showToast("Verification session expired. Please send OTP again.");
      setAuthStep("login");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await confirmationResult.confirm(code);
      const fbUser = res.user;
      const clean = normalizePhone(phoneInput);

      const userDocRef = doc(db, "users", fbUser.uid);
      const snap = await getDoc(userDocRef);

      let fullUser;
      if (snap.exists()) {
        fullUser = { ...snap.data(), id: fbUser.uid, uid: fbUser.uid, phone: clean };
      } else {
        fullUser = {
          id: fbUser.uid,
          uid: fbUser.uid,
          name: `User ${clean.slice(-4)}`,
          phone: clean,
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
          isOnline: true,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, fullUser, { merge: true });
      }

      // Also index by phone for fast contact lookups
      await setDoc(doc(db, "users", clean), fullUser, { merge: true });

      setCurrentUser(fullUser);
      localStorage.setItem("infinity_chat_user", JSON.stringify(fullUser));
      showToast(`Verified! Welcome, ${fullUser.name}`);
    } catch (err) {
      console.error("OTP confirmation error:", err);
      showToast("Invalid or expired verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save prompt phone number to Firestore
  const handleSavePromptPhone = async (e) => {
    e?.preventDefault();
    const clean = normalizePhone(promptPhoneInput);
    if (!isValidBDPhone(clean)) {
      showToast("Please enter a valid 11-digit BD number (013-019)");
      return;
    }

    try {
      const updatedUser = { ...currentUser, phone: clean };
      await setDoc(doc(db, "users", currentUser.uid || currentUser.id), { phone: clean }, { merge: true });
      await setDoc(doc(db, "users", clean), updatedUser, { merge: true });

      setCurrentUser(updatedUser);
      localStorage.setItem("infinity_chat_user", JSON.stringify(updatedUser));
      setShowPhonePrompt(false);
      showToast("Phone number linked successfully!");
    } catch (err) {
      showToast("Failed to link phone: " + err.message);
    }
  };

  // --- LOGOUT ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    localStorage.removeItem("infinity_chat_user");
    setCurrentUser(null);
    setAuthStep("login");
    setPhoneInput("");
    setOtpArray(["", "", "", "", "", ""]);
    setConfirmationResult(null);
    setActiveChat(null);
    setActiveChannel(null);
    setActiveModal(null);
    showToast("Logged out successfully");
  };

  // --- FIRESTORE USER PRESENCE & HEARTBEAT ---
  useEffect(() => {
    if (!currentUser?.id && !currentUser?.phone) return;
    if (ghostMode) return;

    const userKey = currentUser.phone ? normalizePhone(currentUser.phone) : currentUser.uid || currentUser.id;
    const userDocRef = doc(db, "users", userKey);

    setDoc(userDocRef, { isOnline: true, lastSeen: new Date().toISOString() }, { merge: true }).catch(() => {});

    const interval = setInterval(() => {
      setDoc(userDocRef, { isOnline: true, lastSeen: new Date().toISOString() }, { merge: true }).catch(() => {});
    }, 45000);

    const handleUnload = () => {
      setDoc(userDocRef, { isOnline: false, lastSeen: new Date().toISOString() }, { merge: true }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      setDoc(userDocRef, { isOnline: false, lastSeen: new Date().toISOString() }, { merge: true }).catch(() => {});
    };
  }, [currentUser, ghostMode]);

  // --- FIRESTORE CONTACTS REAL-TIME LISTENER ---
  useEffect(() => {
    if (!currentUser) return;
    const myId = currentUser.uid || currentUser.id;
    const myPhone = currentUser.phone ? normalizePhone(currentUser.phone) : "";
    const usersCol = collection(db, "users");

    const unsub = onSnapshot(usersCol, (snap) => {
      const list = [];
      const seen = new Set();
      snap.forEach((d) => {
        const data = d.data();
        const contactId = data.phone || data.uid || d.id;
        if (contactId && contactId !== myPhone && contactId !== myId && !seen.has(contactId)) {
          seen.add(contactId);
          list.push({
            id: contactId,
            name: data.name || contactId,
            phone: data.phone || "",
            avatar: data.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
            isOnline: !!data.isOnline,
            lastSeen: data.lastSeen ? new Date(data.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""
          });
        }
      });
      setContacts(list);
    });

    return () => unsub();
  }, [currentUser]);

  // --- FIRESTORE ACTIVE CHAT MESSAGES REAL-TIME LISTENER (<10ms) ---
  useEffect(() => {
    if (!currentUser || !activeChat?.id) return;
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const peerIdent = activeChat.phone || activeChat.id;
    const roomId = getRoomId(myIdent, peerIdent);
    const messagesCol = collection(db, "rooms", roomId, "messages");
    const q = query(messagesCol, orderBy("createdAt", "asc"), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = [];
      snap.forEach((d) => {
        const m = { id: d.id, ...d.data() };
        msgs.push(m);

        if (m.senderPhone !== myIdent && m.status !== "read") {
          updateDoc(doc(db, "rooms", roomId, "messages", d.id), { status: "read" }).catch(() => {});
        }
      });
      setMessagesMap((prev) => ({ ...prev, [roomId]: msgs }));
    });

    const peerDocRef = doc(db, "users", peerIdent);
    const unsubPeer = onSnapshot(peerDocRef, (d) => {
      if (d.exists()) {
        const data = d.data();
        setPeerPresence({
          isOnline: !!data.isOnline,
          lastSeen: data.lastSeen ? new Date(data.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""
        });
      }
    });

    return () => {
      unsub();
      unsubPeer();
    };
  }, [currentUser, activeChat?.id]);

  // --- FIRESTORE CHANNELS & SOCIAL FEED ---
  useEffect(() => {
    if (!currentUser) return;
    const channelsCol = collection(db, "channels");
    const unsub = onSnapshot(channelsCol, (snap) => {
      const chs = [];
      snap.forEach((d) => chs.push({ id: d.id, ...d.data() }));
      setChannels(chs);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!activeChannel?.id) return;
    const postsCol = collection(db, "channels", activeChannel.id, "posts");
    const q = query(postsCol, orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const posts = [];
      snap.forEach((d) => posts.push({ id: d.id, ...d.data() }));
      setChannelPosts(posts);
    });
    return () => unsub();
  }, [activeChannel?.id]);

  useEffect(() => {
    if (!currentUser) return;
    const feedCol = collection(db, "channel_posts");
    const q = query(feedCol, orderBy("createdAt", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => {
      const posts = [];
      snap.forEach((d) => posts.push({ id: d.id, ...d.data() }));
      setFeedPosts(posts);
    });
    return () => unsub();
  }, [currentUser]);

  // --- FIRESTORE INCOMING CALLS REAL-TIME LISTENER ---
  useEffect(() => {
    if (!currentUser) return;
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const callsCol = collection(db, "calls");
    const unsub = onSnapshot(callsCol, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const callData = { id: change.doc.id, ...change.doc.data() };
          if (
            callData.recipientPhone === myIdent &&
            callData.status === "ringing" &&
            !activeCall
          ) {
            setIncomingCall(callData);
            if (soundEnabled) soundEngine.startRing(selectedRingtone);
          }
        }
      });
    });
    return () => unsub();
  }, [currentUser, activeCall, soundEnabled, selectedRingtone]);

  // --- ACTIONS: MESSAGING & ATTACHMENTS ---
  const handleSendMessage = async (msgData) => {
    if (!currentUser || !activeChat?.id) return;
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const peerIdent = activeChat.phone || activeChat.id;
    const roomId = getRoomId(myIdent, peerIdent);

    const newMsg = {
      senderPhone: myIdent,
      senderName: currentUser.name,
      recipientPhone: peerIdent,
      content: msgData.content || "",
      type: msgData.type || "text",
      status: "sent",
      isViewOnce: !!msgData.isViewOnce,
      isViewed: false,
      replyTo: msgData.replyTo || null,
      fileUrl: msgData.fileUrl || null,
      fileName: msgData.fileName || null,
      fileSize: msgData.fileSize || null,
      createdAt: new Date().toISOString()
    };

    const msgId = Date.now().toString();
    await setDoc(doc(db, "rooms", roomId, "messages", msgId), newMsg);

    if (vanishMode) {
      setTimeout(async () => {
        await updateDoc(doc(db, "rooms", roomId, "messages", msgId), {
          content: "🔥 This message vanished after 15 seconds.",
          fileUrl: null,
          type: "vanished"
        }).catch(() => {});
      }, 15000);
    }
  };

  const handleSendMedia = async (mediaData) => {
    handleSendMessage(mediaData);
  };

  const handleReactMessage = async (msgId, emoji) => {
    if (!activeChat?.id || !currentUser) return;
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const roomId = getRoomId(myIdent, activeChat.phone || activeChat.id);
    await updateDoc(doc(db, "rooms", roomId, "messages", msgId), {
      [`reactions.${myIdent}`]: emoji
    }).catch(() => {});
  };

  const togglePinChat = (chatId) => {
    const next = pinnedChats.includes(chatId)
      ? pinnedChats.filter((id) => id !== chatId)
      : [...pinnedChats, chatId];
    setPinnedChats(next);
    localStorage.setItem("infinity_pinned_chats", JSON.stringify(next));
    showToast(pinnedChats.includes(chatId) ? "Chat unpinned" : "Chat pinned to top");
  };

  const toggleMuteChat = (chatId) => {
    const next = mutedChats.includes(chatId)
      ? mutedChats.filter((id) => id !== chatId)
      : [...mutedChats, chatId];
    setMutedChats(next);
    localStorage.setItem("infinity_muted_chats", JSON.stringify(next));
    showToast(mutedChats.includes(chatId) ? "Notifications unmuted" : "Chat muted");
  };

  // --- FORWARDING ---
  const handleExecuteForward = async () => {
    if (!forwardModalMsg || selectedForwardTargets.length === 0) return;
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;

    for (const targetId of selectedForwardTargets) {
      if (targetId.startsWith("ch_")) {
        const chId = targetId.replace("ch_", "");
        const targetChannel = channels.find((c) => c.id === chId);
        if (targetChannel) {
          await handleBroadcastPost(
            targetChannel,
            forwardModalMsg.content || "",
            forwardModalMsg.fileUrl ? {
              type: forwardModalMsg.type,
              fileUrl: forwardModalMsg.fileUrl,
              fileName: forwardModalMsg.fileName,
              fileSize: forwardModalMsg.fileSize
            } : null
          );
        }
      } else {
        const roomId = getRoomId(myIdent, targetId);
        const newMsg = {
          senderPhone: myIdent,
          senderName: currentUser.name,
          recipientPhone: targetId,
          content: forwardModalMsg.content || "",
          type: forwardModalMsg.type || "text",
          fileUrl: forwardModalMsg.fileUrl || null,
          fileName: forwardModalMsg.fileName || null,
          fileSize: forwardModalMsg.fileSize || null,
          isForwarded: true,
          status: "sent",
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "rooms", roomId, "messages", Date.now().toString()), newMsg);
      }
    }

    showToast(`Forwarded to ${selectedForwardTargets.length} destination(s)`);
    setForwardModalMsg(null);
    setSelectedForwardTargets([]);
  };

  // --- CHANNELS & SOCIAL FEED ACTIONS ---
  const handleToggleSubscribe = async (ch, e) => {
    e?.stopPropagation();
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const subList = ch.subscribers || [];
    const isSubbed = subList.includes(myIdent);
    const updated = isSubbed ? subList.filter((p) => p !== myIdent) : [...subList, myIdent];

    await updateDoc(doc(db, "channels", ch.id), { subscribers: updated });
    showToast(isSubbed ? `Unsubscribed from ${ch.name}` : `Subscribed to ${ch.name}!`);
  };

  const handleBroadcastPost = async (channel, text, fileData) => {
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const postId = Date.now().toString();
    const postPayload = {
      id: postId,
      channelId: channel.id,
      channelName: channel.name,
      channelAvatar: channel.avatar,
      authorPhone: myIdent,
      authorName: currentUser.name,
      content: text || "",
      type: fileData?.type || "text",
      fileUrl: fileData?.fileUrl || null,
      fileName: fileData?.fileName || null,
      fileSize: fileData?.fileSize || null,
      likes: {},
      reactions: {},
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "channels", channel.id, "posts", postId), postPayload);
    await setDoc(doc(db, "channel_posts", postId), postPayload);
  };

  const handleChannelAdminAction = async (action, payload) => {
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    if (action === "create") {
      const chId = "ch_" + Date.now();
      const newCh = {
        id: chId,
        name: payload.name,
        desc: payload.desc,
        avatar: payload.avatar,
        creatorPhone: myIdent,
        admins: [myIdent],
        subscribers: [myIdent],
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "channels", chId), newCh);
      setActiveChannel(newCh);
    } else if (action === "promote" && activeChannel) {
      const targetIdent = normalizePhone(payload.phone);
      const curAdmins = activeChannel.admins || [];
      if (!curAdmins.includes(targetIdent)) {
        await updateDoc(doc(db, "channels", activeChannel.id), { admins: [...curAdmins, targetIdent] });
      }
    }
  };

  const handleDemoteAdmin = async (channelId, adminPhone) => {
    const targetChannel = channels.find((c) => c.id === channelId);
    if (!targetChannel) return;
    const curAdmins = targetChannel.admins || [];
    const updated = curAdmins.filter((p) => p !== adminPhone);
    await updateDoc(doc(db, "channels", channelId), { admins: updated });
    showToast("Admin removed");
  };

  const handleToggleFeedLike = async (postId) => {
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const postRef = doc(db, "channel_posts", postId);
    const d = await getDoc(postRef);
    if (!d.exists()) return;
    const likes = d.data().likes || {};
    if (likes[myIdent]) {
      delete likes[myIdent];
    } else {
      likes[myIdent] = true;
    }
    await updateDoc(postRef, { likes });
  };

  const handleFeedReaction = async (postId, emoji) => {
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    await updateDoc(doc(db, "channel_posts", postId), {
      [`reactions.${myIdent}`]: emoji
    }).catch(() => {});
  };

  // --- WEBRTC CALL ENGINE ---
  const startCall = async (peer, type = "audio") => {
    const myIdent = currentUser.phone || currentUser.uid || currentUser.id;
    const peerIdent = peer.phone || peer.id;
    const callId = `call_${Date.now()}`;

    setActiveCall({
      id: callId,
      peerPhone: peerIdent,
      peerName: peer.name,
      peerAvatar: peer.avatar,
      type
    });
    setCallStatus("Calling...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video"
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callDocRef = doc(db, "calls", callId);
      await setDoc(callDocRef, {
        callerPhone: myIdent,
        callerName: currentUser.name,
        callerAvatar: currentUser.avatar,
        recipientPhone: peerIdent,
        recipientName: peer.name,
        callType: type,
        status: "ringing",
        offer: { sdp: offer.sdp, type: offer.type },
        createdAt: new Date().toISOString()
      });

      const unsub = onSnapshot(callDocRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === "answered" && data.answer && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallStatus("Connected");
          startCallTimer();
        } else if (data.status === "rejected" || data.status === "ended") {
          endCall();
          unsub();
        }
      });
    } catch (err) {
      showToast("Unable to start call: " + err.message);
      endCall();
    }
  };

  const acceptIncomingCall = async () => {
    soundEngine.stopRing();
    if (!incomingCall) return;
    const callData = incomingCall;
    setIncomingCall(null);
    setActiveCall({
      id: callData.id,
      peerPhone: callData.callerPhone,
      peerName: callData.callerName,
      peerAvatar: callData.callerAvatar,
      type: callData.callType
    });
    setCallStatus("Connecting...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callData.callType === "video"
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(doc(db, "calls", callData.id), {
        status: "answered",
        answer: { sdp: answer.sdp, type: answer.type }
      });
      setCallStatus("Connected");
      startCallTimer();
    } catch (err) {
      showToast("Call failed: " + err.message);
      endCall();
    }
  };

  const rejectIncomingCall = async () => {
    soundEngine.stopRing();
    if (incomingCall?.id) {
      await updateDoc(doc(db, "calls", incomingCall.id), { status: "rejected" }).catch(() => {});
    }
    setIncomingCall(null);
  };

  const endCall = async () => {
    soundEngine.stopRing();
    clearInterval(callDurationTimerRef.current);
    setCallDuration(0);
    if (activeCall?.id) {
      await updateDoc(doc(db, "calls", activeCall.id), { status: "ended" }).catch(() => {});
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    setActiveCall(null);
  };

  const startCallTimer = () => {
    clearInterval(callDurationTimerRef.current);
    setCallDuration(0);
    callDurationTimerRef.current = setInterval(() => {
      setCallDuration((s) => s + 1);
    }, 1000);
  };

  // --- SORTED CHAT CONTACTS ---
  const sortedContacts = useMemo(() => {
    let list = contacts.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm))
    );
    return list.sort((a, b) => {
      const aPinned = pinnedChats.includes(a.id);
      const bPinned = pinnedChats.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [contacts, searchTerm, pinnedChats]);

  // ================= RENDER =================

  // If user is not authenticated, render Login Form
  if (!currentUser) {
    return (
      <div style={{ ...styles.centerContainer, backgroundColor: THEME.bg }}>
        {/* Real Invisible Recaptcha DOM Element (Always Present) */}
        <div id="recaptcha-container"></div>

        <div style={{ ...styles.authCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
          {/* Logo & Branding */}
          <div style={{ ...styles.logoCircle, backgroundColor: THEME.primary, marginBottom: "14px" }}>
            <MessageSquare size={28} color="#fff" />
          </div>
          <h2 style={{ textAlign: "center", margin: "0 0 6px", color: THEME.text }}>Infinity Chat</h2>
          <p style={{ textAlign: "center", fontSize: "12px", color: THEME.textMuted, margin: "0 0 20px" }}>
            Real-time low latency messaging & social channels
          </p>

          {/* STEP 1: LOGIN (Google or Phone) */}
          {authStep === "login" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 1-Click Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: "#ffffff",
                  color: "#3c4043",
                  border: "1px solid #dadce0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  padding: "11px 16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: THEME.border }} />
                <span style={{ fontSize: "11px", color: THEME.textMuted, fontWeight: "600" }}>OR SMS OTP</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: THEME.border }} />
              </div>

              {/* Phone OTP Form */}
              <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={styles.label}>Bangladeshi Mobile Number</label>
                  <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: THEME.primary, paddingRight: "4px" }}>+880</span>
                    <input
                      type="tel"
                      placeholder="01712345678"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      style={{ ...styles.bareInput, color: THEME.text }}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: THEME.textMuted, fontSize: "11px" }}>
                  <ShieldCheck size={14} color={THEME.accent} />
                  <span>A 6-digit SMS verification code will be sent to your phone.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    ...styles.primaryBtn,
                    backgroundColor: THEME.primary,
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? "Sending SMS OTP..." : "Send Verification Code"}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: 6-DIGIT OTP VERIFICATION */}
          {authStep === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ textAlign: "center", fontSize: "12px", color: THEME.textMuted }}>
                Enter the 6-digit code sent to <strong>+880 {normalizePhone(phoneInput)}</strong>
              </div>

              <OtpInput
                otp={otpArray}
                setOtp={setOtpArray}
                onComplete={handleVerifyOtp}
                THEME={THEME}
              />

              <button
                type="button"
                onClick={() => handleVerifyOtp(otpArray.join(""))}
                disabled={isSubmitting || otpArray.some((d) => d === "")}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  opacity: isSubmitting || otpArray.some((d) => d === "") ? 0.6 : 1
                }}
              >
                {isSubmitting ? "Verifying..." : "Verify & Sign In"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setAuthStep("login")}
                  style={{ ...styles.linkBtn, color: THEME.textMuted, fontSize: "11px" }}
                >
                  Edit Number
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSubmitting}
                  style={{ ...styles.linkBtn, color: THEME.primary, fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <RotateCcw size={12} />
                  <span>Resend Code</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- LOGGED-IN MAIN APPLICATION WRAPPER ---
  return (
    <div style={{ ...styles.appWrap, backgroundColor: THEME.bg }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{ ...styles.toast, backgroundColor: THEME.primary }}>
          {toastMessage}
        </div>
      )}

      {/* --- MODAL: POST-LOGIN PHONE NUMBER PROMPT --- */}
      {showPhonePrompt && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>Link Mobile Number</div>
              <button onClick={() => setShowPhonePrompt(false)} style={styles.cleanBtn}><X size={18} color={THEME.text} /></button>
            </div>
            <form onSubmit={handleSavePromptPhone} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                Link your Bangladeshi mobile number so contacts can discover you and start encrypted chats.
              </div>
              <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: THEME.primary, paddingRight: "4px" }}>+880</span>
                <input
                  type="tel"
                  placeholder="01712345678"
                  value={promptPhoneInput}
                  onChange={(e) => setPromptPhoneInput(e.target.value)}
                  style={{ ...styles.bareInput, color: THEME.text }}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}>
                Save & Continue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <div
        style={{
          ...styles.sidebar,
          backgroundColor: THEME.sidebar,
          borderColor: THEME.border,
          display: mobileView === "chat" ? "none" : "flex"
        }}
      >
        {/* Sidebar Header */}
        <div style={{ ...styles.headerBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
          <div
            onClick={() => {
              setViewedProfile(currentUser);
              setActiveModal("profile_view");
            }}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
          >
            <img src={currentUser.avatar} alt="" style={styles.roundAvatar} />
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{currentUser.name}</div>
              <div style={{ fontSize: "11px", color: THEME.accent }}>{currentUser.phone || "No phone linked"}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setActiveModal("add_contact")}
              style={styles.cleanBtn}
              title="Add Contact"
            >
              <Plus size={18} color={THEME.text} />
            </button>
            <button
              onClick={() => setActiveModal("settings")}
              style={styles.cleanBtn}
              title="Settings"
            >
              <SettingsIcon size={18} color={THEME.text} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: [ 💬 Chats ] [ 📻 Feed ] [ 📢 Channels ] */}
        <div style={{ display: "flex", borderBottom: `1px solid ${THEME.border}`, backgroundColor: THEME.header }}>
          <button
            onClick={() => {
              setMainTab("chats");
              setActiveChannel(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: "none",
              fontWeight: "700",
              fontSize: "12px",
              color: mainTab === "chats" ? THEME.primary : THEME.textMuted,
              borderBottom: mainTab === "chats" ? `2.5px solid ${THEME.primary}` : "2.5px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <MessageSquare size={15} />
            <span>{t.chats}</span>
          </button>

          <button
            onClick={() => {
              setMainTab("feed");
              setActiveChat(null);
              setActiveChannel(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: "none",
              fontWeight: "700",
              fontSize: "12px",
              color: mainTab === "feed" ? THEME.primary : THEME.textMuted,
              borderBottom: mainTab === "feed" ? `2.5px solid ${THEME.primary}` : "2.5px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <Radio size={15} />
            <span>Feed</span>
          </button>

          <button
            onClick={() => {
              setMainTab("channels");
              setActiveChat(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: "none",
              fontWeight: "700",
              fontSize: "12px",
              color: mainTab === "channels" ? THEME.primary : THEME.textMuted,
              borderBottom: mainTab === "channels" ? `2.5px solid ${THEME.primary}` : "2.5px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <Users size={15} />
            <span>{t.channels}</span>
          </button>
        </div>

        {/* Search Bar */}
        {mainTab !== "feed" && (
          <div style={{ ...styles.searchWrap, backgroundColor: THEME.card, border: `1px solid ${THEME.border}` }}>
            <Search size={16} color={THEME.textMuted} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...styles.bareInput, color: THEME.text }}
            />
          </div>
        )}

        {/* Sidebar List Content */}
        {mainTab === "chats" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
            {sortedContacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
                <MessageSquare size={36} style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: "14px" }}>No chats found</div>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>Add a contact to start chatting</div>
              </div>
            ) : (
              sortedContacts.map((c) => {
                const isSelected = activeChat?.id === c.id;
                const isPinned = pinnedChats.includes(c.id);
                const isMuted = mutedChats.includes(c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveChat(c);
                      setActiveChannel(null);
                      setMobileView("chat");
                    }}
                    style={{
                      ...styles.contactItem,
                      backgroundColor: isSelected ? THEME.cardHover : "transparent"
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <img src={c.avatar} alt="" style={styles.roundAvatar} />
                      {c.isOnline && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: "1px",
                            right: "1px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: THEME.accent,
                            border: `2px solid ${THEME.sidebar}`
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "700", fontSize: "13px", color: THEME.text }}>{c.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {isPinned && <Pin size={12} color={THEME.primary} />}
                          {isMuted && <BellOff size={12} color={THEME.danger} />}
                          <span style={{ fontSize: "10px", color: THEME.textMuted }}>{c.lastSeen || ""}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: THEME.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.phone || "Active contact"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {mainTab === "feed" && (
          <Feed
            feedPosts={feedPosts}
            currentUser={currentUser}
            channels={channels}
            THEME={THEME}
            t={t}
            onOpenChannel={(chId) => {
              const ch = channels.find((c) => c.id === chId);
              if (ch) {
                setActiveChannel(ch);
                setMainTab("channels");
                setMobileView("chat");
              }
            }}
            onToggleLike={handleToggleFeedLike}
            onReaction={handleFeedReaction}
            onForward={(post) => {
              setForwardModalMsg(post);
              setSelectedForwardTargets([]);
            }}
            onLightbox={(media) => setLightboxMedia(media)}
            onBroadcastPost={handleBroadcastPost}
            showToast={showToast}
          />
        )}

        {mainTab === "channels" && (
          <Channels
            channels={channels}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            channelPosts={channelPosts}
            currentUser={currentUser}
            THEME={THEME}
            t={t}
            onToggleSubscribe={handleToggleSubscribe}
            onBroadcastPost={handleBroadcastPost}
            onPromoteAdmin={handleChannelAdminAction}
            onDemoteAdmin={handleDemoteAdmin}
            onToggleLike={handleToggleFeedLike}
            onReaction={handleFeedReaction}
            onForward={(post) => {
              setForwardModalMsg(post);
              setSelectedForwardTargets([]);
            }}
            onLightbox={(media) => setLightboxMedia(media)}
            setMobileView={setMobileView}
            showToast={showToast}
          />
        )}
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div
        style={{
          ...styles.chatMain,
          backgroundColor: THEME.bg,
          display: mobileView === "list" ? "none" : "flex"
        }}
        className={mobileView === "list" ? "mobile-only" : ""}
      >
        {activeChat ? (
          <ChatView
            activeChat={activeChat}
            setActiveChat={setActiveChat}
            messages={messagesMap[getRoomId(currentUser.phone || currentUser.uid || currentUser.id, activeChat.phone || activeChat.id)] || []}
            currentUser={currentUser}
            peerPresence={peerPresence}
            THEME={THEME}
            t={t}
            isPinned={pinnedChats.includes(activeChat.id)}
            isMuted={mutedChats.includes(activeChat.id)}
            onTogglePin={togglePinChat}
            onToggleMute={toggleMuteChat}
            vanishMode={vanishMode}
            setVanishMode={setVanishMode}
            viewOnceMode={viewOnceMode}
            setViewOnceMode={setViewOnceMode}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            onSendMessage={handleSendMessage}
            onSendMedia={handleSendMedia}
            onReactMessage={handleReactMessage}
            onForwardMessage={(msg) => {
              setForwardModalMsg(msg);
              setSelectedForwardTargets([]);
            }}
            onLightbox={(media) => setLightboxMedia(media)}
            startCall={startCall}
            openProfile={(peer) => {
              setViewedProfile(peer);
              setActiveModal("profile_view");
            }}
            setMobileView={setMobileView}
            showToast={showToast}
          />
        ) : activeChannel ? (
          <Channels
            channels={channels}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            channelPosts={channelPosts}
            currentUser={currentUser}
            THEME={THEME}
            t={t}
            onToggleSubscribe={handleToggleSubscribe}
            onBroadcastPost={handleBroadcastPost}
            onPromoteAdmin={handleChannelAdminAction}
            onDemoteAdmin={handleDemoteAdmin}
            onToggleLike={handleToggleFeedLike}
            onReaction={handleFeedReaction}
            onForward={(post) => {
              setForwardModalMsg(post);
              setSelectedForwardTargets([]);
            }}
            onLightbox={(media) => setLightboxMedia(media)}
            setMobileView={setMobileView}
            showToast={showToast}
          />
        ) : mainTab === "feed" ? (
          <Feed
            feedPosts={feedPosts}
            currentUser={currentUser}
            channels={channels}
            THEME={THEME}
            t={t}
            onOpenChannel={(chId) => {
              const ch = channels.find((c) => c.id === chId);
              if (ch) {
                setActiveChannel(ch);
                setMainTab("channels");
              }
            }}
            onToggleLike={handleToggleFeedLike}
            onReaction={handleFeedReaction}
            onForward={(post) => {
              setForwardModalMsg(post);
              setSelectedForwardTargets([]);
            }}
            onLightbox={(media) => setLightboxMedia(media)}
            onBroadcastPost={handleBroadcastPost}
            showToast={showToast}
          />
        ) : (
          <div style={{ margin: "auto", textAlign: "center", color: THEME.textMuted, padding: "20px" }}>
            <MessageSquare size={54} color={THEME.primary} style={{ marginBottom: "12px", opacity: 0.8 }} />
            <h3 style={{ margin: 0, color: THEME.text }}>Infinity Chat Desktop & Mobile</h3>
            <p style={{ fontSize: "13px", maxWidth: "340px", marginTop: "6px", lineHeight: "1.5" }}>
              Select a conversation or explore channels to send encrypted messages and view real-time broadcasts.
            </p>
          </div>
        )}
      </div>

      {/* --- MODAL: WEBRTC CALL OVERLAY --- */}
      <CallModal
        activeCall={activeCall}
        incomingCall={incomingCall}
        acceptIncomingCall={acceptIncomingCall}
        rejectIncomingCall={rejectIncomingCall}
        endCall={endCall}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        callStatus={callStatus}
        callDuration={callDuration}
        THEME={THEME}
        t={t}
      />

      {/* --- MODAL: SETTINGS & PREFERENCES --- */}
      {activeModal === "settings" && (
        <Settings
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          lang={lang}
          setLang={setLang}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          notificationsEnabled={notificationsEnabled}
          setNotificationsEnabled={setNotificationsEnabled}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          ghostMode={ghostMode}
          setGhostMode={setGhostMode}
          selectedRingtone={selectedRingtone}
          setSelectedRingtone={setSelectedRingtone}
          THEME={THEME}
          t={t}
          onClose={() => setActiveModal(null)}
          onOpenChannels={() => {
            setMainTab("channels");
            setActiveModal(null);
          }}
          onLogout={handleLogout}
          showToast={showToast}
          db={db}
        />
      )}

      {/* --- MODAL: FORWARD MESSAGE --- */}
      {forwardModalMsg && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px", color: THEME.text }}>
                <Share2 size={16} color={THEME.primary} />
                <span>Forward to...</span>
              </div>
              <button onClick={() => { setForwardModalMsg(null); setSelectedForwardTargets([]); }} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <div style={{ padding: "10px 14px", backgroundColor: THEME.card, borderBottom: `1px solid ${THEME.border}`, fontSize: "12px" }}>
              <div style={{ color: THEME.textMuted, fontSize: "11px", marginBottom: "2px" }}>Forwarding:</div>
              <div style={{ fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: THEME.text }}>
                {forwardModalMsg.content || (forwardModalMsg.type === "image" ? "📷 Photo" : forwardModalMsg.type === "video" ? "🎥 Video" : "📄 File")}
              </div>
            </div>

            <div style={{ padding: "12px", maxHeight: "50vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: THEME.textMuted, textTransform: "uppercase" }}>Chats</div>
              {contacts.map((c) => {
                const isSelected = selectedForwardTargets.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedForwardTargets(selectedForwardTargets.filter((id) => id !== c.id));
                      } else {
                        setSelectedForwardTargets([...selectedForwardTargets, c.id]);
                      }
                    }}
                    style={{
                      ...styles.contactItem,
                      backgroundColor: isSelected ? THEME.cardHover : "transparent",
                      border: isSelected ? `1px solid ${THEME.primary}` : "1px solid transparent"
                    }}
                  >
                    <img src={c.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>{c.name}</div>
                      <div style={{ fontSize: "10px", color: THEME.textMuted }}>{c.phone || c.id}</div>
                    </div>
                    <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: THEME.primary }} />
                  </div>
                );
              })}

              {/* Channels Where User is Admin */}
              {channels.filter((ch) => ch.creatorPhone === (currentUser?.phone || currentUser?.uid) || ch.admins?.includes(currentUser?.phone || currentUser?.uid)).length > 0 && (
                <>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: THEME.textMuted, textTransform: "uppercase", marginTop: "8px" }}>My Channels</div>
                  {channels
                    .filter((ch) => ch.creatorPhone === (currentUser?.phone || currentUser?.uid) || ch.admins?.includes(currentUser?.phone || currentUser?.uid))
                    .map((ch) => {
                      const chKey = `ch_${ch.id}`;
                      const isSelected = selectedForwardTargets.includes(chKey);
                      return (
                        <div
                          key={ch.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedForwardTargets(selectedForwardTargets.filter((id) => id !== chKey));
                            } else {
                              setSelectedForwardTargets([...selectedForwardTargets, chKey]);
                            }
                          }}
                          style={{
                            ...styles.contactItem,
                            backgroundColor: isSelected ? THEME.cardHover : "transparent",
                            border: isSelected ? `1px solid ${THEME.primary}` : "1px solid transparent"
                          }}
                        >
                          <img src={ch.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>{ch.name}</div>
                            <div style={{ fontSize: "10px", color: THEME.accent }}>Channel Broadcast</div>
                          </div>
                          <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: THEME.primary }} />
                        </div>
                      );
                    })}
                </>
              )}
            </div>

            <div style={{ padding: "12px 16px", borderTop: `1px solid ${THEME.border}`, display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => { setForwardModalMsg(null); setSelectedForwardTargets([]); }}
                style={{ ...styles.pillBtn, backgroundColor: THEME.card, color: THEME.textMuted }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteForward}
                disabled={selectedForwardTargets.length === 0}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  width: "auto",
                  padding: "6px 18px",
                  opacity: selectedForwardTargets.length === 0 ? 0.5 : 1
                }}
              >
                <Send size={14} />
                <span>Forward ({selectedForwardTargets.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: FULL-SCREEN LIGHTBOX VIEWER --- */}
      {lightboxMedia && (
        <div style={{ ...styles.modalOverlay, backgroundColor: "rgba(0,0,0,0.95)", zIndex: 3000, flexDirection: "column" }}>
          <div style={{ width: "100%", maxWidth: "900px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px" }}>
            <div style={{ color: "#fff", fontWeight: "600", fontSize: "14px" }}>
              {lightboxMedia.name || "Media Viewer"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <a
                href={lightboxMedia.url}
                download={lightboxMedia.name || "media_download"}
                style={{ ...styles.pillBtn, backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", textDecoration: "none" }}
                title="Download to device"
              >
                <Download size={15} />
                <span>Download</span>
              </a>
              <button onClick={() => setLightboxMedia(null)} style={{ ...styles.cleanBtn, color: "#fff", padding: "4px" }}>
                <X size={24} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", maxWidth: "90vw", maxHeight: "80vh", padding: "10px" }}>
            {lightboxMedia.type === "video" ? (
              <video src={lightboxMedia.url} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "10px" }} />
            ) : (
              <img src={lightboxMedia.url} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: "8px" }} />
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: ADD CONTACT --- */}
      {activeModal === "add_contact" && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>Add Bangladeshi Contact</div>
              <button onClick={() => setActiveModal(null)} style={styles.cleanBtn}><X size={18} color={THEME.text} /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const norm = normalizePhone(contactSearchInput);
                if (!isValidBDPhone(norm)) {
                  showToast("Please enter a valid 11-digit BD number (013-019)");
                  return;
                }
                const docSnap = await getDoc(doc(db, "users", norm));
                if (docSnap.exists()) {
                  const targetUser = { id: norm, ...docSnap.data() };
                  setActiveChat(targetUser);
                  setMobileView("chat");
                  setActiveModal(null);
                  showToast("Chat started with " + targetUser.name);
                } else {
                  showToast("Contact not registered yet on Infinity Chat");
                }
              }}
              style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label style={styles.label}>Mobile Number (BD)</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: THEME.primary, paddingRight: "4px" }}>+880</span>
                  <input
                    type="tel"
                    placeholder="01712345678"
                    value={contactSearchInput}
                    onChange={(e) => setContactSearchInput(e.target.value)}
                    style={{ ...styles.bareInput, color: THEME.text }}
                    autoFocus
                    required
                  />
                </div>
              </div>
              <button type="submit" style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}>
                Find & Start Chat
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: VIEW CONTACT PROFILE --- */}
      {activeModal === "profile_view" && viewedProfile && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border, textAlign: "center", padding: "20px" }}>
            <img src={viewedProfile.avatar} alt="" style={{ width: "90px", height: "90px", borderRadius: "50%", margin: "0 auto 12px", objectFit: "cover" }} />
            <h3 style={{ margin: "0 0 4px", color: THEME.text }}>{viewedProfile.name}</h3>
            <p style={{ fontSize: "12px", color: THEME.accent, margin: "0 0 16px" }}>{viewedProfile.phone || "Google User"}</p>
            <button
              onClick={() => {
                setActiveModal(null);
                if (viewedProfile.id !== (currentUser.phone || currentUser.uid)) {
                  setActiveChat(viewedProfile);
                  setMobileView("chat");
                }
              }}
              style={{ ...styles.primaryBtn, backgroundColor: THEME.primary }}
            >
              {viewedProfile.id === (currentUser.phone || currentUser.uid) ? "Close" : "Send Direct Message"}
            </button>
          </div>
        </div>
      )}

      {/* Injected Responsive and Reset CSS */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, html { width: 100vw; height: 100vh; min-height: 100vh; overflow: hidden; }
        #root { width: 100vw; height: 100vh; min-height: 100vh; display: flex; }
        @media (min-width: 768px) {
          .mobile-only { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
