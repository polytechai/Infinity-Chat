import React, { useState, useEffect, useRef, useMemo, Component } from "react";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import {
  MessageSquare,
  Radio,
  Share2,
  Settings as SettingsIcon,
  Download,
  X,
  Lock,
  Fingerprint,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

// Independent Modular Imports from requested locations
import {
  db,
  normalizePhone,
  getRoomId,
  soundEngine,
  TRANSLATIONS,
  getTheme,
  styles
} from "./firebase";
import ChatView from "./components/ChatView";
import ChatBox from "./components/Chat/ChatBox";
import CallModal from "./components/Calls/CallModal";
import PrivacySettings from "./components/Settings/PrivacySettings";

// Direct Secondary Component Imports
import Feed from "./components/Feed";
import Channels from "./components/Channels";
import Settings from "./components/Settings";
import UserProfileModal from "./components/Chat/UserProfileModal";
import OtpInput from "./components/OtpInput";

// -------------------------------------------------------------
// ERROR BOUNDARY FALLBACK WRAPPER
// Prevents blank screen crashes on unexpected runtime exceptions
// -------------------------------------------------------------
class SafeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("Caught in SafeErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            backgroundColor: "#111B21",
            color: "#E9EDEF"
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px"
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h3 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "8px" }}>
            Something went wrong
          </h3>
          <p
            style={{
              fontSize: "12px",
              color: "#8696A0",
              maxWidth: "320px",
              marginBottom: "20px",
              lineHeight: "1.5"
            }}
          >
            An unexpected display error occurred. You can safely return to your chats or reload.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#22c55e",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "20px",
              border: "none",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={15} />
            <span>Restore Chat View</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // --- USER AUTH & LOCAL PERSISTENCE ---
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const s = localStorage.getItem("infinity_chat_user");
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  });

  // Settings & Theme Preferences
  const [lang, setLang] = useState(() => localStorage.getItem("infinity_lang") || "bn");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("infinity_theme") !== "light");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem("infinity_notif") !== "false");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("infinity_sound") !== "false");
  const [ghostMode, setGhostMode] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState("classic");

  const THEME = useMemo(() => getTheme(darkMode), [darkMode]);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // Active Tab & View Navigation State
  // Supports: 'chats', 'feeds' (or 'feed'), 'channels', 'settings'
  const [mainTab, setMainTab] = useState("chats");
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [activeModal, setActiveModal] = useState(null); // null | "privacy_settings" | "profile_view"
  const [viewedProfile, setViewedProfile] = useState(null);

  // Active Chat & Messaging State
  const [activeChat, setActiveChat] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});
  const [peerPresence, setPeerPresence] = useState({ isOnline: false, lastSeen: "" });

  // Channels & Feed Data
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [channelPosts, setChannelPosts] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);

  // Pinned & Muted Chats Local Persistence
  const [pinnedChats, setPinnedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("infinity_pinned_chats") || "[]");
    } catch (e) {
      return [];
    }
  });
  const [mutedChats, setMutedChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("infinity_muted_chats") || "[]");
    } catch (e) {
      return [];
    }
  });

  // Global Call States
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("Calling...");
  const [callDuration, setCallDuration] = useState(0);

  // Media Lightbox State
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // WebRTC Refs
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callDurationIntervalRef = useRef(null);

  // UI Toast State
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  // -------------------------------------------------------------
  // APP LOCK: PIN & BIOMETRICS (ON APP LAUNCH)
  // -------------------------------------------------------------
  const myUserId = currentUser?.uid || currentUser?.id || normalizePhone(currentUser?.phone) || "";
  const storedAppLockPin = myUserId ? localStorage.getItem(`infinity_applock_pin_${myUserId}`) : null;
  const isBiometricEnabled = myUserId ? localStorage.getItem(`infinity_applock_biometrics_${myUserId}`) === "true" : false;

  const [isAppUnlocked, setIsAppUnlocked] = useState(() => !storedAppLockPin);
  const [unlockPinInput, setUnlockPinInput] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    if (storedAppLockPin && isBiometricEnabled && !isAppUnlocked) {
      if (window.PublicKeyCredential) {
        navigator.credentials?.get({
          publicKey: {
            challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
            timeout: 60000,
            userVerification: "preferred"
          }
        }).then(() => {
          setIsAppUnlocked(true);
          showToast("App unlocked with biometrics");
        }).catch(() => {});
      }
    }
  }, [storedAppLockPin, isBiometricEnabled, isAppUnlocked]);

  const handleUnlockWithPin = (e) => {
    if (e) e.preventDefault();
    if (unlockPinInput === storedAppLockPin) {
      setIsAppUnlocked(true);
      setUnlockError("");
      setUnlockPinInput("");
      showToast("App unlocked");
    } else {
      setUnlockError("Incorrect PIN. Please try again.");
      if (window.navigator?.vibrate) window.navigator.vibrate([100, 50, 100]);
    }
  };

  // Browser Navigation History (Back Button)
  useEffect(() => {
    window.history.pushState({ page: "root" }, "");
    const handlePopState = () => {
      if (incomingCall) {
        rejectIncomingCall();
      } else if (activeCall) {
        endCall();
      } else if (lightboxMedia) {
        setLightboxMedia(null);
        window.history.pushState({ page: "root" }, "");
      } else if (activeModal) {
        setActiveModal(null);
        window.history.pushState({ page: "root" }, "");
      } else if (mobileView === "chat") {
        setMobileView("list");
        setActiveChat(null);
        window.history.pushState({ page: "root" }, "");
      } else {
        window.history.pushState({ page: "root" }, "");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [incomingCall, activeCall, lightboxMedia, activeModal, mobileView]);

  // Firestore Heartbeat & Presence
  useEffect(() => {
    if (!currentUser?.phone || ghostMode || !db) return;
    const myNorm = normalizePhone(currentUser.phone);
    const userDocRef = doc(db, "users", myNorm);

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
  }, [currentUser?.phone, ghostMode]);

  // Real-Time Active Messages Listener
  useEffect(() => {
    if (!currentUser?.phone || !activeChat?.id || !db) return;
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.id);
    const roomId = getRoomId(myNorm, peerNorm);
    const messagesCol = collection(db, "rooms", roomId, "messages");
    const q = query(messagesCol, orderBy("createdAt", "asc"), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = [];
      snap.forEach((d) => {
        const m = { id: d.id, ...d.data() };
        msgs.push(m);
        if (normalizePhone(m.senderPhone || m.senderId) !== myNorm && m.status !== "read") {
          updateDoc(doc(db, "rooms", roomId, "messages", d.id), { status: "read" }).catch(() => {});
        }
      });
      setMessagesMap((prev) => ({ ...prev, [roomId]: msgs }));
    }, (err) => console.warn("Messages snapshot error:", err));

    const peerDocRef = doc(db, "users", peerNorm);
    const unsubPeer = onSnapshot(peerDocRef, (d) => {
      if (d.exists()) {
        const data = d.data();
        setPeerPresence({
          isOnline: !!data.isOnline,
          lastSeen: data.lastSeen
            ? new Date(data.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : ""
        });
      }
    }, (err) => console.warn("Peer snapshot error:", err));

    return () => {
      unsub();
      unsubPeer();
    };
  }, [currentUser?.phone, activeChat?.id]);

  // Incoming Call Listener
  useEffect(() => {
    if (!currentUser?.phone || !db) return;
    const myNorm = normalizePhone(currentUser.phone);
    const callsCol = collection(db, "calls");
    const unsub = onSnapshot(callsCol, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const callData = { id: change.doc.id, ...change.doc.data() };
          if (
            normalizePhone(callData.recipientPhone) === myNorm &&
            callData.status === "ringing" &&
            !activeCall
          ) {
            setIncomingCall(callData);
            if (soundEnabled && soundEngine?.startRing) {
              soundEngine.startRing(selectedRingtone);
            }
          }
        }
      });
    }, (err) => console.warn("Calls listener error:", err));
    return () => unsub();
  }, [currentUser?.phone, activeCall, soundEnabled, selectedRingtone]);

  // WebRTC Call Initiation
  const startCall = async (targetContact, type = "audio") => {
    if (!currentUser?.phone || !targetContact?.phone || !db) return;
    const myNorm = normalizePhone(currentUser.phone);
    const targetNorm = normalizePhone(targetContact.phone);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video"
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const callId = `call_${Date.now()}`;
      const callDocRef = doc(db, "calls", callId);

      const callData = {
        callId,
        id: callId,
        callerPhone: myNorm,
        callerName: currentUser.name || myNorm,
        callerAvatar: currentUser.avatar || "",
        recipientPhone: targetNorm,
        type,
        status: "ringing",
        createdAt: new Date().toISOString()
      };

      await setDoc(callDocRef, callData);
      setActiveCall({ ...callData, ...targetContact });
      setCallStatus("Ringing...");

      const unsubCall = onSnapshot(callDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === "accepted") {
            setCallStatus("Connected");
            if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current);
            setCallDuration(0);
            callDurationIntervalRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          } else if (data.status === "ended" || data.status === "rejected") {
            endCall();
            unsubCall();
          }
        }
      });
    } catch (err) {
      console.warn("Start call failed:", err);
      showToast("Camera/Microphone permission required for calling");
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !db) return;
    if (soundEnabled && soundEngine?.stopRing) soundEngine.stopRing();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === "video"
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      await updateDoc(doc(db, "calls", incomingCall.id), { status: "accepted" });
      setActiveCall(incomingCall);
      setIncomingCall(null);
      setCallStatus("Connected");
      setCallDuration(0);
      if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn("Accept call failed:", err);
      rejectIncomingCall();
    }
  };

  const rejectIncomingCall = async () => {
    if (soundEnabled && soundEngine?.stopRing) soundEngine.stopRing();
    if (incomingCall?.id && db) {
      await updateDoc(doc(db, "calls", incomingCall.id), { status: "rejected" }).catch(() => {});
    }
    setIncomingCall(null);
  };

  const endCall = async () => {
    if (soundEnabled && soundEngine?.stopRing) soundEngine.stopRing();
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    const currentCallObj = activeCall || incomingCall;
    if (currentCallObj?.id && db) {
      await updateDoc(doc(db, "calls", currentCallObj.id), { status: "ended" }).catch(() => {});
    }
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus("Calling...");
    setCallDuration(0);
  };

  // Messaging Actions
  const handleSendMessage = async (text) => {
    if (!currentUser?.phone || !activeChat?.id || !db) return;
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.id);
    const roomId = getRoomId(myNorm, peerNorm);

    const msgId = `msg_${Date.now()}`;
    const newMsg = {
      id: msgId,
      senderId: myNorm,
      senderPhone: myNorm,
      senderName: currentUser.name || myNorm,
      recipientPhone: peerNorm,
      content: text,
      type: "text",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "rooms", roomId, "messages", msgId), newMsg);
    await setDoc(
      doc(db, "conversations", roomId),
      {
        lastMessage: text,
        lastSenderId: myNorm,
        lastMessageTimestamp: Date.now(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  };

  const handleSendMedia = async (mediaPayload) => {
    if (!currentUser?.phone || !activeChat?.id || !db) return;
    const myNorm = normalizePhone(currentUser.phone);
    const peerNorm = normalizePhone(activeChat.id);
    const roomId = getRoomId(myNorm, peerNorm);

    const msgId = `media_${Date.now()}`;
    const newMsg = {
      id: msgId,
      senderId: myNorm,
      senderPhone: myNorm,
      senderName: currentUser.name || myNorm,
      recipientPhone: peerNorm,
      content: mediaPayload.caption || "",
      fileUrl: mediaPayload.fileUrl || mediaPayload.rawDataUrl,
      fileName: mediaPayload.fileName || "attachment",
      type: mediaPayload.type || "image",
      status: "sent",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "rooms", roomId, "messages", msgId), newMsg);
    await setDoc(
      doc(db, "conversations", roomId),
      {
        lastMessage: mediaPayload.type === "video" ? "🎥 Video" : "📷 Photo",
        lastSenderId: myNorm,
        lastMessageTimestamp: Date.now(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  };

  const handleReactMessage = async (msgId, emoji) => {
    if (!activeChat?.id || !currentUser?.phone || !db) return;
    const roomId = getRoomId(normalizePhone(currentUser.phone), normalizePhone(activeChat.id));
    const msgRef = doc(db, "rooms", roomId, "messages", msgId);
    try {
      const snap = await getDoc(msgRef);
      if (snap.exists()) {
        const reactions = snap.data().reactions || {};
        const currentList = reactions[emoji] || [];
        const myPhone = normalizePhone(currentUser.phone);
        const updatedList = currentList.includes(myPhone)
          ? currentList.filter((p) => p !== myPhone)
          : [...currentList, myPhone];

        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: updatedList
        });
      }
    } catch (e) {
      console.warn("Reaction failed:", e);
    }
  };

  const togglePinChat = (chatId) => {
    const next = pinnedChats.includes(chatId)
      ? pinnedChats.filter((id) => id !== chatId)
      : [chatId, ...pinnedChats];
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
    showToast(mutedChats.includes(chatId) ? "Notifications unmuted" : "Notifications muted");
  };

  // -------------------------------------------------------------
  // 1. AUTHENTICATION FALLBACK
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: THEME.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px"
        }}
      >
        <SafeErrorBoundary>
          <OtpInput
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              localStorage.setItem("infinity_chat_user", JSON.stringify(user));
              showToast("Welcome to Infinity Chat");
            }}
            THEME={THEME}
            t={t}
            showToast={showToast}
          />
        </SafeErrorBoundary>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. APP LOCK SCREEN OVERLAY (PIN & BIOMETRICS)
  // -------------------------------------------------------------
  if (storedAppLockPin && !isAppUnlocked) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: THEME.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          color: THEME.text
        }}
      >
        <div
          style={{
            ...styles.modalCard,
            backgroundColor: THEME.sidebar,
            borderColor: THEME.border,
            maxWidth: "340px",
            width: "100%",
            textAlign: "center",
            padding: "24px"
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "rgba(34, 197, 94, 0.15)",
              color: THEME.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}
          >
            <Lock size={28} />
          </div>

          <div style={{ fontSize: "18px", fontWeight: "700", marginBottom: "6px" }}>
            Infinity Chat Locked
          </div>
          <div style={{ fontSize: "12px", color: THEME.textMuted, marginBottom: "20px" }}>
            Enter your passcode to access your messages
          </div>

          <form onSubmit={handleUnlockWithPin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="password"
              maxLength={6}
              autoFocus
              value={unlockPinInput}
              onChange={(e) => setUnlockPinInput(e.target.value)}
              placeholder="••••"
              style={{
                ...styles.bareInput,
                backgroundColor: THEME.card,
                border: `1px solid ${THEME.border}`,
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center",
                fontSize: "24px",
                letterSpacing: "6px",
                color: THEME.text
              }}
            />

            {unlockError && (
              <div style={{ fontSize: "12px", color: THEME.danger }}>{unlockError}</div>
            )}

            <button
              type="submit"
              style={{
                ...styles.primaryBtn,
                backgroundColor: THEME.primary,
                padding: "12px",
                fontSize: "14px",
                marginTop: "6px"
              }}
            >
              Unlock
            </button>

            {isBiometricEnabled && (
              <button
                type="button"
                onClick={() => {
                  navigator.credentials?.get({
                    publicKey: {
                      challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
                      timeout: 60000,
                      userVerification: "preferred"
                    }
                  }).then(() => {
                    setIsAppUnlocked(true);
                  }).catch(() => {});
                }}
                style={{
                  ...styles.cleanBtn,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  color: THEME.accent,
                  fontSize: "13px",
                  marginTop: "8px"
                }}
              >
                <Fingerprint size={16} />
                <span>Unlock with Biometrics</span>
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Active chat message thread
  const activeRoomId = activeChat?.id
    ? getRoomId(normalizePhone(currentUser.phone), normalizePhone(activeChat.id))
    : null;
  const activeMessages = activeRoomId ? messagesMap[activeRoomId] || [] : [];

  // -------------------------------------------------------------
  // 3. MAIN APP INTERFACE WITH BOTTOM NAVIGATION BAR
  // -------------------------------------------------------------
  return (
    <div
      style={{
        ...styles.appContainer,
        backgroundColor: THEME.bg,
        color: THEME.text,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh"
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            ...styles.toast,
            backgroundColor: THEME.cardHover,
            border: `1px solid ${THEME.border}`,
            color: THEME.text
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* --- GLOBAL CALL OVERLAY MODAL --- */}
      {(activeCall || incomingCall) && (
        <SafeErrorBoundary>
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
            currentUser={currentUser}
            activeChat={activeChat}
            showToast={showToast}
          />
        </SafeErrorBoundary>
      )}

      {/* --- ACTIVE TAB CONTENT VIEW WITH SAFE ERROR BOUNDARY --- */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <SafeErrorBoundary onReset={() => { setMainTab("chats"); setActiveChat(null); }}>
          {/* TAB 1: CHATS (DEFAULT) */}
          {(mainTab === "chats" || (!["feeds", "feed", "channels", "settings"].includes(mainTab))) && (
            <ChatView
              activeChat={activeChat}
              setActiveChat={setActiveChat}
              currentUser={currentUser}
              messages={activeMessages}
              peerPresence={peerPresence}
              THEME={THEME}
              t={t}
              mainTab={mainTab}
              setMainTab={setMainTab}
              mobileView={mobileView}
              setMobileView={setMobileView}
              pinnedChats={pinnedChats}
              onTogglePin={togglePinChat}
              mutedChats={mutedChats}
              onToggleMute={toggleMuteChat}
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onReactMessage={handleReactMessage}
              startCall={startCall}
              openProfile={(peer) => {
                setViewedProfile(peer);
                setActiveModal("profile_view");
              }}
              onLightbox={(media) => setLightboxMedia(media)}
              showToast={showToast}
            />
          )}

          {/* TAB 2: FEEDS */}
          {(mainTab === "feeds" || mainTab === "feed") && (
            <div style={{ width: "100%", height: "100%", overflowY: "auto" }}>
              <Feed
                posts={feedPosts}
                currentUser={currentUser}
                THEME={THEME}
                t={t}
                onLightbox={(media) => setLightboxMedia(media)}
                showToast={showToast}
              />
            </div>
          )}

          {/* TAB 3: CHANNELS */}
          {mainTab === "channels" && (
            <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
              <Channels
                channels={channels}
                activeChannel={activeChannel}
                setActiveChannel={setActiveChannel}
                channelPosts={channelPosts}
                currentUser={currentUser}
                THEME={THEME}
                t={t}
                setMobileView={setMobileView}
                showToast={showToast}
              />
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {mainTab === "settings" && (
            <div style={{ width: "100%", height: "100%", overflowY: "auto" }}>
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
                onClose={() => setMainTab("chats")}
                onOpenPrivacy={() => setActiveModal("privacy_settings")}
                onOpenChannels={() => setMainTab("channels")}
                onLogout={() => {
                  localStorage.removeItem("infinity_chat_user");
                  setCurrentUser(null);
                  showToast("Logged out successfully");
                }}
                showToast={showToast}
                db={db}
              />
            </div>
          )}
        </SafeErrorBoundary>
      </div>

      {/* --- GLOBAL APP NAVIGATION BAR (ALWAYS AT BOTTOM WHEN NOT IN ACTIVE CHAT) --- */}
      {(!activeChat || mobileView !== "chat") && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            backgroundColor: THEME.header,
            borderTop: `1px solid ${THEME.border}`,
            padding: "8px 0 10px",
            zIndex: 100,
            flexShrink: 0
          }}
        >
          {/* Chats Tab Button */}
          <button
            onClick={() => {
              setMainTab("chats");
              setActiveChat(null);
            }}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              color: mainTab === "chats" ? THEME.primary : THEME.textMuted,
              cursor: "pointer"
            }}
          >
            <MessageSquare size={20} />
            <span style={{ fontSize: "11px", fontWeight: mainTab === "chats" ? "700" : "500" }}>
              {t.chats || "Chats"}
            </span>
          </button>

          {/* Feeds Tab Button */}
          <button
            onClick={() => {
              setMainTab("feeds");
              setActiveChat(null);
            }}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              color: mainTab === "feeds" || mainTab === "feed" ? THEME.primary : THEME.textMuted,
              cursor: "pointer"
            }}
          >
            <Share2 size={20} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: mainTab === "feeds" || mainTab === "feed" ? "700" : "500"
              }}
            >
              {t.feed || "Feeds"}
            </span>
          </button>

          {/* Channels Tab Button */}
          <button
            onClick={() => {
              setMainTab("channels");
              setActiveChat(null);
            }}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              color: mainTab === "channels" ? THEME.primary : THEME.textMuted,
              cursor: "pointer"
            }}
          >
            <Radio size={20} />
            <span style={{ fontSize: "11px", fontWeight: mainTab === "channels" ? "700" : "500" }}>
              {t.channels || "Channels"}
            </span>
          </button>

          {/* Settings Tab Button */}
          <button
            onClick={() => {
              setMainTab("settings");
              setActiveChat(null);
            }}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "3px",
              color: mainTab === "settings" ? THEME.primary : THEME.textMuted,
              cursor: "pointer"
            }}
          >
            <SettingsIcon size={20} />
            <span style={{ fontSize: "11px", fontWeight: mainTab === "settings" ? "700" : "500" }}>
              {t.settings || "Settings"}
            </span>
          </button>
        </div>
      )}

      {/* --- PRIVACY SETTINGS MODAL --- */}
      {activeModal === "privacy_settings" && (
        <PrivacySettings
          currentUser={currentUser}
          onClose={() => setActiveModal(null)}
          THEME={THEME}
          showToast={showToast}
        />
      )}

      {/* --- USER PROFILE MODAL --- */}
      {activeModal === "profile_view" && viewedProfile && (
        <UserProfileModal
          user={viewedProfile}
          onClose={() => setActiveModal(null)}
          currentUser={currentUser}
          messages={activeMessages}
          THEME={THEME}
          onClearChat={() => {
            if (activeRoomId) setMessagesMap((prev) => ({ ...prev, [activeRoomId]: [] }));
            showToast("Chat cleared");
          }}
          onBlockUser={() => {
            showToast("Contact blocked");
            setActiveModal(null);
          }}
          onMuteUser={(targetId) => toggleMuteChat(targetId)}
          onLightbox={(media) => setLightboxMedia(media)}
          startCall={startCall}
          showToast={showToast}
        />
      )}

      {/* --- MEDIA LIGHTBOX MODAL --- */}
      {lightboxMedia && (
        <div
          style={{
            ...styles.modalOverlay,
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 9999,
            flexDirection: "column"
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "900px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 20px"
            }}
          >
            <div style={{ color: "#fff", fontWeight: "600", fontSize: "14px" }}>
              {lightboxMedia.name || "Media Viewer"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <a
                href={lightboxMedia.url}
                download={lightboxMedia.name || "media_download"}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  textDecoration: "none"
                }}
                title="Download to device"
              >
                <Download size={15} />
                <span>Download</span>
              </a>
              <button
                onClick={() => setLightboxMedia(null)}
                style={{ ...styles.cleanBtn, color: "#fff", padding: "4px" }}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "90vw",
              maxHeight: "80vh",
              padding: "10px"
            }}
          >
            {lightboxMedia.type === "video" ? (
              <video
                src={lightboxMedia.url}
                controls
                autoPlay
                style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "10px" }}
              />
            ) : (
              <img
                src={lightboxMedia.url}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: "8px" }}
              />
            )}
          </div>
        </div>
      )}

      {/* Global CSS Overrides */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, html { width: 100vw; height: 100vh; min-height: 100vh; overflow: hidden; }
        #root { width: 100vw; height: 100vh; min-height: 100vh; display: flex; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
