import React, { useState, useEffect, useRef, useMemo } from "react";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Send,
  Check,
  CheckCheck,
  Pin,
  BellOff,
  Flame,
  Eye,
  Reply,
  Share2,
  X,
  Copy,
  Trash2,
  Edit2,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Star,
  Clock,
  Plus,
  Smile
} from "lucide-react";
import { db, styles } from "../../firebase";

// Fast reaction row emojis
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

// Comprehensive full category emojis for expanded mobile emoji tray
const EXTENDED_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
  "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "😝",
  "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒",
  "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢",
  "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐",
  "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "📁", "🚀",
  "💡", "💯", "💔", "❤️‍🔥", "👏", "🙌", "🤝", "✌️", "🤞", "🤙", "👋", "🫡",
  "💪", "✨", "💥", "⚡", "⭐", "🌟", "🎯", "🏆", "🎁", "🎈", "🍻", "☕"
];

export default function ChatBox({
  activeChat,
  setActiveChat,
  messages = [],
  currentUser,
  peerPresence = { isOnline: false, lastSeen: "" },
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
  t,
  isPinned,
  isMuted,
  onTogglePin,
  onToggleMute,
  vanishMode,
  setVanishMode,
  viewOnceMode,
  setViewOnceMode,
  replyingTo,
  setReplyingTo,
  onSendMessage,
  onSendMedia,
  onReactMessage,
  onForwardMessage,
  onLightbox,
  startCall,
  openProfile,
  setMobileView,
  showToast
}) {
  const currentUserId =
    currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  // Chat Input State
  const [inputText, setInputText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);

  // Long-press modal & action toolbar state
  const [toolbarMessage, setToolbarMessage] = useState(null);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // Edit message state
  const [editingMessage, setEditingMessage] = useState(null);

  // Pinned message banner state
  const [pinnedMessage, setPinnedMessage] = useState(null);

  // References for sticky focus & smooth scroll
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Gesture tracking for swipe-to-reply & long-press (~400ms)
  const touchStartPos = useRef({ x: 0, y: 0, time: 0 });
  const longPressTimerRef = useRef(null);
  const isSwipingHorizontal = useRef(false);
  const isLongPressTriggered = useRef(false);
  const [bubbleOffsets, setBubbleOffsets] = useState({});

  // Synchronize pinned message
  useEffect(() => {
    if (activeChat?.pinnedMessage) {
      setPinnedMessage(activeChat.pinnedMessage);
    }
  }, [activeChat?.pinnedMessage]);

  // Reset modals on chat change & initial scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    setToolbarMessage(null);
    setShowFullEmojiPicker(false);
    setShowDeleteDialog(false);
    setShowScheduleModal(false);
  }, [activeChat?.id]);

  // Smooth scroll to bottom on new message if user is near bottom
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < 280) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages.length]);

  // Focus input automatically on reply
  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  // Filter messages for current user (respecting delete-for-me)
  const visibleMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (msg.deletedFor && Array.isArray(msg.deletedFor)) {
        if (msg.deletedFor.includes(currentUserId)) return false;
      }
      if (msg.deletedFor && typeof msg.deletedFor === "object") {
        if (msg.deletedFor[currentUserId]) return false;
      }
      return true;
    });
  }, [messages, currentUserId]);

  // --- SEND MESSAGE & STICKY KEYBOARD FOCUS RETENTION ---
  const handleSend = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const textToSend = inputText.trim();

    // Edit Mode
    if (editingMessage) {
      try {
        if (activeChat?.id) {
          const msgDocRef = doc(
            db,
            "rooms",
            activeChat.id,
            "messages",
            editingMessage.id
          );
          await updateDoc(msgDocRef, {
            content: textToSend,
            isEdited: true,
            updatedAt: new Date().toISOString()
          });
        }
        editingMessage.content = textToSend;
        editingMessage.isEdited = true;
        if (showToast) showToast("Message edited");
      } catch (err) {
        console.error("Failed to edit message:", err);
      }
      setEditingMessage(null);
      setInputText("");

      // Sticky keyboard retention
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return;
    }

    // Normal Send
    const payload = {
      content: textToSend,
      type: "text",
      isViewOnce: !!viewOnceMode,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderName: replyingTo.senderName
          }
        : null
    };

    setInputText("");
    setReplyingTo(null);

    if (onSendMessage) {
      onSendMessage(payload);
    } else if (activeChat?.id) {
      try {
        const msgId = Date.now().toString();
        const otherParticipant =
          (activeChat.participants || []).find((p) => p !== currentUserId) || "";

        await setDoc(doc(db, "rooms", activeChat.id, "messages", msgId), {
          senderId: currentUserId,
          senderPhone: currentUserId,
          senderName: currentUser?.name || currentUserId,
          recipientPhone: otherParticipant,
          content: textToSend,
          type: "text",
          status: "sent",
          read: false,
          createdAt: new Date().toISOString()
        });

        await updateDoc(doc(db, "conversations", activeChat.id), {
          lastMessage: textToSend,
          lastMessageTimestamp: Date.now(),
          lastSenderId: currentUserId,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Direct send error:", err);
      }
    }

    // STICKY KEYBOARD RETENTION: Keep mobile virtual keyboard focused and open
    setTimeout(() => {
      inputRef.current?.focus();
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 40);
  };

  // --- SWIPE-TO-REPLY & LONG-PRESS GESTURE CONTROLS ---
  const handleTouchStart = (e, msg) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isSwipingHorizontal.current = false;
    isLongPressTriggered.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // 400ms long-press triggers WhatsApp floating actions modal
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(35);
      }
      setToolbarMessage(msg);
      setShowFullEmojiPicker(false);
    }, 400);
  };

  const handleTouchMove = (e, msgId) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.current.x;
    const deltaY = touch.clientY - touchStartPos.current.y;

    // Vertical scroll: cancel long-press and let container scroll smoothly
    if (Math.abs(deltaY) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!isSwipingHorizontal.current) return;
    }

    // Controlled right swipe on the individual message bubble
    if (deltaX > 10 && Math.abs(deltaY) < 18) {
      isSwipingHorizontal.current = true;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const boundedOffset = Math.min(45, Math.max(0, deltaX));
      setBubbleOffsets((prev) => ({ ...prev, [msgId]: boundedOffset }));
    }
  };

  const handleTouchEnd = (e, msg) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const offset = bubbleOffsets[msg.id] || 0;

    // Swiping right >= 30px activates reply mode & sticky focuses input
    if (offset >= 30 && !isLongPressTriggered.current) {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(25);
      }
      setReplyingTo({
        id: msg.id,
        content: msg.content || (msg.fileUrl ? "Media file" : ""),
        senderName: msg.senderName || "User"
      });

      // Sticky input focus
      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }

    setBubbleOffsets((prev) => ({ ...prev, [msg.id]: 0 }));
    isSwipingHorizontal.current = false;
  };

  // Mouse fallback for testing
  const handleMouseDown = (e, msg) => {
    touchStartPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isLongPressTriggered.current = false;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setToolbarMessage(msg);
      setShowFullEmojiPicker(false);
    }, 450);
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // --- FIRESTORE ACTIONS: REACTION, STAR, PIN, EDIT, DELETE, SCHEDULE ---
  const handleApplyReaction = async (emoji, msgTarget = toolbarMessage) => {
    if (!msgTarget || !activeChat?.id) return;
    const msgId = msgTarget.id;
    const existingReaction = msgTarget.reactions?.[currentUserId];
    const newEmoji = existingReaction === emoji ? null : emoji;

    if (onReactMessage) {
      onReactMessage(msgId, newEmoji || "");
    } else {
      try {
        const msgDocRef = doc(db, "rooms", activeChat.id, "messages", msgId);
        await updateDoc(msgDocRef, {
          [`reactions.${currentUserId}`]: newEmoji
        });
      } catch (err) {
        console.error("Firestore reaction error:", err);
      }
    }

    if (showToast) {
      showToast(newEmoji ? `Reacted ${newEmoji}` : "Reaction removed");
    }
    setToolbarMessage(null);
    setShowFullEmojiPicker(false);
  };

  const handleReplyAction = (msg = toolbarMessage) => {
    if (!msg) return;
    setReplyingTo({
      id: msg.id,
      content: msg.content || (msg.fileUrl ? "Media file" : ""),
      senderName: msg.senderName || "User"
    });
    setToolbarMessage(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCopyAction = (msg = toolbarMessage) => {
    if (!msg) return;
    const text = msg.content || msg.fileUrl || "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    if (showToast) showToast("Message copied to clipboard");
    setToolbarMessage(null);
  };

  const handleForwardAction = (msg = toolbarMessage) => {
    if (!msg) return;
    if (onForwardMessage) {
      onForwardMessage(msg);
    } else if (showToast) {
      showToast("Forward message selected");
    }
    setToolbarMessage(null);
  };

  const handleStarAction = async (msg = toolbarMessage) => {
    if (!msg || !activeChat?.id) return;
    const isStarred = msg.starred?.[currentUserId] || msg.isStarred;
    const newStatus = !isStarred;

    try {
      const msgDocRef = doc(db, "rooms", activeChat.id, "messages", msg.id);
      await updateDoc(msgDocRef, {
        [`starred.${currentUserId}`]: newStatus,
        isStarred: newStatus
      });
      msg.isStarred = newStatus;
      if (showToast) {
        showToast(newStatus ? "Message starred ⭐" : "Message unstarred");
      }
    } catch (err) {
      console.error("Star toggle error:", err);
    }
    setToolbarMessage(null);
  };

  const handlePinAction = async (msg = toolbarMessage) => {
    if (!msg || !activeChat?.id) return;
    const isCurrentlyPinned = pinnedMessage?.id === msg.id;
    const nextPinned = isCurrentlyPinned ? null : msg;

    setPinnedMessage(nextPinned);
    try {
      const convDocRef = doc(db, "conversations", activeChat.id);
      await updateDoc(convDocRef, {
        pinnedMessage: nextPinned
          ? {
              id: msg.id,
              content: msg.content || "Media file",
              senderName: msg.senderName || "User"
            }
          : null
      });
      if (showToast) {
        showToast(nextPinned ? "Message pinned to top 📌" : "Message unpinned");
      }
    } catch (err) {
      console.error("Pin message error:", err);
    }
    setToolbarMessage(null);
  };

  const handleEditAction = (msg = toolbarMessage) => {
    if (!msg) return;
    setEditingMessage(msg);
    setInputText(msg.content || "");
    setToolbarMessage(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleOpenSchedule = (msg = toolbarMessage) => {
    if (!msg) return;
    const nowPlus1Hr = new Date(Date.now() + 60 * 60 * 1000);
    const formatted = nowPlus1Hr.toISOString().slice(0, 16);
    setScheduleDateTime(formatted);
    setShowScheduleModal(true);
  };

  const handleConfirmSchedule = async () => {
    if (!toolbarMessage || !activeChat?.id) return;
    try {
      const msgDocRef = doc(
        db,
        "rooms",
        activeChat.id,
        "messages",
        toolbarMessage.id
      );
      await updateDoc(msgDocRef, {
        scheduledReminder: {
          time: scheduleDateTime,
          userId: currentUserId,
          createdAt: new Date().toISOString()
        }
      });
      if (showToast) {
        showToast(
          `Reminder scheduled for ${new Date(scheduleDateTime).toLocaleString(
            [],
            {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            }
          )}`
        );
      }
    } catch (err) {
      console.error("Schedule error:", err);
    }
    setShowScheduleModal(false);
    setToolbarMessage(null);
  };

  const handleDeleteAction = (forEveryone = false) => {
    if (!toolbarMessage || !activeChat?.id) return;
    const target = toolbarMessage;

    if (forEveryone) {
      try {
        const msgDocRef = doc(db, "rooms", activeChat.id, "messages", target.id);
        updateDoc(msgDocRef, {
          type: "deleted",
          content: "🚫 This message was deleted",
          fileUrl: null,
          isDeleted: true
        });
        target.type = "deleted";
        target.content = "🚫 This message was deleted";
        target.fileUrl = null;
        if (showToast) showToast("Deleted for everyone");
      } catch (err) {
        console.error("Delete for everyone error:", err);
      }
    } else {
      try {
        const msgDocRef = doc(db, "rooms", activeChat.id, "messages", target.id);
        updateDoc(msgDocRef, {
          [`deletedFor.${currentUserId}`]: true
        });
        if (showToast) showToast("Deleted for you");
      } catch (err) {
        console.error("Delete for me error:", err);
      }
    }

    setShowDeleteDialog(false);
    setToolbarMessage(null);
  };

  const handleFileSelect = (e, fileType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    const reader = new FileReader();

    reader.onload = (loadEvt) => {
      const base64Data = loadEvt.target.result;
      if (onSendMedia) {
        onSendMedia({
          type: fileType,
          fileUrl: base64Data,
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + " KB",
          content:
            fileType === "image"
              ? "Photo"
              : fileType === "video"
              ? "Video"
              : file.name,
          isViewOnce: !!viewOnceMode
        });
      }
    };

    reader.readAsDataURL(file);
  };

  const isMsgSentByMe = (msg) =>
    msg && (msg.senderPhone === currentUserId || msg.senderId === currentUserId);

  return (
    <div
      className="chatbox-root"
      onContextMenu={(e) => {
        // 4. DISABLE BROWSER CONTEXTUAL TEXT SELECTION POPUPS
        e.preventDefault();
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: THEME.bg,
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
        overscrollBehaviorX: "none",
        overscrollBehaviorY: "contain",
        userSelect: "none",
        WebkitUserSelect: "none"
      }}
    >
      {/* Strict CSS Rules for disabling browser selection & touch-callouts */}
      <style>{`
        .chatbox-root, .chatbox-root * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .chatbox-input {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          user-select: text !important;
        }
        .overscroll-y-contain {
          overscroll-behavior-y: contain !important;
        }
        .-webkit-overflow-scrolling-touch {
          -webkit-overflow-scrolling: touch !important;
        }
      `}</style>

      {/* --- HEADER BAR --- */}
      <div
        style={{
          ...styles.headerBar,
          backgroundColor: THEME.header,
          borderColor: THEME.border,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          zIndex: 10
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flex: 1,
            minWidth: 0
          }}
        >
          <button
            onClick={() => {
              setActiveChat(null);
              if (setMobileView) setMobileView("list");
            }}
            style={{
              ...styles.cleanBtn,
              color: THEME.text,
              display: "flex",
              alignItems: "center",
              padding: "4px"
            }}
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <div
            onClick={() => openProfile && openProfile(activeChat)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              minWidth: 0
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={
                  activeChat?.avatar ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${
                    activeChat?.id || "user"
                  }`
                }
                alt=""
                style={styles.roundAvatar}
              />
              {peerPresence.isOnline && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "1px",
                    right: "1px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: THEME.accent,
                    border: `2px solid ${THEME.header}`
                  }}
                />
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: "700",
                  fontSize: "14px",
                  color: THEME.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {activeChat?.name || activeChat?.phone || "Chat"}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: peerPresence.isOnline ? THEME.accent : THEME.textMuted
                }}
              >
                {peerPresence.isOnline
                  ? "Online"
                  : peerPresence.lastSeen
                  ? `Last seen ${peerPresence.lastSeen}`
                  : activeChat?.phone || ""}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => startCall && startCall(activeChat, "audio")}
            style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
            title="Audio Call"
          >
            <Phone size={18} />
          </button>

          <button
            onClick={() => startCall && startCall(activeChat, "video")}
            style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
            title="Video Call"
          >
            <Video size={18} />
          </button>

          <button
            onClick={() => setShowChatOptions(!showChatOptions)}
            style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
            title="More"
          >
            <MoreVertical size={18} />
          </button>
        </div>

        {/* More Options Dropdown */}
        {showChatOptions && (
          <div
            style={{
              position: "absolute",
              top: "56px",
              right: "14px",
              backgroundColor: THEME.sidebar,
              border: `1px solid ${THEME.border}`,
              borderRadius: "10px",
              padding: "6px 0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              zIndex: 100,
              minWidth: "180px"
            }}
          >
            <button
              onClick={() => {
                onTogglePin && onTogglePin(activeChat.id);
                setShowChatOptions(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: "none",
                color: THEME.text,
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <Pin
                size={15}
                color={isPinned ? THEME.primary : THEME.textMuted}
              />
              <span>{isPinned ? "Unpin Chat" : "Pin Chat"}</span>
            </button>

            <button
              onClick={() => {
                onToggleMute && onToggleMute(activeChat.id);
                setShowChatOptions(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: "none",
                color: THEME.text,
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <BellOff
                size={15}
                color={isMuted ? THEME.danger : THEME.textMuted}
              />
              <span>
                {isMuted ? "Unmute Notifications" : "Mute Notifications"}
              </span>
            </button>

            <button
              onClick={() => {
                setVanishMode && setVanishMode(!vanishMode);
                setShowChatOptions(false);
                if (showToast)
                  showToast(
                    !vanishMode
                      ? "Vanish Mode ON (15s)"
                      : "Vanish Mode OFF"
                  );
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: "none",
                color: vanishMode ? THEME.accent : THEME.text,
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <Flame
                size={15}
                color={vanishMode ? THEME.accent : THEME.textMuted}
              />
              <span>Vanish Mode (15s)</span>
            </button>
          </div>
        )}
      </div>

      {/* Pinned Message Header Banner */}
      {pinnedMessage && (
        <div
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.12)",
            borderBottom: `1px solid ${THEME.primary}`,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            zIndex: 5
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              overflow: "hidden"
            }}
          >
            <Pin size={14} color={THEME.primary} />
            <span style={{ fontWeight: "700", color: THEME.primary }}>
              Pinned:
            </span>
            <span
              style={{
                color: THEME.text,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap"
              }}
            >
              {pinnedMessage.content || "Media"}
            </span>
          </div>
          <button
            onClick={() => handlePinAction(pinnedMessage)}
            style={styles.cleanBtn}
            title="Unpin"
          >
            <X size={14} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* --- 1. SMOOTH DUAL-SCROLLING MESSAGES CONTAINER --- */}
      <div
        ref={messagesContainerRef}
        className="overflow-y-auto overscroll-y-contain -webkit-overflow-scrolling-touch h-full"
        onTouchMove={(e) => {
          // Prevent scroll chaining or pull-to-refresh reload from bubbling outside thread
          e.stopPropagation();
        }}
        style={{
          flex: 1,
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          overscrollBehaviorX: "none",
          touchAction: "pan-y",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        {visibleMessages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: THEME.textMuted
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "8px",
                backgroundColor: THEME.card,
                fontSize: "12px",
                border: `1px solid ${THEME.border}`
              }}
            >
              🔒 End-to-end encrypted. Long-press any message for full WhatsApp toolbar.
            </div>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isMe = isMsgSentByMe(msg);
            const isDeleted = msg.type === "deleted";
            const isVanished = msg.type === "vanished";
            const isStarred =
              msg.starred?.[currentUserId] || msg.isStarred;
            const currentOffset = bubbleOffsets[msg.id] || 0;
            const isSelected = toolbarMessage?.id === msg.id;

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  width: "100%",
                  marginBottom: "2px",
                  position: "relative"
                }}
              >
                {/* Swipe Reply Icon Indicator */}
                {currentOffset > 8 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "-28px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: THEME.primary,
                      opacity: Math.min(1, currentOffset / 30),
                      transition: "opacity 0.1s ease"
                    }}
                  >
                    <Reply size={18} />
                  </div>
                )}

                {/* Individual Message Bubble */}
                <div
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchMove={(e) => handleTouchMove(e, msg.id)}
                  onTouchEnd={(e) => handleTouchEnd(e, msg)}
                  onMouseDown={(e) => handleMouseDown(e, msg)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setToolbarMessage(msg);
                    setShowFullEmojiPicker(false);
                  }}
                  style={{
                    maxWidth: "82%",
                    borderRadius: "12px",
                    borderTopRightRadius: isMe ? "2px" : "12px",
                    borderTopLeftRadius: !isMe ? "2px" : "12px",
                    padding: "8px 12px",
                    backgroundColor: isSelected
                      ? "rgba(34, 197, 94, 0.4)"
                      : isMe
                      ? THEME.primary
                      : THEME.card,
                    border: isSelected
                      ? `1.5px solid ${THEME.primary}`
                      : "1.5px solid transparent",
                    color: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    position: "relative",
                    wordBreak: "break-word",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    transform: `translateX(${currentOffset}px)`,
                    transition:
                      currentOffset === 0
                        ? "transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)"
                        : "none"
                  }}
                >
                  {/* Quoted Reply Header */}
                  {msg.replyTo && !isDeleted && (
                    <div
                      style={{
                        backgroundColor: "rgba(0,0,0,0.2)",
                        borderLeft: `3px solid ${
                          isMe ? "#fff" : THEME.primary
                        }`,
                        borderRadius: "4px",
                        padding: "4px 8px",
                        marginBottom: "6px",
                        fontSize: "11px"
                      }}
                    >
                      <div style={{ fontWeight: "700", opacity: 0.9 }}>
                        {msg.replyTo.senderName || "User"}
                      </div>
                      <div
                        style={{
                          opacity: 0.8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {msg.replyTo.content}
                      </div>
                    </div>
                  )}

                  {/* Media Content */}
                  {msg.fileUrl && !isVanished && !isDeleted && (
                    <div
                      onClick={() =>
                        onLightbox &&
                        onLightbox({
                          url: msg.fileUrl,
                          type: msg.type,
                          name: msg.fileName
                        })
                      }
                      style={{
                        cursor: "pointer",
                        borderRadius: "8px",
                        overflow: "hidden",
                        marginBottom: "6px"
                      }}
                    >
                      {msg.type === "video" ? (
                        <video
                          src={msg.fileUrl}
                          style={{
                            width: "100%",
                            maxHeight: "200px",
                            objectFit: "cover"
                          }}
                        />
                      ) : msg.type === "image" ? (
                        <img
                          src={msg.fileUrl}
                          alt=""
                          style={{
                            width: "100%",
                            maxHeight: "200px",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor: "rgba(0,0,0,0.15)",
                            padding: "8px",
                            borderRadius: "6px"
                          }}
                        >
                          <FileText size={20} />
                          <span
                            style={{
                              fontSize: "12px",
                              textDecoration: "underline"
                            }}
                          >
                            {msg.fileName || "Download file"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  <div
                    style={{
                      fontSize: "13px",
                      lineHeight: "1.4",
                      fontStyle: isDeleted ? "italic" : "normal",
                      opacity: isDeleted ? 0.75 : 1
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Timestamp, Edited Tag, Star Icon & Read Receipts */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "4px",
                      marginTop: "4px",
                      fontSize: "10px",
                      opacity: 0.8
                    }}
                  >
                    {isStarred && (
                      <Star size={11} fill="#FACC15" color="#FACC15" />
                    )}
                    {msg.isEdited && <span>(edited)</span>}
                    {msg.scheduledReminder && (
                      <Clock size={11} color="#93C5FD" />
                    )}
                    <span>
                      {msg.createdAt
                        ? new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : ""}
                    </span>
                    {isMe && !isDeleted && (
                      <span>
                        {msg.status === "read" ? (
                          <CheckCheck size={13} color="#53bdeb" />
                        ) : (
                          <Check size={13} />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Emoji Reaction Badges Below Bubble */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "2px",
                      marginTop: "-6px",
                      zIndex: 2
                    }}
                  >
                    {Object.entries(msg.reactions)
                      .filter(([_, emo]) => !!emo)
                      .map(([uid, emo]) => (
                        <button
                          key={uid}
                          onClick={() => handleApplyReaction(emo, msg)}
                          style={{
                            backgroundColor: THEME.header,
                            border: `1px solid ${THEME.border}`,
                            borderRadius: "12px",
                            padding: "1px 5px",
                            fontSize: "11px",
                            cursor: "pointer",
                            color: THEME.text
                          }}
                        >
                          {emo}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* --- 2. LONG-PRESS MESSAGE FLOATING TOOLBAR MODAL --- */}
      {toolbarMessage && (
        <div
          onClick={() => {
            setToolbarMessage(null);
            setShowFullEmojiPicker(false);
          }}
          style={{
            ...styles.modalOverlay,
            zIndex: 4000,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(3px)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "92%",
              maxWidth: "380px",
              backgroundColor: THEME.sidebar,
              border: `1px solid ${THEME.border}`,
              borderRadius: "18px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              animation: "fadeIn 0.15s ease",
              maxHeight: "85vh",
              overflowY: "auto"
            }}
          >
            {/* Quick Reaction Bar with '+' Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: THEME.card,
                borderRadius: "30px",
                padding: "6px 12px",
                border: `1px solid ${THEME.border}`
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  overflowX: "auto",
                  paddingBottom: "2px"
                }}
              >
                {QUICK_EMOJIS.map((emo) => (
                  <button
                    key={emo}
                    onClick={() => handleApplyReaction(emo)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "22px",
                      cursor: "pointer",
                      padding: "2px",
                      transition: "transform 0.15s ease",
                      lineHeight: "1"
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = "scale(1.3)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    {emo}
                  </button>
                ))}
              </div>

              {/* + Button to expand all mobile device emojis */}
              <button
                onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                style={{
                  backgroundColor: showFullEmojiPicker
                    ? THEME.primary
                    : THEME.header,
                  color: showFullEmojiPicker ? "#fff" : THEME.text,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  marginLeft: "6px"
                }}
                title="All Emojis"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Expanded Full Device Emoji Tray */}
            {showFullEmojiPicker && (
              <div
                style={{
                  backgroundColor: THEME.card,
                  borderRadius: "12px",
                  padding: "10px",
                  border: `1px solid ${THEME.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "180px",
                  overflowY: "auto"
                }}
              >
                {/* Custom Keyboard Emoji Input */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: THEME.sidebar,
                    borderRadius: "8px",
                    padding: "4px 8px",
                    border: `1px solid ${THEME.border}`
                  }}
                >
                  <Smile size={16} color={THEME.textMuted} />
                  <input
                    type="text"
                    placeholder="Type or paste any emoji..."
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    className="chatbox-input"
                    style={{
                      ...styles.bareInput,
                      color: THEME.text,
                      fontSize: "13px"
                    }}
                  />
                  {customEmojiInput && (
                    <button
                      onClick={() => {
                        handleApplyReaction(customEmojiInput.trim());
                        setCustomEmojiInput("");
                      }}
                      style={{
                        backgroundColor: THEME.primary,
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: "700"
                      }}
                    >
                      React
                    </button>
                  )}
                </div>

                {/* Categorized Emoji Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 1fr)",
                    gap: "6px",
                    justifyItems: "center"
                  }}
                >
                  {EXTENDED_EMOJIS.map((emo) => (
                    <button
                      key={emo}
                      onClick={() => handleApplyReaction(emo)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "20px",
                        cursor: "pointer",
                        padding: "2px"
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Preview snippet */}
            <div
              style={{
                backgroundColor: THEME.card,
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                color: THEME.textMuted,
                borderLeft: `3px solid ${THEME.primary}`,
                maxHeight: "50px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {toolbarMessage.content || "Media attachment"}
            </div>

            {/* Action Buttons List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px"
              }}
            >
              {/* Reply */}
              <button
                onClick={() => handleReplyAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Reply size={18} color={THEME.primary} />
                <span>Reply</span>
              </button>

              {/* Copy */}
              <button
                onClick={() => handleCopyAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Copy size={18} color={THEME.text} />
                <span>Copy</span>
              </button>

              {/* Forward */}
              <button
                onClick={() => handleForwardAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Share2 size={18} color={THEME.text} />
                <span>Forward</span>
              </button>

              {/* Pin */}
              <button
                onClick={() => handlePinAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Pin
                  size={18}
                  color={
                    pinnedMessage?.id === toolbarMessage.id
                      ? THEME.primary
                      : THEME.text
                  }
                />
                <span>
                  {pinnedMessage?.id === toolbarMessage.id
                    ? "Unpin Message"
                    : "Pin Message"}
                </span>
              </button>

              {/* Edit (if sender and text) */}
              {isMsgSentByMe(toolbarMessage) &&
                toolbarMessage.type === "text" && (
                  <button
                    onClick={() => handleEditAction()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: THEME.text,
                      fontSize: "14px",
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    <Edit2 size={18} color={THEME.accent} />
                    <span>Edit</span>
                  </button>
                )}

              {/* Schedule Reminder */}
              <button
                onClick={() => handleOpenSchedule()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Clock size={18} color="#60A5FA" />
                <span>Schedule Reminder</span>
              </button>

              {/* Favorite / Star */}
              <button
                onClick={() => handleStarAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Star
                  size={18}
                  color={
                    toolbarMessage.starred?.[currentUserId] ||
                    toolbarMessage.isStarred
                      ? "#FACC15"
                      : THEME.text
                  }
                  fill={
                    toolbarMessage.starred?.[currentUserId] ||
                    toolbarMessage.isStarred
                      ? "#FACC15"
                      : "none"
                  }
                />
                <span>
                  {toolbarMessage.starred?.[currentUserId] ||
                  toolbarMessage.isStarred
                    ? "Unstar Message"
                    : "Star / Favorite"}
                </span>
              </button>

              {/* Delete */}
              <button
                onClick={() => setShowDeleteDialog(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.danger,
                  fontSize: "14px",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <Trash2 size={18} color={THEME.danger} />
                <span>Delete</span>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => {
                setToolbarMessage(null);
                setShowFullEmojiPicker(false);
              }}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: `1px solid ${THEME.border}`,
                backgroundColor: THEME.card,
                color: THEME.textMuted,
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                marginTop: "4px"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* --- SCHEDULE MODAL --- */}
      {showScheduleModal && toolbarMessage && (
        <div style={styles.modalOverlay}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: THEME.text,
                  fontWeight: "700",
                  fontSize: "14px"
                }}
              >
                <Clock size={18} color="#60A5FA" />
                <span>Schedule Reminder</span>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                style={styles.cleanBtn}
              >
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
            >
              <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                Choose when you would like a reminder for this message:
              </div>

              <input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="chatbox-input"
                style={{
                  backgroundColor: THEME.card,
                  color: THEME.text,
                  border: `1px solid ${THEME.border}`,
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px"
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  marginTop: "8px"
                }}
              >
                <button
                  onClick={() => setShowScheduleModal(false)}
                  style={{
                    ...styles.pillBtn,
                    backgroundColor: THEME.card,
                    color: THEME.text
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSchedule}
                  style={{
                    ...styles.pillBtn,
                    backgroundColor: THEME.primary,
                    color: "#fff",
                    fontWeight: "700"
                  }}
                >
                  Save Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {showDeleteDialog && toolbarMessage && (
        <div style={styles.modalOverlay}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border
            }}
          >
            <div
              style={{
                ...styles.modalHeader,
                backgroundColor: THEME.header,
                borderColor: THEME.border
              }}
            >
              <div
                style={{
                  fontWeight: "700",
                  fontSize: "14px",
                  color: THEME.text
                }}
              >
                Delete message?
              </div>
              <button
                onClick={() => setShowDeleteDialog(false)}
                style={styles.cleanBtn}
              >
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>
            <div
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              <button
                onClick={() => handleDeleteAction(false)}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: THEME.card,
                  color: THEME.text,
                  padding: "10px"
                }}
              >
                Delete for Me
              </button>
              {isMsgSentByMe(toolbarMessage) && (
                <button
                  onClick={() => handleDeleteAction(true)}
                  style={{
                    ...styles.pillBtn,
                    backgroundColor: THEME.danger,
                    color: "#fff",
                    padding: "10px",
                    fontWeight: "700"
                  }}
                >
                  Delete for Everyone
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div
          style={{
            backgroundColor: THEME.card,
            borderTop: `1.5px solid ${THEME.primary}`,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: THEME.text,
              minWidth: 0
            }}
          >
            <Reply size={15} color={THEME.primary} />
            <div
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              <span style={{ color: THEME.primary, fontWeight: "700" }}>
                {replyingTo.senderName}:{" "}
              </span>
              <span style={{ color: THEME.textMuted }}>
                {replyingTo.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            style={styles.cleanBtn}
          >
            <X size={16} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* Inline Edit Banner */}
      {editingMessage && (
        <div
          style={{
            backgroundColor: THEME.card,
            borderTop: `1.5px solid ${THEME.accent}`,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: THEME.text
            }}
          >
            <Edit2 size={14} color={THEME.accent} />
            <span style={{ color: THEME.accent, fontWeight: "700" }}>
              Editing Message
            </span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setInputText("");
            }}
            style={styles.cleanBtn}
          >
            <X size={16} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* --- 3. CHAT INPUT COMPOSER WITH STICKY KEYBOARD FOCUS --- */}
      <form
        onSubmit={handleSend}
        style={{
          padding: "8px 12px",
          backgroundColor: THEME.header,
          borderTop: `1px solid ${THEME.border}`,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          position: "relative"
        }}
      >
        {/* Attachment Toggle */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            style={{
              ...styles.cleanBtn,
              color: THEME.textMuted,
              padding: "6px"
            }}
            title="Attach"
          >
            <Paperclip size={20} />
          </button>

          {showAttachMenu && (
            <div
              style={{
                position: "absolute",
                bottom: "45px",
                left: 0,
                backgroundColor: THEME.sidebar,
                border: `1px solid ${THEME.border}`,
                borderRadius: "10px",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                zIndex: 50,
                minWidth: "140px"
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 10px",
                  color: THEME.text,
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "6px"
                }}
              >
                <ImageIcon size={16} color={THEME.primary} />
                <span>Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, "image")}
                  style={{ display: "none" }}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 10px",
                  color: THEME.text,
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "6px"
                }}
              >
                <Video size={16} color="#34B7F1" />
                <span>Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e, "video")}
                  style={{ display: "none" }}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 10px",
                  color: THEME.text,
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "6px"
                }}
              >
                <FileText size={16} color="#5F6368" />
                <span>Document</span>
                <input
                  type="file"
                  onChange={(e) => handleFileSelect(e, "file")}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          )}
        </div>

        {/* View Once Toggle */}
        <button
          type="button"
          onClick={() => {
            setViewOnceMode && setViewOnceMode(!viewOnceMode);
            if (showToast)
              showToast(
                !viewOnceMode
                  ? "View Once mode enabled"
                  : "View Once mode disabled"
              );
          }}
          style={{
            ...styles.cleanBtn,
            color: viewOnceMode ? THEME.primary : THEME.textMuted,
            padding: "6px"
          }}
          title="View Once"
        >
          <Eye size={20} />
        </button>

        {/* Input Box with ref for sticky keyboard focus & retention */}
        <div
          style={{
            flex: 1,
            backgroundColor: THEME.card,
            borderRadius: "20px",
            border: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px"
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder={
              editingMessage ? "Edit message..." : "Type a message..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="chatbox-input"
            style={{
              ...styles.bareInput,
              color: THEME.text,
              fontSize: "14px",
              padding: "9px 0"
            }}
          />
        </div>

        {/* Send Button with onMouseDown preventDefault to retain input focus */}
        <button
          type="submit"
          onMouseDown={(e) => e.preventDefault()}
          disabled={!inputText.trim()}
          style={{
            backgroundColor: editingMessage ? THEME.accent : THEME.primary,
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "38px",
            height: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: !inputText.trim() ? 0.6 : 1,
            flexShrink: 0
          }}
          title={editingMessage ? "Update message" : "Send message"}
        >
          {editingMessage ? <CheckCircle size={18} /> : <Send size={17} />}
        </button>
      </form>
    </div>
  );
}
