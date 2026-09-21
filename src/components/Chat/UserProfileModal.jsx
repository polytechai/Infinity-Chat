import React, { useState, useMemo } from "react";
import {
  X,
  Phone,
  Video,
  Star,
  Bell,
  BellOff,
  Lock,
  Unlock,
  Clock,
  Trash2,
  ShieldAlert,
  Download,
  FileText,
  Film,
  Music,
  ChevronRight,
  Check,
  AlertTriangle,
  KeyRound,
  Users,
  Image as ImageIcon
} from "lucide-react";
import { doc, updateDoc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db, styles } from "../../firebase";

const DISAPPEARING_OPTIONS = [
  { label: "Off", value: "off", durationMs: 0 },
  { label: "24 Hours", value: "24h", durationMs: 24 * 60 * 60 * 1000 },
  { label: "7 Days", value: "7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { label: "90 Days", value: "90d", durationMs: 90 * 24 * 60 * 60 * 1000 }
];

export default function UserProfileModal({
  user = {},
  onClose,
  currentUser = {},
  messages = [],
  THEME = {
    bg: "#0B141A",
    sidebar: "#111B21",
    header: "#202C33",
    card: "#202C33",
    cardHover: "#2A3942",
    primary: "#22c55e",
    accent: "#00A884",
    danger: "#EF4444",
    border: "#2A3942",
    text: "#E9EDEF",
    textMuted: "#8696A0"
  },
  onClearChat,
  onBlockUser,
  onMuteUser,
  onLightbox,
  onCreateGroupWithUser,
  startCall,
  showToast
}) {
  const currentUserId =
    currentUser?.phone || currentUser?.uid || currentUser?.id || "";
  const peerUserId = user?.phone || user?.id || user?.uid || "";
  const peerName = user?.name || user?.phone || "Contact";
  const peerPhone = user?.phone || "";
  const peerAvatar =
    user?.avatar ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${peerUserId || "user"}`;
  const peerAbout = user?.about || user?.bio || "Available on Infinity Chat";

  // Tab & Modal Navigation States
  const [activeMediaTab, setActiveMediaTab] = useState("media"); // "media" | "docs"
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showLockPinModal, setShowLockPinModal] = useState(false);

  // -------------------------------------------------------------
  // 1. MUTE NOTIFICATIONS TOGGLE
  // -------------------------------------------------------------
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const stored = localStorage.getItem(`infinity_muted_${peerUserId}`);
      return stored === "true";
    } catch (e) {
      return false;
    }
  });

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem(`infinity_muted_${peerUserId}`, String(next));
    if (onMuteUser) onMuteUser(peerUserId, next);
    if (showToast) showToast(next ? "Notifications muted" : "Notifications unmuted");
  };

  // -------------------------------------------------------------
  // 2. DISAPPEARING MESSAGES TIMER & PURGE (Points 10 & 17)
  // -------------------------------------------------------------
  const [disappearingTimer, setDisappearingTimer] = useState(() => {
    try {
      return localStorage.getItem(`infinity_disappearing_${peerUserId}`) || "off";
    } catch (e) {
      return "off";
    }
  });

  const handleSelectDisappearingOption = async (option) => {
    setDisappearingTimer(option.value);
    localStorage.setItem(`infinity_disappearing_${peerUserId}`, option.value);

    // If duration is active, automatically purge expired messages from Firestore
    if (option.durationMs > 0 && db && user?.id) {
      try {
        const threshold = Date.now() - option.durationMs;
        const messagesRef = collection(db, "rooms", user.id, "messages");
        const snap = await getDocs(messagesRef);
        snap.forEach(async (docSnap) => {
          const data = docSnap.data();
          const createdTime = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          if (createdTime > 0 && createdTime < threshold) {
            await deleteDoc(doc(db, "rooms", user.id, "messages", docSnap.id));
          }
        });
      } catch (err) {
        console.warn("Disappearing purge error:", err);
      }
    }

    if (showToast) {
      showToast(
        option.value === "off"
          ? "Disappearing messages turned off"
          : `Disappearing messages set to ${option.label}`
      );
    }
    setShowDisappearingModal(false);
  };

  // -------------------------------------------------------------
  // 3. CHAT LOCK WITH 4-DIGIT PIN (Points 10 & 17)
  // -------------------------------------------------------------
  const [isChatLocked, setIsChatLocked] = useState(() => {
    try {
      return !!localStorage.getItem(`infinity_chatlock_pin_${peerUserId}`);
    } catch (e) {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState("");
  const [pinConfirmInput, setPinConfirmInput] = useState("");
  const [pinError, setPinError] = useState("");

  const handleToggleLockClick = () => {
    if (isChatLocked) {
      // Remove chat lock
      localStorage.removeItem(`infinity_chatlock_pin_${peerUserId}`);
      setIsChatLocked(false);
      if (showToast) showToast("Chat lock removed");
    } else {
      // Open PIN setting modal
      setPinInput("");
      setPinConfirmInput("");
      setPinError("");
      setShowLockPinModal(true);
    }
  };

  const handleSavePin = () => {
    if (pinInput.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    if (pinInput !== pinConfirmInput) {
      setPinError("PIN codes do not match");
      return;
    }

    localStorage.setItem(`infinity_chatlock_pin_${peerUserId}`, pinInput);
    setIsChatLocked(true);
    setShowLockPinModal(false);
    if (showToast) showToast("Chat successfully locked with PIN 🔒");
  };

  // -------------------------------------------------------------
  // 4. FAVORITE CONTACT TOGGLE
  // -------------------------------------------------------------
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const stored = localStorage.getItem(`infinity_favorite_${peerUserId}`);
      return stored === "true";
    } catch (e) {
      return false;
    }
  });

  const toggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    localStorage.setItem(`infinity_favorite_${peerUserId}`, String(next));
    if (showToast) showToast(next ? "Added to favorites ⭐" : "Removed from favorites");
  };

  // -------------------------------------------------------------
  // 5. SHARED MEDIA & DOCUMENTS GRID (Points 9 & 17)
  // -------------------------------------------------------------
  const sharedMedia = useMemo(() => {
    return messages.filter(
      (m) => (m.type === "image" || m.type === "video") && m.fileUrl
    );
  }, [messages]);

  const sharedDocs = useMemo(() => {
    return messages.filter(
      (m) => (m.type === "file" || m.type === "audio") && m.fileUrl
    );
  }, [messages]);

  // -------------------------------------------------------------
  // 6. BLOCK & REPORT ACTIONS
  // -------------------------------------------------------------
  const handleConfirmBlock = () => {
    if (onBlockUser) onBlockUser(peerUserId);
    setShowBlockConfirm(false);
    if (showToast) showToast(`Blocked ${peerName}`);
    onClose?.();
  };

  const handleSubmitReport = async () => {
    try {
      if (db) {
        await addDoc(collection(db, "reports"), {
          reporterId: currentUserId,
          reportedUserId: peerUserId,
          reportedName: peerName,
          reason: reportReason,
          createdAt: new Date().toISOString()
        });
      }
      if (showToast) showToast("Report submitted. Thank you.");
    } catch (e) {
      if (showToast) showToast("Report sent");
    }
    setShowReportModal(false);
  };

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 5000 }}>
      <div
        style={{
          ...styles.modalCard,
          backgroundColor: THEME.sidebar,
          borderColor: THEME.border,
          maxWidth: "420px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden"
        }}
      >
        {/* --- HEADER --- */}
        <div
          style={{
            ...styles.modalHeader,
            backgroundColor: THEME.header,
            borderColor: THEME.border,
            padding: "12px 16px"
          }}
        >
          <span style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>
            Contact Info
          </span>
          <button onClick={onClose} style={styles.cleanBtn}>
            <X size={18} color={THEME.textMuted} />
          </button>
        </div>

        {/* --- SCROLLABLE BODY --- */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}
        >
          {/* PROFILE AVATAR & INFO */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <img
              src={peerAvatar}
              alt=""
              style={{
                width: "86px",
                height: "86px",
                borderRadius: "50%",
                objectFit: "cover",
                border: `3px solid ${THEME.primary}`
              }}
            />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: "700", fontSize: "17px", color: THEME.text }}>
                {peerName}
              </div>
              <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>
                {peerPhone || "Infinity Chat User"}
              </div>
            </div>

            {/* QUICK AUDIO / VIDEO SHORTCUTS */}
            <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
              <button
                onClick={() => startCall && startCall(user, "audio")}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: THEME.card,
                  color: THEME.text,
                  border: `1px solid ${THEME.border}`,
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Phone size={15} color={THEME.primary} />
                <span style={{ fontSize: "12px" }}>Audio</span>
              </button>

              <button
                onClick={() => startCall && startCall(user, "video")}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: THEME.card,
                  color: THEME.text,
                  border: `1px solid ${THEME.border}`,
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Video size={15} color={THEME.primary} />
                <span style={{ fontSize: "12px" }}>Video</span>
              </button>
            </div>
          </div>

          {/* BIO / ABOUT CARD */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              padding: "12px",
              border: `1px solid ${THEME.border}`
            }}
          >
            <div style={{ fontSize: "11px", color: THEME.textMuted, fontWeight: "600", textTransform: "uppercase" }}>
              About
            </div>
            <div style={{ fontSize: "13px", color: THEME.text, marginTop: "4px" }}>
              {peerAbout}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 1. DISAPPEARING MESSAGES & CHAT LOCK TOGGLES (Points 10 & 17) */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              overflow: "hidden"
            }}
          >
            {/* Disappearing Messages Trigger */}
            <div
              onClick={() => setShowDisappearingModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                cursor: "pointer",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Clock size={17} color={THEME.accent} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                    Disappearing Messages
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {DISAPPEARING_OPTIONS.find((o) => o.value === disappearingTimer)?.label || "Off"}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} color={THEME.textMuted} />
            </div>

            {/* Lock Chat Toggle */}
            <div
              onClick={handleToggleLockClick}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                cursor: "pointer",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isChatLocked ? <Lock size={17} color={THEME.accent} /> : <Unlock size={17} color={THEME.textMuted} />}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                    Lock Chat (PIN Protected)
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {isChatLocked ? "Protected with PIN" : "Lock this chat with a passcode"}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isChatLocked}
                readOnly
                style={{ accentColor: THEME.accent }}
              />
            </div>

            {/* Mute Notifications Toggle */}
            <div
              onClick={toggleMute}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isMuted ? <BellOff size={17} color={THEME.danger} /> : <Bell size={17} color={THEME.textMuted} />}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                    Mute Notifications
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {isMuted ? "Muted" : "Unmuted"}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isMuted}
                readOnly
                style={{ accentColor: THEME.danger }}
              />
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 2. SHARED MEDIA & DOCUMENTS GRID (Points 9 & 17) */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              padding: "12px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setActiveMediaTab("media")}
                  style={{
                    ...styles.cleanBtn,
                    fontSize: "12px",
                    fontWeight: activeMediaTab === "media" ? "700" : "500",
                    color: activeMediaTab === "media" ? THEME.primary : THEME.textMuted,
                    borderBottom: activeMediaTab === "media" ? `2px solid ${THEME.primary}` : "none",
                    paddingBottom: "4px"
                  }}
                >
                  Media ({sharedMedia.length})
                </button>
                <button
                  onClick={() => setActiveMediaTab("docs")}
                  style={{
                    ...styles.cleanBtn,
                    fontSize: "12px",
                    fontWeight: activeMediaTab === "docs" ? "700" : "500",
                    color: activeMediaTab === "docs" ? THEME.primary : THEME.textMuted,
                    borderBottom: activeMediaTab === "docs" ? `2px solid ${THEME.primary}` : "none",
                    paddingBottom: "4px"
                  }}
                >
                  Docs ({sharedDocs.length})
                </button>
              </div>
            </div>

            {/* Media Grid */}
            {activeMediaTab === "media" ? (
              sharedMedia.length === 0 ? (
                <div style={{ textAlign: "center", padding: "18px 0", color: THEME.textMuted, fontSize: "12px" }}>
                  No photos or videos shared yet
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "6px",
                    maxHeight: "180px",
                    overflowY: "auto"
                  }}
                >
                  {sharedMedia.map((m) => (
                    <div
                      key={m.id}
                      onClick={() =>
                        onLightbox &&
                        onLightbox({ url: m.fileUrl, type: m.type, name: m.fileName })
                      }
                      style={{
                        position: "relative",
                        aspectRatio: "1/1",
                        borderRadius: "6px",
                        overflow: "hidden",
                        backgroundColor: "#000",
                        cursor: "pointer"
                      }}
                    >
                      {m.type === "video" ? (
                        <video
                          src={m.fileUrl}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <img
                          src={m.fileUrl}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      )}
                      {m.type === "video" && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "4px",
                            right: "4px",
                            backgroundColor: "rgba(0,0,0,0.6)",
                            borderRadius: "4px",
                            padding: "2px"
                          }}
                        >
                          <Film size={12} color="#fff" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : sharedDocs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "18px 0", color: THEME.textMuted, fontSize: "12px" }}>
                No documents or audio shared yet
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                {sharedDocs.map((docItem) => (
                  <div
                    key={docItem.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      backgroundColor: THEME.sidebar,
                      borderRadius: "6px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <FileText size={16} color={THEME.primary} />
                      <div
                        style={{
                          fontSize: "12px",
                          color: THEME.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {docItem.fileName || "Shared File"}
                      </div>
                    </div>
                    <a
                      href={docItem.fileUrl}
                      download={docItem.fileName || "file"}
                      style={{ color: THEME.accent }}
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 3. USER MANAGEMENT ACTIONS (Point 17) */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Add to Favorites */}
            <button
              onClick={toggleFavorite}
              style={{
                ...styles.settingsItem,
                backgroundColor: "transparent",
                padding: "12px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <Star size={16} fill={isFavorite ? "#f59e0b" : "none"} color="#f59e0b" />
              <span style={{ fontSize: "13px", color: THEME.text }}>
                {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              </span>
            </button>

            {/* Create Group with this contact */}
            <button
              onClick={() => {
                if (onCreateGroupWithUser) {
                  onCreateGroupWithUser(user);
                  onClose?.();
                }
              }}
              style={{
                ...styles.settingsItem,
                backgroundColor: "transparent",
                padding: "12px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <Users size={16} color={THEME.primary} />
              <span style={{ fontSize: "13px", color: THEME.text }}>
                Create Group with {peerName}
              </span>
            </button>

            {/* Clear Chat Messages */}
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{
                ...styles.settingsItem,
                backgroundColor: "transparent",
                padding: "12px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <Trash2 size={16} color={THEME.danger} />
              <span style={{ fontSize: "13px", color: THEME.danger }}>Clear Chat</span>
            </button>

            {/* Report Contact */}
            <button
              onClick={() => setShowReportModal(true)}
              style={{
                ...styles.settingsItem,
                backgroundColor: "transparent",
                padding: "12px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <ShieldAlert size={16} color="#f59e0b" />
              <span style={{ fontSize: "13px", color: "#f59e0b" }}>Report Contact</span>
            </button>

            {/* Block Contact */}
            <button
              onClick={() => setShowBlockConfirm(true)}
              style={{
                ...styles.settingsItem,
                backgroundColor: "transparent",
                padding: "12px 14px",
                cursor: "pointer"
              }}
            >
              <AlertTriangle size={16} color={THEME.danger} />
              <span style={{ fontSize: "13px", color: THEME.danger, fontWeight: "700" }}>
                Block {peerName}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* --- SUB-MODAL: DISAPPEARING MESSAGES OPTIONS (Point 17) --- */}
      {showDisappearingModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "320px",
              padding: "14px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={16} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  Disappearing Messages
                </span>
              </div>
              <button onClick={() => setShowDisappearingModal(false)} style={styles.cleanBtn}>
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {DISAPPEARING_OPTIONS.map((opt) => {
                const isSelected = disappearingTimer === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelectDisappearingOption(opt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      backgroundColor: isSelected ? THEME.cardHover : "transparent",
                      cursor: "pointer"
                    }}
                  >
                    <span style={{ fontSize: "13px", color: THEME.text }}>{opt.label}</span>
                    {isSelected && <Check size={16} color={THEME.primary} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-MODAL: CHAT LOCK 4-DIGIT PIN SETUP (Point 10) --- */}
      {showLockPinModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "320px",
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={16} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  Set 4-Digit Chat PIN
                </span>
              </div>
              <button onClick={() => setShowLockPinModal(false)} style={styles.cleanBtn}>
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN (e.g. 1234)"
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  textAlign: "center",
                  fontSize: "18px",
                  color: THEME.text,
                  letterSpacing: "4px"
                }}
              />

              <input
                type="password"
                maxLength={6}
                value={pinConfirmInput}
                onChange={(e) => setPinConfirmInput(e.target.value)}
                placeholder="Confirm PIN"
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  textAlign: "center",
                  fontSize: "18px",
                  color: THEME.text,
                  letterSpacing: "4px"
                }}
              />

              {pinError && (
                <div style={{ fontSize: "12px", color: THEME.danger, textAlign: "center" }}>
                  {pinError}
                </div>
              )}

              <button
                onClick={handleSavePin}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.accent,
                  padding: "10px",
                  marginTop: "4px"
                }}
              >
                Lock Chat Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-MODAL: CLEAR CHAT CONFIRMATION --- */}
      {showClearConfirm && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "300px",
              padding: "16px",
              textAlign: "center"
            }}
          >
            <Trash2 size={32} color={THEME.danger} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: "14px", fontWeight: "700", color: THEME.text }}>
              Clear this chat?
            </div>
            <div style={{ fontSize: "12px", color: THEME.textMuted, margin: "6px 0 16px" }}>
              Messages will be cleared from this conversation thread.
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{ ...styles.pillBtn, flex: 1, backgroundColor: THEME.card, color: THEME.textMuted }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onClearChat) onClearChat();
                  setShowClearConfirm(false);
                }}
                style={{ ...styles.primaryBtn, flex: 1, backgroundColor: THEME.danger }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-MODAL: BLOCK USER CONFIRMATION --- */}
      {showBlockConfirm && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "300px",
              padding: "16px",
              textAlign: "center"
            }}
          >
            <AlertTriangle size={32} color={THEME.danger} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: "14px", fontWeight: "700", color: THEME.text }}>
              Block {peerName}?
            </div>
            <div style={{ fontSize: "12px", color: THEME.textMuted, margin: "6px 0 16px" }}>
              Blocked contacts will no longer be able to call you or send you messages.
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowBlockConfirm(false)}
                style={{ ...styles.pillBtn, flex: 1, backgroundColor: THEME.card, color: THEME.textMuted }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                style={{ ...styles.primaryBtn, flex: 1, backgroundColor: THEME.danger }}
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-MODAL: REPORT USER --- */}
      {showReportModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "320px",
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                Report {peerName}
              </span>
              <button onClick={() => setShowReportModal(false)} style={styles.cleanBtn}>
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "8px",
                  color: THEME.text,
                  fontSize: "13px"
                }}
              >
                <option value="spam">Spam / Scam</option>
                <option value="harassment">Harassment or Bullying</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="impersonation">Impersonation</option>
                <option value="other">Other</option>
              </select>

              <button
                onClick={handleSubmitReport}
                style={{ ...styles.primaryBtn, backgroundColor: THEME.danger, padding: "10px" }}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
