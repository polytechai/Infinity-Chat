import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";
import {
  MessageSquare,
  Search,
  Pin,
  BellOff,
  Archive,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  X,
  Users,
  FolderLock,
  ChevronRight
} from "lucide-react";
import { db, styles, normalizePhone } from "../../firebase";

export default function ChatList({
  currentUser,
  activeChat,
  setActiveChat,
  setMobileView,
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
  t = {},
  pinnedChats = [],
  onTogglePin,
  mutedChats = [],
  onToggleMute,
  showToast
}) {
  // Scoped User ID for Strict Isolation
  const myUserId =
    currentUser?.uid || currentUser?.id || normalizePhone(currentUser?.phone) || "";

  // Component States
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Long-press Bottom Sheet Action States
  const [selectedChatForAction, setSelectedChatForAction] = useState(null);
  const longPressTimerRef = useRef(null);

  // Private Archived Chats
  const [archivedChatIds, setArchivedChatIds] = useState(() => {
    try {
      const stored = localStorage.getItem(`infinity_archived_chats_${myUserId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Locked Chats Folder States (Point 10)
  const [lockedChatIds, setLockedChatIds] = useState(() => {
    const list = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("infinity_chatlock_pin_")) {
          const peerId = key.replace("infinity_chatlock_pin_", "");
          list.push(peerId);
        }
      }
    } catch (e) {}
    return list;
  });
  const [isLockedFolderOpen, setIsLockedFolderOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [targetLockedChatToOpen, setTargetLockedChatToOpen] = useState(null);

  // -------------------------------------------------------------
  // 1. STRICT USER ISOLATION (Point 1)
  // Fetch conversations where `participants` array contains `currentUser.uid`.
  // New accounts show strictly 0 conversations until contacted/added.
  // -------------------------------------------------------------
  useEffect(() => {
    if (!myUserId || !db) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const convQuery = query(
      collection(db, "conversations"),
      where("participants", "array-contains", myUserId)
    );

    const unsubscribe = onSnapshot(
      convQuery,
      (snapshot) => {
        const convList = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // Honor thread deletion for current user
          if (data.deletedFor && Array.isArray(data.deletedFor) && data.deletedFor.includes(myUserId)) {
            return;
          }
          if (data.deletedFor && typeof data.deletedFor === "object" && data.deletedFor[myUserId]) {
            return;
          }

          // Compute Display Name, Peer Phone, and Avatar
          let displayName = data.name || data.groupName || "Chat";
          let displayAvatar = data.avatar || data.groupAvatar || "";
          let peerPhone = "";

          if (!data.isGroup && Array.isArray(data.participants)) {
            const otherParticipantId = data.participants.find((p) => p !== myUserId) || "";
            peerPhone = otherParticipantId;
            if (data.participantDetails && data.participantDetails[otherParticipantId]) {
              displayName = data.participantDetails[otherParticipantId].name || otherParticipantId;
              displayAvatar = data.participantDetails[otherParticipantId].avatar || "";
            } else if (!data.name) {
              displayName = otherParticipantId;
            }
          }

          if (!displayAvatar) {
            displayAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${docSnap.id}`;
          }

          // Unread Count Badge Calculation (Point 3)
          let unreadCount = 0;
          if (data.unreadCounts && typeof data.unreadCounts[myUserId] === "number") {
            unreadCount = data.unreadCounts[myUserId];
          } else if (
            data.lastSenderId &&
            data.lastSenderId !== myUserId &&
            data.readBy &&
            Array.isArray(data.readBy) &&
            !data.readBy.includes(myUserId)
          ) {
            unreadCount = 1;
          }

          convList.push({
            id: docSnap.id,
            ...data,
            displayName,
            displayAvatar,
            peerPhone,
            unreadCount
          });
        });

        // Sort by timestamp descending
        convList.sort((a, b) => {
          const timeA = a.lastMessageTimestamp || (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
          const timeB = b.lastMessageTimestamp || (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
          return timeB - timeA;
        });

        setConversations(convList);
        setLoading(false);
      },
      (err) => {
        console.warn("Conversations listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [myUserId]);

  // -------------------------------------------------------------
  // 2. LONG-PRESS ACTIONS (~500ms) (Pin, Mute, Archive, Delete)
  // -------------------------------------------------------------
  const handleTouchStart = (chat) => {
    longPressTimerRef.current = setTimeout(() => {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
      setSelectedChatForAction(chat);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleToggleArchive = (chatId) => {
    let next;
    if (archivedChatIds.includes(chatId)) {
      next = archivedChatIds.filter((id) => id !== chatId);
      showToast?.("Chat unarchived");
    } else {
      next = [...archivedChatIds, chatId];
      showToast?.("Chat archived 📦");
    }
    setArchivedChatIds(next);
    localStorage.setItem(`infinity_archived_chats_${myUserId}`, JSON.stringify(next));
    setSelectedChatForAction(null);
  };

  const handleDeletePermanently = async (chat) => {
    if (!chat || !chat.id) return;
    try {
      const convRef = doc(db, "conversations", chat.id);
      await updateDoc(convRef, {
        [`deletedFor.${myUserId}`]: true
      });
      setConversations((prev) => prev.filter((c) => c.id !== chat.id));
      showToast?.("Chat permanently removed for you");
    } catch (err) {
      console.warn("Delete chat error:", err);
      setConversations((prev) => prev.filter((c) => c.id !== chat.id));
      showToast?.("Chat removed from your list");
    }
    setSelectedChatForAction(null);
  };

  // -------------------------------------------------------------
  // 3. CHAT CLICK & UNREAD BADGE RESET
  // -------------------------------------------------------------
  const handleChatClick = (chat) => {
    const targetPeerId = chat.peerPhone || chat.id;
    const isLocked = lockedChatIds.includes(targetPeerId);

    if (isLocked) {
      setTargetLockedChatToOpen(chat);
      setPinInput("");
      setPinError("");
      setShowPinModal(true);
      return;
    }

    openConversation(chat);
  };

  const openConversation = async (chat) => {
    const formatted = {
      id: chat.id,
      name: chat.displayName || chat.name || "Chat",
      avatar: chat.displayAvatar || chat.avatar,
      phone: chat.peerPhone || chat.phone || "",
      isGroup: !!chat.isGroup,
      participants: chat.participants || [myUserId, chat.id]
    };

    // Hide unread badge immediately in Firestore & UI
    try {
      const convRef = doc(db, "conversations", chat.id);
      await updateDoc(convRef, {
        [`unreadCounts.${myUserId}`]: 0,
        readBy: [myUserId]
      });
    } catch (e) {}

    setActiveChat(formatted);
    if (setMobileView) setMobileView("chat");
  };

  const handleVerifyPin = () => {
    if (!pinInput) {
      setPinError("Please enter your PIN");
      return;
    }

    if (targetLockedChatToOpen) {
      const targetPeerId = targetLockedChatToOpen.peerPhone || targetLockedChatToOpen.id;
      const expectedPin = localStorage.getItem(`infinity_chatlock_pin_${targetPeerId}`);
      if (expectedPin && pinInput !== expectedPin) {
        setPinError("Incorrect PIN");
        return;
      }
      setShowPinModal(false);
      openConversation(targetLockedChatToOpen);
      setTargetLockedChatToOpen(null);
    } else if (!isLockedFolderOpen) {
      // Unlocking the "Locked Chats" folder
      const userAppLockPin = localStorage.getItem(`infinity_applock_pin_${myUserId}`);
      const anyPin = lockedChatIds
        .map((id) => localStorage.getItem(`infinity_chatlock_pin_${id}`))
        .find((p) => !!p);

      if ((userAppLockPin && pinInput === userAppLockPin) || (anyPin && pinInput === anyPin)) {
        setIsLockedFolderOpen(true);
        setShowPinModal(false);
      } else {
        setPinError("Incorrect PIN passcode");
      }
    }
  };

  // Filter conversations based on search, archive status, and locked folder state
  const displayedConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (archivedChatIds.includes(c.id)) return false;
      const targetPeerId = c.peerPhone || c.id;
      if (lockedChatIds.includes(targetPeerId) && !isLockedFolderOpen) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.displayName?.toLowerCase().includes(term) ||
        c.peerPhone?.toLowerCase().includes(term) ||
        c.lastMessage?.toLowerCase().includes(term)
      );
    });
  }, [conversations, archivedChatIds, lockedChatIds, isLockedFolderOpen, searchTerm]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: THEME.sidebar,
        color: THEME.text,
        overflow: "hidden"
      }}
    >
      {/* Search Input Filter */}
      <div
        style={{
          padding: "10px 14px",
          backgroundColor: THEME.header,
          borderBottom: `1px solid ${THEME.border}`
        }}
      >
        <div
          style={{
            ...styles.searchWrap,
            backgroundColor: THEME.card,
            border: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "8px"
          }}
        >
          <Search size={16} color={THEME.textMuted} />
          <input
            type="text"
            placeholder={t?.searchPlaceholder || "Search chats..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...styles.bareInput,
              color: THEME.text,
              fontSize: "13px",
              width: "100%"
            }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={styles.cleanBtn}>
              <X size={14} color={THEME.textMuted} />
            </button>
          )}
        </div>
      </div>

      {/* Main Chat List Scroll Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
        {/* ------------------------------------------------------------- */}
        {/* 3. LOCKED CHATS SECTION (Point 10) */}
        {/* ------------------------------------------------------------- */}
        {lockedChatIds.length > 0 && (
          <div
            onClick={() => {
              if (isLockedFolderOpen) {
                setIsLockedFolderOpen(false);
              } else {
                setTargetLockedChatToOpen(null);
                setPinInput("");
                setPinError("");
                setShowPinModal(true);
              }
            }}
            style={{
              ...styles.contactItem,
              backgroundColor: isLockedFolderOpen ? THEME.cardHover : THEME.card,
              border: `1px solid ${THEME.border}`,
              borderRadius: "10px",
              marginBottom: "8px",
              cursor: "pointer",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                backgroundColor: "rgba(0, 168, 132, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: THEME.accent,
                flexShrink: 0
              }}
            >
              {isLockedFolderOpen ? <FolderLock size={22} /> : <Lock size={20} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: "700", fontSize: "13px", color: THEME.text }}>
                Locked Chats
              </div>
              <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                {isLockedFolderOpen
                  ? "Folder unlocked • Tap to hide"
                  : `${lockedChatIds.length} protected chat${lockedChatIds.length === 1 ? "" : "s"} • Tap to open`}
              </div>
            </div>

            <span
              style={{
                backgroundColor: THEME.accent,
                color: "#fff",
                fontSize: "11px",
                fontWeight: "800",
                padding: "2px 8px",
                borderRadius: "12px"
              }}
            >
              {lockedChatIds.length}
            </span>
          </div>
        )}

        {/* Loading Spinner / Indicator */}
        {loading && (
          <div style={{ textAlign: "center", padding: "30px 16px", color: THEME.textMuted, fontSize: "13px" }}>
            Loading conversations...
          </div>
        )}

        {/* 1. STRICT ISOLATION EMPTY ZERO-STATE (Point 1) */}
        {!loading && displayedConversations.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
            <MessageSquare size={38} style={{ margin: "0 auto 12px", opacity: 0.6, color: THEME.primary }} />
            <div style={{ fontSize: "14px", fontWeight: "700", color: THEME.text }}>
              No conversations yet
            </div>
            <div style={{ fontSize: "11px", marginTop: "6px", maxWidth: "260px", margin: "6px auto 0", lineHeight: "1.4" }}>
              Your account is isolated and private. Add a Bangladeshi mobile number or receive a message to begin.
            </div>
          </div>
        )}

        {/* Conversation Rows */}
        {!loading &&
          displayedConversations.map((chat) => {
            const isPinned = pinnedChats.includes(chat.id);
            const isMuted = mutedChats.includes(chat.id);
            const isGroup = !!chat.isGroup;
            const hasUnread = chat.unreadCount > 0;

            return (
              <div
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                onTouchStart={() => handleTouchStart(chat)}
                onTouchEnd={handleTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedChatForAction(chat);
                }}
                style={{
                  ...styles.contactItem,
                  backgroundColor: "transparent",
                  position: "relative",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease"
                }}
              >
                {/* Avatar with group badge */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={chat.displayAvatar}
                    alt=""
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                  {isGroup && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        right: "-2px",
                        backgroundColor: THEME.primary,
                        borderRadius: "50%",
                        width: "16px",
                        height: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1.5px solid ${THEME.sidebar}`
                      }}
                    >
                      <Users size={10} color="#fff" />
                    </div>
                  )}
                </div>

                {/* Name, Last message, and Timestamp */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontWeight: hasUnread ? "800" : "700",
                        fontSize: "13px",
                        color: THEME.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {chat.displayName}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {isPinned && <Pin size={12} color={THEME.primary} />}
                      {isMuted && <BellOff size={12} color={THEME.danger} />}
                      <span style={{ fontSize: "10px", color: hasUnread ? THEME.primary : THEME.textMuted }}>
                        {chat.lastMessageTimestamp
                          ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "2px"
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: hasUnread ? THEME.text : THEME.textMuted,
                        fontWeight: hasUnread ? "600" : "400",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "80%"
                      }}
                    >
                      {chat.lastMessage || (isGroup ? "Group conversation" : "Tap to start chatting")}
                    </div>

                    {/* GREEN UNREAD COUNT BADGE (Point 3) */}
                    {hasUnread && (
                      <span
                        style={{
                          backgroundColor: THEME.primary,
                          color: "#fff",
                          fontSize: "10px",
                          fontWeight: "800",
                          minWidth: "18px",
                          height: "18px",
                          borderRadius: "9px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 4px"
                        }}
                      >
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. LONG-PRESS BOTTOM SHEET (Point 2) */}
      {/* Options: Pin, Mute, Archive, Delete */}
      {/* ------------------------------------------------------------- */}
      {selectedChatForAction && (
        <div
          onClick={() => setSelectedChatForAction(null)}
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "flex-end",
            padding: 0
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              backgroundColor: THEME.sidebar,
              borderTop: `1px solid ${THEME.border}`,
              borderTopLeftRadius: "18px",
              borderTopRightRadius: "18px",
              padding: "16px 14px 28px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
              animation: "slideUp 0.2s ease-out"
            }}
          >
            {/* Header / Grabber */}
            <div
              style={{
                width: "40px",
                height: "4px",
                backgroundColor: THEME.border,
                borderRadius: "2px",
                margin: "0 auto 8px"
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                paddingBottom: "10px",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <img
                src={selectedChatForAction.displayAvatar}
                alt=""
                style={{ width: "38px", height: "38px", borderRadius: "50%" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  {selectedChatForAction.displayName}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  {selectedChatForAction.peerPhone || (selectedChatForAction.isGroup ? "Group" : "Direct Chat")}
                </div>
              </div>
              <button onClick={() => setSelectedChatForAction(null)} style={styles.cleanBtn}>
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            {/* Actions List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
              {/* Pin */}
              <button
                onClick={() => {
                  if (onTogglePin) onTogglePin(selectedChatForAction.id);
                  setSelectedChatForAction(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: THEME.card,
                  borderRadius: "8px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
              >
                <Pin size={18} color={THEME.primary} />
                <span style={{ fontSize: "13px", color: THEME.text, flex: 1 }}>
                  {pinnedChats.includes(selectedChatForAction.id) ? "Unpin Chat" : "Pin Chat"}
                </span>
              </button>

              {/* Mute */}
              <button
                onClick={() => {
                  if (onToggleMute) onToggleMute(selectedChatForAction.id);
                  setSelectedChatForAction(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: THEME.card,
                  borderRadius: "8px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
              >
                <BellOff size={18} color={THEME.danger} />
                <span style={{ fontSize: "13px", color: THEME.text, flex: 1 }}>
                  {mutedChats.includes(selectedChatForAction.id) ? "Unmute Notifications" : "Mute Notifications"}
                </span>
              </button>

              {/* Archive */}
              <button
                onClick={() => handleToggleArchive(selectedChatForAction.id)}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: THEME.card,
                  borderRadius: "8px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
              >
                <Archive size={18} color="#60A5FA" />
                <span style={{ fontSize: "13px", color: THEME.text, flex: 1 }}>
                  {archivedChatIds.includes(selectedChatForAction.id) ? "Unarchive Chat" : "Archive Chat"}
                </span>
              </button>

              {/* Delete Permanently */}
              <button
                onClick={() => handleDeletePermanently(selectedChatForAction)}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: THEME.card,
                  borderRadius: "8px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
              >
                <Trash2 size={18} color={THEME.danger} />
                <span style={{ fontSize: "13px", color: THEME.danger, fontWeight: "700", flex: 1 }}>
                  Delete Chat Permanently
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. PIN VERIFICATION MODAL FOR LOCKED CHATS (Point 10) */}
      {/* ------------------------------------------------------------- */}
      {showPinModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "320px"
            }}
          >
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={16} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  {targetLockedChatToOpen ? "Unlock Chat" : "Unlock Locked Folder"}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setTargetLockedChatToOpen(null);
                }}
                style={styles.cleanBtn}
              >
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted, textAlign: "center" }}>
                Enter your 4-digit PIN passcode
              </div>

              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                autoFocus
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  textAlign: "center",
                  fontSize: "20px",
                  letterSpacing: "6px",
                  color: THEME.text
                }}
              />

              {pinError && (
                <div style={{ fontSize: "12px", color: THEME.danger, textAlign: "center" }}>
                  {pinError}
                </div>
              )}

              <button
                onClick={handleVerifyPin}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.accent,
                  padding: "10px"
                }}
              >
                Verify & Open
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
