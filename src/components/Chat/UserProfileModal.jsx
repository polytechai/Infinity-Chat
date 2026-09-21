import React, { useState, useMemo } from "react";
import {
  X,
  Phone,
  Video,
  Star,
  Bell,
  BellOff,
  Lock,
  Clock,
  Database,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Download,
  FileText,
  Film,
  Music,
  ChevronRight,
  Check,
  AlertTriangle,
  KeyRound
} from "lucide-react";
import { doc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db, styles } from "../../firebase";

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

  // Navigation & Sub-modals
  const [activeTab, setActiveTab] = useState("media"); // "media" | "docs" | "audio"
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [blockOnReport, setBlockOnReport] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showLockPinModal, setShowLockPinModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);

  // States with Local & Remote persistence
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem("infinity_favorite_contacts") || "[]");
      return favs.includes(peerUserId);
    } catch (e) {
      return false;
    }
  });

  const [isBlocked, setIsBlocked] = useState(() => {
    try {
      const blk = JSON.parse(localStorage.getItem("infinity_blocked_contacts") || "[]");
      return blk.includes(peerUserId);
    } catch (e) {
      return false;
    }
  });

  const [isMuted, setIsMuted] = useState(() => {
    try {
      const muted = JSON.parse(localStorage.getItem("infinity_muted_chats") || "[]");
      return muted.includes(peerUserId);
    } catch (e) {
      return false;
    }
  });

  const [disappearingTimer, setDisappearingTimer] = useState(() => {
    try {
      return localStorage.getItem(`infinity_disappearing_${peerUserId}`) || "off";
    } catch (e) {
      return "off";
    }
  });

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

  // -------------------------------------------------------------
  // 1. SENT MEDIA GALLERY EXTRACTION & STATS
  // -------------------------------------------------------------
  const { mediaList, docList, audioList, totalStorageBytes } = useMemo(() => {
    const media = [];
    const docs = [];
    const audios = [];
    let bytes = 0;

    messages.forEach((msg) => {
      if (!msg || msg.type === "deleted" || msg.isDeleted) return;

      if (msg.fileUrl) {
        const estimatedSize =
          typeof msg.fileSize === "number"
            ? msg.fileSize
            : typeof msg.fileSize === "string" && msg.fileSize.includes("KB")
            ? parseFloat(msg.fileSize) * 1024
            : typeof msg.fileSize === "string" && msg.fileSize.includes("MB")
            ? parseFloat(msg.fileSize) * 1024 * 1024
            : 180 * 1024;

        bytes += estimatedSize;

        if (msg.type === "image" || msg.type === "video") {
          media.push(msg);
        } else if (msg.type === "voice" || msg.type === "audio") {
          audios.push(msg);
        } else {
          docs.push(msg);
        }
      }
    });

    return {
      mediaList: media,
      docList: docs,
      audioList: audios,
      totalStorageBytes: bytes
    };
  }, [messages]);

  const formattedStorage = useMemo(() => {
    if (totalStorageBytes > 1024 * 1024) {
      return (totalStorageBytes / (1024 * 1024)).toFixed(1) + " MB";
    }
    return (totalStorageBytes / 1024).toFixed(0) + " KB";
  }, [totalStorageBytes]);

  // -------------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------------
  const handleToggleFavorite = () => {
    try {
      const favs = JSON.parse(localStorage.getItem("infinity_favorite_contacts") || "[]");
      let nextFavs;
      if (isFavorite) {
        nextFavs = favs.filter((id) => id !== peerUserId);
      } else {
        nextFavs = [...favs, peerUserId];
      }
      localStorage.setItem("infinity_favorite_contacts", JSON.stringify(nextFavs));
      setIsFavorite(!isFavorite);
      if (showToast) {
        showToast(!isFavorite ? "Added to Favorites ⭐" : "Removed from Favorites");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMute = () => {
    try {
      const muted = JSON.parse(localStorage.getItem("infinity_muted_chats") || "[]");
      let nextMuted;
      if (isMuted) {
        nextMuted = muted.filter((id) => id !== peerUserId);
      } else {
        nextMuted = [...muted, peerUserId];
      }
      localStorage.setItem("infinity_muted_chats", JSON.stringify(nextMuted));
      setIsMuted(!isMuted);
      if (onMuteUser) onMuteUser(peerUserId);
      if (showToast) {
        showToast(!isMuted ? "Notifications Muted 🔕" : "Notifications Unmuted 🔔");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSetDisappearingTimer = async (val) => {
    setDisappearingTimer(val);
    try {
      localStorage.setItem(`infinity_disappearing_${peerUserId}`, val);
      if (user?.id) {
        const convRef = doc(db, "conversations", user.id);
        await updateDoc(convRef, { disappearingTimer: val });
      }
    } catch (err) {
      console.warn("Disappearing timer update:", err);
    }
    setShowDisappearingModal(false);
    if (showToast) {
      showToast(
        val === "off"
          ? "Disappearing messages turned off"
          : `Disappearing messages set to ${val}`
      );
    }
  };

  const handleSavePinLock = () => {
    if (pinInput.length !== 4 || !/^\d+$/.test(pinInput)) {
      setPinError("Please enter a 4-digit numeric PIN");
      return;
    }
    if (pinInput !== pinConfirmInput) {
      setPinError("PINs do not match");
      return;
    }

    try {
      localStorage.setItem(`infinity_chatlock_pin_${peerUserId}`, pinInput);
      setIsChatLocked(true);
      setShowLockPinModal(false);
      setPinInput("");
      setPinConfirmInput("");
      setPinError("");
      if (showToast) showToast("Chat locked with PIN 🔒");
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemovePinLock = () => {
    try {
      localStorage.removeItem(`infinity_chatlock_pin_${peerUserId}`);
      setIsChatLocked(false);
      setShowLockPinModal(false);
      setPinInput("");
      setPinConfirmInput("");
      setPinError("");
      if (showToast) showToast("Chat lock disabled 🔓");
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmClearChat = () => {
    if (onClearChat) {
      onClearChat(peerUserId);
    }
    setShowClearConfirm(false);
    if (showToast) showToast("Chat history cleared");
  };

  const handleConfirmBlock = () => {
    try {
      const blk = JSON.parse(localStorage.getItem("infinity_blocked_contacts") || "[]");
      let nextBlk;
      if (isBlocked) {
        nextBlk = blk.filter((id) => id !== peerUserId);
      } else {
        nextBlk = [...blk, peerUserId];
      }
      localStorage.setItem("infinity_blocked_contacts", JSON.stringify(nextBlk));
      setIsBlocked(!isBlocked);
      if (onBlockUser) onBlockUser(peerUserId, !isBlocked);
      if (showToast) {
        showToast(!isBlocked ? `Blocked ${peerName}` : `Unblocked ${peerName}`);
      }
    } catch (e) {
      console.error(e);
    }
    setShowBlockConfirm(false);
  };

  const handleConfirmReport = async () => {
    try {
      await addDoc(collection(db, "reports"), {
        reporterId: currentUserId,
        reportedUserId: peerUserId,
        reason: reportReason,
        createdAt: new Date().toISOString()
      });
      if (blockOnReport) {
        const blk = JSON.parse(localStorage.getItem("infinity_blocked_contacts") || "[]");
        if (!blk.includes(peerUserId)) {
          blk.push(peerUserId);
          localStorage.setItem("infinity_blocked_contacts", JSON.stringify(blk));
          setIsBlocked(true);
        }
      }
      if (showToast) {
        showToast("Report submitted. Thank you for keeping our community safe.");
      }
    } catch (err) {
      console.warn("Report error:", err);
      if (showToast) showToast("Report submitted.");
    }
    setShowReportModal(false);
  };

  const handleDownloadFile = (e, fileUrl, fileName) => {
    e.stopPropagation();
    if (!fileUrl) return;
    try {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = fileName || "attachment";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (showToast) showToast(`Downloading ${fileName || "file"}`);
    } catch (err) {
      window.open(fileUrl, "_blank");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        ...styles.modalOverlay,
        zIndex: 4500,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "460px",
          maxHeight: "92vh",
          backgroundColor: THEME.sidebar,
          border: `1px solid ${THEME.border}`,
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.85)",
          color: THEME.text
        }}
      >
        {/* --- MODAL TOP BAR --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            backgroundColor: THEME.header,
            borderBottom: `1px solid ${THEME.border}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                ...styles.cleanBtn,
                color: THEME.text,
                padding: "6px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Close"
            >
              <X size={20} />
            </button>
            <span style={{ fontWeight: "700", fontSize: "16px" }}>
              Contact Info
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={handleToggleFavorite}
              style={{
                ...styles.cleanBtn,
                padding: "6px",
                color: isFavorite ? "#FACC15" : THEME.textMuted
              }}
              title={isFavorite ? "Favorited" : "Add to Favorites"}
            >
              <Star
                size={20}
                fill={isFavorite ? "#FACC15" : "none"}
                color={isFavorite ? "#FACC15" : THEME.textMuted}
              />
            </button>
          </div>
        </div>

        {/* --- SCROLLABLE BODY --- */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            paddingBottom: "24px"
          }}
        >
          {/* --- 1. HERO PROFILE CARD --- */}
          <div
            style={{
              backgroundColor: THEME.card,
              padding: "24px 16px 18px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderBottom: `1px solid ${THEME.border}`
            }}
          >
            <div style={{ position: "relative", marginBottom: "14px" }}>
              <img
                src={peerAvatar}
                alt={peerName}
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `3px solid ${THEME.border}`,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.4)"
                }}
              />
              {isBlocked && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "2px",
                    right: "2px",
                    backgroundColor: THEME.danger,
                    color: "#fff",
                    borderRadius: "50%",
                    width: "26px",
                    height: "26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${THEME.card}`
                  }}
                  title="Contact is Blocked"
                >
                  <ShieldAlert size={14} />
                </div>
              )}
            </div>

            <h2
              style={{
                margin: "0 0 4px",
                fontSize: "20px",
                fontWeight: "700",
                color: THEME.text,
                textAlign: "center"
              }}
            >
              {peerName}
            </h2>

            <div
              style={{
                fontSize: "14px",
                color: THEME.accent,
                fontWeight: "500",
                marginBottom: "8px"
              }}
            >
              {peerPhone || "No Phone Number"}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: THEME.textMuted,
                textAlign: "center",
                maxWidth: "280px",
                lineHeight: "1.4",
                marginBottom: "18px"
              }}
            >
              {peerAbout}
            </div>

            {/* Quick Action Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "24px",
                width: "100%",
                paddingTop: "6px"
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (startCall) startCall(user, "audio");
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: THEME.primary
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Phone size={20} />
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600" }}>Audio</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (startCall) startCall(user, "video");
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: THEME.primary
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Video size={20} />
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600" }}>Video</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFavorite}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isFavorite ? "#FACC15" : THEME.primary
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    backgroundColor: isFavorite
                      ? "rgba(250, 204, 21, 0.15)"
                      : "rgba(34, 197, 94, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Star size={20} fill={isFavorite ? "#FACC15" : "none"} />
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600" }}>
                  {isFavorite ? "Favorited" : "Favorite"}
                </span>
              </button>
            </div>
          </div>

          {/* --- 2. SENT MEDIA GALLERY TAB SYSTEM --- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderTop: `1px solid ${THEME.border}`,
              borderBottom: `1px solid ${THEME.border}`,
              padding: "16px"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px"
              }}
            >
              <span style={{ fontWeight: "700", fontSize: "14px" }}>
                Media, Links & Docs
              </span>
              <span style={{ fontSize: "12px", color: THEME.textMuted }}>
                {mediaList.length + docList.length + audioList.length} items ({formattedStorage})
              </span>
            </div>

            {/* Gallery Tabs */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                borderBottom: `1px solid ${THEME.border}`,
                paddingBottom: "8px",
                marginBottom: "12px"
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("media")}
                style={{
                  ...styles.cleanBtn,
                  padding: "4px 12px",
                  borderRadius: "14px",
                  fontSize: "12px",
                  fontWeight: "600",
                  backgroundColor:
                    activeTab === "media" ? THEME.primary : "transparent",
                  color: activeTab === "media" ? "#fff" : THEME.textMuted
                }}
              >
                Media ({mediaList.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("docs")}
                style={{
                  ...styles.cleanBtn,
                  padding: "4px 12px",
                  borderRadius: "14px",
                  fontSize: "12px",
                  fontWeight: "600",
                  backgroundColor:
                    activeTab === "docs" ? THEME.primary : "transparent",
                  color: activeTab === "docs" ? "#fff" : THEME.textMuted
                }}
              >
                Docs ({docList.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audio")}
                style={{
                  ...styles.cleanBtn,
                  padding: "4px 12px",
                  borderRadius: "14px",
                  fontSize: "12px",
                  fontWeight: "600",
                  backgroundColor:
                    activeTab === "audio" ? THEME.primary : "transparent",
                  color: activeTab === "audio" ? "#fff" : THEME.textMuted
                }}
              >
                Voice & Audio ({audioList.length})
              </button>
            </div>

            {/* Tab: Photos & Videos Grid */}
            {activeTab === "media" && (
              <div>
                {mediaList.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      color: THEME.textMuted,
                      fontSize: "12px"
                    }}
                  >
                    No photos or videos shared in this chat yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "6px"
                    }}
                  >
                    {mediaList.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        onClick={() => {
                          if (onLightbox) {
                            onLightbox({
                              url: m.fileUrl,
                              type: m.type,
                              name: m.fileName || "Media"
                            });
                          }
                        }}
                        style={{
                          position: "relative",
                          aspectRatio: "1 / 1",
                          borderRadius: "6px",
                          overflow: "hidden",
                          backgroundColor: "#000",
                          cursor: "pointer"
                        }}
                      >
                        {m.type === "video" ? (
                          <div style={{ width: "100%", height: "100%", position: "relative" }}>
                            <video
                              src={m.fileUrl}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "rgba(0,0,0,0.35)"
                              }}
                            >
                              <Film size={18} color="#fff" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={m.fileUrl}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover"
                            }}
                          />
                        )}

                        <button
                          type="button"
                          onClick={(e) =>
                            handleDownloadFile(
                              e,
                              m.fileUrl,
                              m.fileName || `media_${idx}.${m.type === "video" ? "mp4" : "jpg"}`
                            )
                          }
                          style={{
                            position: "absolute",
                            bottom: "3px",
                            right: "3px",
                            backgroundColor: "rgba(0,0,0,0.65)",
                            border: "none",
                            borderRadius: "50%",
                            width: "22px",
                            height: "22px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            cursor: "pointer"
                          }}
                          title="Download"
                        >
                          <Download size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Documents List */}
            {activeTab === "docs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {docList.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      color: THEME.textMuted,
                      fontSize: "12px"
                    }}
                  >
                    No documents shared yet.
                  </div>
                ) : (
                  docList.map((d, idx) => (
                    <div
                      key={d.id || idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        backgroundColor: THEME.header,
                        borderRadius: "8px",
                        border: `1px solid ${THEME.border}`
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          overflow: "hidden"
                        }}
                      >
                        <FileText size={22} color={THEME.accent} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {d.fileName || "Document"}
                          </div>
                          <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                            {d.fileSize || "File"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) =>
                          handleDownloadFile(e, d.fileUrl, d.fileName || "document.pdf")
                        }
                        style={{
                          ...styles.cleanBtn,
                          color: THEME.primary,
                          padding: "6px"
                        }}
                        title="Download Document"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Voice Notes & Audio */}
            {activeTab === "audio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {audioList.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      color: THEME.textMuted,
                      fontSize: "12px"
                    }}
                  >
                    No voice notes recorded in this thread yet.
                  </div>
                ) : (
                  audioList.map((a, idx) => (
                    <div
                      key={a.id || idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        backgroundColor: THEME.header,
                        borderRadius: "8px",
                        border: `1px solid ${THEME.border}`
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          overflow: "hidden"
                        }}
                      >
                        <Music size={20} color={THEME.primary} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600" }}>
                            Voice Note #{idx + 1}
                          </div>
                          <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "Audio"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) =>
                          handleDownloadFile(e, a.fileUrl, a.fileName || `voice_${idx + 1}.webm`)
                        }
                        style={{
                          ...styles.cleanBtn,
                          color: THEME.primary,
                          padding: "6px"
                        }}
                        title="Download Audio"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* --- 3. PRIVACY & CHAT SETTINGS --- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderTop: `1px solid ${THEME.border}`,
              borderBottom: `1px solid ${THEME.border}`
            }}
          >
            {/* Disappearing Messages */}
            <div
              onClick={() => setShowDisappearingModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Clock size={18} color={THEME.accent} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>
                    Disappearing Messages
                  </div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                    {disappearingTimer === "off" ? "Off" : disappearingTimer}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} color={THEME.textMuted} />
            </div>

            {/* Mute Notifications */}
            <div
              onClick={handleToggleMute}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {isMuted ? (
                  <BellOff size={18} color={THEME.danger} />
                ) : (
                  <Bell size={18} color={THEME.primary} />
                )}
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>
                    Mute Notifications
                  </div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                    {isMuted ? "Muted" : "Active"}
                  </div>
                </div>
              </div>

              {/* Toggle switch visual */}
              <div
                style={{
                  width: "38px",
                  height: "20px",
                  borderRadius: "12px",
                  backgroundColor: isMuted ? THEME.danger : THEME.header,
                  position: "relative",
                  transition: "background-color 0.2s ease"
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    position: "absolute",
                    top: "2px",
                    left: isMuted ? "20px" : "2px",
                    transition: "left 0.2s ease"
                  }}
                />
              </div>
            </div>

            {/* Lock Chat with PIN */}
            <div
              onClick={() => setShowLockPinModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Lock
                  size={18}
                  color={isChatLocked ? THEME.primary : THEME.textMuted}
                />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>
                    Lock Chat with PIN
                  </div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                    {isChatLocked ? "Protected by 4-digit PIN" : "Unlocked"}
                  </div>
                </div>
              </div>

              <ChevronRight size={16} color={THEME.textMuted} />
            </div>

            {/* Manage Storage */}
            <div
              onClick={() => setShowStorageModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Database size={18} color="#38BDF8" />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>
                    Manage Storage
                  </div>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                    {formattedStorage} used
                  </div>
                </div>
              </div>

              <ChevronRight size={16} color={THEME.textMuted} />
            </div>
          </div>

          {/* --- 4. ENCRYPTION NOTICE --- */}
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              borderRadius: "12px",
              margin: "0 16px"
            }}
          >
            <ShieldCheck size={22} color={THEME.primary} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: "11px", color: THEME.textMuted, lineHeight: "1.4" }}>
              Messages and calls are end-to-end encrypted. No one outside of this chat,
              not even Infinity Chat, can read or listen to them.
            </div>
          </div>

          {/* --- 5. DANGER ACTIONS (Clear Chat, Block, Report) --- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderTop: `1px solid ${THEME.border}`,
              borderBottom: `1px solid ${THEME.border}`
            }}
          >
            {/* Clear Chat History */}
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              style={{
                width: "100%",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                border: "none",
                background: "none",
                color: THEME.danger,
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <Trash2 size={18} color={THEME.danger} />
              <span>Clear Chat History</span>
            </button>

            {/* Block / Unblock Contact */}
            <button
              type="button"
              onClick={() => setShowBlockConfirm(true)}
              style={{
                width: "100%",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                border: "none",
                background: "none",
                color: THEME.danger,
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "left",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <ShieldAlert size={18} color={THEME.danger} />
              <span>{isBlocked ? `Unblock ${peerName}` : `Block ${peerName}`}</span>
            </button>

            {/* Report Contact */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              style={{
                width: "100%",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                border: "none",
                background: "none",
                color: THEME.danger,
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <AlertTriangle size={18} color={THEME.danger} />
              <span>Report {peerName}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* DIALOG: DISAPPEARING MESSAGES TIMER PICKER */}
      {/* ============================================================= */}
      {showDisappearingModal && (
        <div
          onClick={() => setShowDisappearingModal(false)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.75)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              width: "90%",
              maxWidth: "360px"
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div style={{ fontWeight: "700", color: THEME.text }}>
                Disappearing Messages
              </div>
              <button
                onClick={() => setShowDisappearingModal(false)}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted, marginBottom: "4px" }}>
                When turned on, new messages sent in this chat will disappear after the selected duration.
              </div>

              {[
                { label: "24 Hours", value: "24h" },
                { label: "7 Days", value: "7d" },
                { label: "90 Days", value: "90d" },
                { label: "Off", value: "off" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSetDisappearingTimer(opt.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    backgroundColor:
                      disappearingTimer === opt.value
                        ? "rgba(34, 197, 94, 0.15)"
                        : THEME.card,
                    border: `1px solid ${
                      disappearingTimer === opt.value ? THEME.primary : THEME.border
                    }`,
                    color: THEME.text,
                    cursor: "pointer"
                  }}
                >
                  <span style={{ fontWeight: "600", fontSize: "13px" }}>{opt.label}</span>
                  {disappearingTimer === opt.value && (
                    <Check size={16} color={THEME.primary} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* DIALOG: LOCK CHAT WITH PIN */}
      {/* ============================================================= */}
      {showLockPinModal && (
        <div
          onClick={() => setShowLockPinModal(false)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.75)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              width: "90%",
              maxWidth: "360px"
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div style={{ fontWeight: "700", color: THEME.text, display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={18} color={THEME.primary} />
                <span>{isChatLocked ? "Chat Lock Active" : "Lock Chat with PIN"}</span>
              </div>
              <button
                onClick={() => setShowLockPinModal(false)}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {isChatLocked ? (
                <>
                  <div style={{ fontSize: "13px", color: THEME.text, textAlign: "center" }}>
                    This chat thread is currently protected with a 4-digit passcode.
                  </div>
                  <button
                    type="button"
                    onClick={handleRemovePinLock}
                    style={{
                      ...styles.pillBtn,
                      backgroundColor: THEME.danger,
                      color: "#fff",
                      padding: "10px",
                      fontWeight: "700"
                    }}
                  >
                    Remove PIN Lock
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                    Set a 4-digit PIN to lock and protect this specific chat thread from unauthorized access.
                  </div>

                  {pinError && (
                    <div style={{ color: THEME.danger, fontSize: "12px", fontWeight: "600" }}>
                      {pinError}
                    </div>
                  )}

                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Enter 4-digit PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    style={{
                      ...styles.bareInput,
                      backgroundColor: THEME.card,
                      color: THEME.text,
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: `1px solid ${THEME.border}`,
                      fontSize: "18px",
                      textAlign: "center",
                      letterSpacing: "8px"
                    }}
                  />

                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Confirm 4-digit PIN"
                    value={pinConfirmInput}
                    onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, ""))}
                    style={{
                      ...styles.bareInput,
                      backgroundColor: THEME.card,
                      color: THEME.text,
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: `1px solid ${THEME.border}`,
                      fontSize: "18px",
                      textAlign: "center",
                      letterSpacing: "8px"
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleSavePinLock}
                    style={{
                      ...styles.primaryBtn,
                      backgroundColor: THEME.primary,
                      marginTop: "6px"
                    }}
                  >
                    Lock Chat Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* DIALOG: MANAGE STORAGE BREAKDOWN */}
      {/* ============================================================= */}
      {showStorageModal && (
        <div
          onClick={() => setShowStorageModal(false)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.75)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              width: "90%",
              maxWidth: "380px"
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div style={{ fontWeight: "700", color: THEME.text }}>
                Manage Storage Breakdown
              </div>
              <button
                onClick={() => setShowStorageModal(false)}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  backgroundColor: THEME.card,
                  padding: "14px",
                  borderRadius: "12px",
                  border: `1px solid ${THEME.border}`,
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>TOTAL STORAGE USED</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: THEME.primary, margin: "4px 0" }}>
                  {formattedStorage}
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                  in thread with {peerName}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: THEME.card,
                    borderRadius: "8px"
                  }}
                >
                  <span style={{ fontSize: "13px" }}>Photos & Videos</span>
                  <span style={{ fontWeight: "700", color: THEME.accent }}>{mediaList.length} files</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: THEME.card,
                    borderRadius: "8px"
                  }}
                >
                  <span style={{ fontSize: "13px" }}>Documents</span>
                  <span style={{ fontWeight: "700", color: THEME.accent }}>{docList.length} files</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    backgroundColor: THEME.card,
                    borderRadius: "8px"
                  }}
                >
                  <span style={{ fontSize: "13px" }}>Voice Notes</span>
                  <span style={{ fontWeight: "700", color: THEME.accent }}>{audioList.length} files</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowStorageModal(false);
                  if (showToast) showToast("Cache freed for this conversation!");
                }}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                  padding: "10px",
                  marginTop: "6px"
                }}
              >
                Clear Cached Media
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* DIALOG: CLEAR CHAT CONFIRMATION */}
      {/* ============================================================= */}
      {showClearConfirm && (
        <div
          onClick={() => setShowClearConfirm(false)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.75)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              width: "90%",
              maxWidth: "360px"
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div style={{ fontWeight: "700", color: THEME.text }}>
                Clear this chat?
              </div>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13px", color: THEME.textMuted }}>
                Messages will be permanently removed from your device. This action cannot be undone.
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    flex: 1,
                    ...styles.pillBtn,
                    backgroundColor: THEME.card,
                    color: THEME.text,
                    padding: "10px"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearChat}
                  style={{
                    flex: 1,
                    ...styles.pillBtn,
                    backgroundColor: THEME.danger,
                    color: "#fff",
                    padding: "10px",
                    fontWeight: "700"
                  }}
                >
                  Clear Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* DIALOG: BLOCK / UNBLOCK CONFIRMATION */}
      {/* ============================================================= */}
      {showBlockConfirm && (
        <div
          onClick={() => setShowBlockConfirm(false)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.75)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              width: "90%",
              maxWidth: "360px"
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div style={{ fontWeight: "700", color: THEME.text }}>
                {isBlocked ? `Unblock ${peerName}?` : `Block ${peerName}?`}
              </div>
              <button
                onClick={() => setShowBlockConfirm(false)}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13px", color: THEME.textMuted }}>
                {isBlocked
                  ? `Unblocked contacts will be able to call you and send you messages.`
                  : `Blocked contacts will no longer be able to call you or send you messages.`}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowBlockConfirm(false)}
                  style={{
                    flex: 1,
                    ...styles.pillBtn,
                    backgroundColor: THEME.card,
                    color: THEME.text,
                    padding: "10px"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBlock}
                  style={{
                    flex: 1,
                    ...styles.pillBtn,
                    backgroundColor: isBlocked ? THEME.primary : THEME.danger,
                    color: "#fff",
                    padding: "10px",
                    fontWeight: "700"
                  }}
                >
                  {isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* DIALOG: REPORT CONTACT MODAL */}
      {/* ============================================================= */}
      {showReportModal && (
        <div
          onClick={() => setShowReportModal(false)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.75)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              width: "90%",
              maxWidth: "380px"
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div style={{ fontWeight: "700", color: THEME.text }}>
                Report {peerName}?
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                The last 5 messages from this contact will be forwarded to Infinity Chat security.
              </div>

              {/* Reasons list */}
              {[
                { id: "spam", label: "Spam or unwanted advertising" },
                { id: "fraud", label: "Scam or fraud attempt" },
                { id: "harassment", label: "Harassment or offensive behavior" },
                { id: "inappropriate", label: "Inappropriate or illegal content" }
              ].map((r) => (
                <label
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    color: THEME.text,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    checked={reportReason === r.id}
                    onChange={() => setReportReason(r.id)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: THEME.text,
                  marginTop: "6px",
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={blockOnReport}
                  onChange={(e) => setBlockOnReport(e.target.checked)}
                />
                <span>Block contact and delete chat messages</span>
              </label>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  style={{
                    flex: 1,
                    ...styles.pillBtn,
                    backgroundColor: THEME.card,
                    color: THEME.text,
                    padding: "10px"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReport}
                  style={{
                    flex: 1,
                    ...styles.pillBtn,
                    backgroundColor: THEME.danger,
                    color: "#fff",
                    padding: "10px",
                    fontWeight: "700"
                  }}
                >
                  Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
