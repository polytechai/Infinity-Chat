import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Reply,
  Copy,
  Share2,
  Pin,
  Edit2,
  Clock,
  Star,
  Trash2,
  Download,
  Phone,
  PhoneMissed,
  Video,
  X,
  Plus,
  Smile,
  Check,
  CheckCheck
} from "lucide-react";
import { styles } from "../../firebase";

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

const ALL_EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
  "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒",
  "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢",
  "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰",
  "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄",
  "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴",
  "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺",
  "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹",
  "😻", "😼", "😽", "🙀", "😿", "😾", "❤️", "🧡", "💛", "💚", "💙", "💜",
  "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖",
  "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️",
  "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌",
  "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙",
  "💪", "🦾", "🖕", "✍️", "🙏", "🦶", "🦵", "🦿", "💄", "💋", "👄", "🦷",
  "🔥", "✨", "🎉", "🎊", "💯", "🚀", "⭐", "🌟", "💫", "💥", "🎯", "🏆"
];

export default function MessageList({
  messages = [],
  currentUser = {},
  activeChat = {},
  onReplyMessage,
  onCopyMessage,
  onForwardMessage,
  onPinMessage,
  onEditMessage,
  onScheduleMessage,
  onFavoriteMessage,
  onDeleteMessage,
  onReactMessage,
  onLightboxMedia,
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
  showToast
}) {
  const currentUserId =
    currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  const scrollContainerRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  // States for long-press message context menu & emoji picker
  const [activeMenuMsg, setActiveMenuMsg] = useState(null);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Swipe-to-reply state tracking
  const touchStartCoords = useRef({ x: 0, y: 0 });
  const [swipingMsgId, setSwipingMsgId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const longPressTimeoutRef = useRef(null);

  // Auto-scroll to latest message on messages load
  useEffect(() => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // -------------------------------------------------------------
  // TOUCH / MOUSE GESTURES (SWIPE-TO-REPLY & LONG PRESS)
  // -------------------------------------------------------------
  const handleTouchStart = (e, msg) => {
    const touch = e.touches ? e.touches[0] : e;
    touchStartCoords.current = { x: touch.clientX, y: touch.clientY };

    // Clear previous timers
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    // Long press detection (~500ms)
    longPressTimeoutRef.current = setTimeout(() => {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
      openMessageMenu(msg, touch.clientX, touch.clientY);
    }, 500);
  };

  const handleTouchMove = (e, msg) => {
    const touch = e.touches ? e.touches[0] : e;
    const diffX = touch.clientX - touchStartCoords.current.x;
    const diffY = Math.abs(touch.clientY - touchStartCoords.current.y);

    // Cancel long press if user is actively swiping or scrolling vertically
    if (Math.abs(diffX) > 10 || diffY > 10) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }

    // Horizontal right drag for swipe-to-reply (Point 6)
    if (diffX > 15 && diffY < 30) {
      const clampedOffset = Math.min(diffX - 15, 65);
      setSwipingMsgId(msg.id);
      setSwipeOffset(clampedOffset);
    }
  };

  const handleTouchEnd = (e, msg) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    // If swiped far enough right, trigger reply
    if (swipingMsgId === msg.id && swipeOffset >= 50) {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(25);
      }
      if (onReplyMessage) {
        onReplyMessage(msg);
      }
      if (showToast) {
        showToast("Replying to message");
      }
    }

    setSwipingMsgId(null);
    setSwipeOffset(0);
  };

  const openMessageMenu = (msg, clientX, clientY) => {
    setActiveMenuMsg(msg);
    setShowFullEmojiPicker(false);
    // Position menu within viewport bounds
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const posX = Math.min(Math.max(10, clientX - 140), screenWidth - 290);
    const posY = Math.min(Math.max(10, clientY - 180), screenHeight - 340);
    setMenuPosition({ top: posY, left: posX });
  };

  const handleQuickReaction = (emoji) => {
    if (activeMenuMsg && onReactMessage) {
      onReactMessage(activeMenuMsg.id, emoji);
    }
    setActiveMenuMsg(null);
    setShowFullEmojiPicker(false);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-y-auto overscroll-y-contain touch-pan-y"
      style={{
        flex: 1,
        width: "100%",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        userSelect: "none",
        WebkitUserSelect: "none",
        backgroundColor: THEME.bg,
        backgroundImage: `radial-gradient(${THEME.border} 0.75px, transparent 0.75px)`,
        backgroundSize: "24px 24px"
      }}
    >
      {/* Messages List Render */}
      {messages.map((msg) => {
        const isMe = msg.senderId === currentUserId;
        const isSwipingThis = swipingMsgId === msg.id;
        const currentSwipeOffset = isSwipingThis ? swipeOffset : 0;

        // -------------------------------------------------------------
        // 4. CALL LOG BUBBLES (Point 15)
        // Red "Missed Audio/Video Call" or Green "Audio Call (02:45)"
        // -------------------------------------------------------------
        if (msg.type === "call_log" || msg.type === "call") {
          const isMissed =
            msg.callStatus === "missed" ||
            msg.status === "missed" ||
            msg.content?.toLowerCase().includes("missed");
          const isVideoCall =
            msg.callType === "video" || msg.content?.toLowerCase().includes("video");
          const callDuration = msg.duration || msg.callDuration || "";

          return (
            <div
              key={msg.id}
              style={{
                alignSelf: "center",
                margin: "6px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "20px",
                backgroundColor: isMissed ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                border: `1px solid ${isMissed ? THEME.danger : THEME.primary}`,
                color: isMissed ? THEME.danger : THEME.primary,
                fontSize: "12px",
                fontWeight: "600",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
              }}
            >
              {isMissed ? (
                <PhoneMissed size={16} color={THEME.danger} />
              ) : isVideoCall ? (
                <Video size={16} color={THEME.primary} />
              ) : (
                <Phone size={16} color={THEME.primary} />
              )}

              <span>
                {isMissed
                  ? `Missed ${isVideoCall ? "Video" : "Audio"} Call`
                  : `${isVideoCall ? "Video" : "Audio"} Call ${
                      callDuration ? `(${callDuration})` : ""
                    }`}
              </span>

              <span style={{ fontSize: "10px", color: THEME.textMuted, marginLeft: "4px" }}>
                {msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : ""}
              </span>
            </div>
          );
        }

        // -------------------------------------------------------------
        // REGULAR MESSAGE ROW (WITH SWIPE-TO-REPLY)
        // -------------------------------------------------------------
        return (
          <div
            key={msg.id}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              width: "100%",
              justifyContent: isMe ? "flex-end" : "flex-start"
            }}
          >
            {/* Swipe to reply visual indicator on left */}
            {isSwipingThis && currentSwipeOffset > 15 && (
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(currentSwipeOffset - 35, 15)}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: THEME.primary,
                  color: "#fff",
                  transform: `scale(${Math.min(currentSwipeOffset / 45, 1)})`,
                  transition: "transform 0.1s ease"
                }}
              >
                <Reply size={15} />
              </div>
            )}

            {/* Bubble wrapper with horizontal transform */}
            <div
              onTouchStart={(e) => handleTouchStart(e, msg)}
              onTouchMove={(e) => handleTouchMove(e, msg)}
              onTouchEnd={(e) => handleTouchEnd(e, msg)}
              onContextMenu={(e) => {
                e.preventDefault();
                openMessageMenu(msg, e.clientX, e.clientY);
              }}
              style={{
                maxWidth: "80%",
                transform: `translateX(${currentSwipeOffset}px)`,
                transition: isSwipingThis ? "none" : "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
                display: "flex",
                flexDirection: "column"
              }}
            >
              {/* Group message sender header */}
              {activeChat?.isGroup && !isMe && (
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: THEME.accent,
                    marginBottom: "2px",
                    paddingLeft: "4px"
                  }}
                >
                  {msg.senderName || msg.senderId}
                </div>
              )}

              {/* Message Bubble Box */}
              <div
                style={{
                  position: "relative",
                  padding: "8px 12px",
                  borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  backgroundColor: isMe ? "rgba(0, 168, 132, 0.95)" : THEME.card,
                  color: isMe ? "#FFFFFF" : THEME.text,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  border: isMe ? "none" : `1px solid ${THEME.border}`,
                  wordBreak: "break-word"
                }}
              >
                {/* Quoted / Reply Preview Container */}
                {msg.replyTo && (
                  <div
                    style={{
                      borderLeft: `3px solid ${isMe ? "#fff" : THEME.primary}`,
                      backgroundColor: "rgba(0, 0, 0, 0.15)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      marginBottom: "6px",
                      fontSize: "11px"
                    }}
                  >
                    <div style={{ fontWeight: "700", opacity: 0.9 }}>
                      {msg.replyTo.senderName || "Message"}
                    </div>
                    <div
                      style={{
                        opacity: 0.8,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {msg.replyTo.content || "Attachment"}
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 4. IN-APP HTML5 VIDEO ATTACHMENTS (Point 14) */}
                {/* ------------------------------------------------------------- */}
                {msg.type === "video" && msg.fileUrl && (
                  <div style={{ marginBottom: "6px", borderRadius: "8px", overflow: "hidden" }}>
                    <div style={{ position: "relative" }}>
                      <video
                        src={msg.fileUrl}
                        controls
                        playsInline
                        preload="metadata"
                        style={{
                          width: "100%",
                          maxHeight: "260px",
                          borderRadius: "8px",
                          backgroundColor: "#000"
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: "4px"
                      }}
                    >
                      <a
                        href={msg.fileUrl}
                        download={msg.fileName || "video_download"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          color: isMe ? "#fff" : THEME.accent,
                          textDecoration: "none",
                          backgroundColor: "rgba(0,0,0,0.2)",
                          padding: "3px 8px",
                          borderRadius: "4px"
                        }}
                        title="Download Video"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Photo Attachments */}
                {msg.type === "image" && msg.fileUrl && (
                  <div
                    onClick={() =>
                      onLightboxMedia &&
                      onLightboxMedia({ url: msg.fileUrl, type: "image", name: msg.fileName })
                    }
                    style={{
                      marginBottom: "6px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      cursor: "pointer"
                    }}
                  >
                    <img
                      src={msg.fileUrl}
                      alt=""
                      style={{
                        width: "100%",
                        maxHeight: "260px",
                        objectFit: "cover",
                        borderRadius: "8px"
                      }}
                    />
                  </div>
                )}

                {/* Text Content */}
                {msg.content && (
                  <div style={{ fontSize: "13.5px", lineHeight: "1.4" }}>
                    {msg.content}
                  </div>
                )}

                {/* Timestamp and Read Receipts */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "4px",
                    marginTop: "4px",
                    fontSize: "10px",
                    color: isMe ? "rgba(255,255,255,0.7)" : THEME.textMuted
                  }}
                >
                  {msg.isPinned && <Pin size={10} color={isMe ? "#fff" : THEME.primary} />}
                  {msg.isFavorite && <Star size={10} fill="#f59e0b" color="#f59e0b" />}

                  <span>
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : ""}
                  </span>

                  {isMe && (
                    <span>
                      {msg.status === "read" ? (
                        <CheckCheck size={13} color="#34d399" />
                      ) : msg.status === "delivered" ? (
                        <CheckCheck size={13} />
                      ) : (
                        <Check size={13} />
                      )}
                    </span>
                  )}
                </div>

                {/* Emoji Reactions List on Bottom of Bubble */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "3px",
                      marginTop: "4px",
                      paddingTop: "2px"
                    }}
                  >
                    {Object.entries(msg.reactions).map(([reactionEmoji, userIds]) => {
                      const count = Array.isArray(userIds) ? userIds.length : 1;
                      if (count <= 0) return null;
                      return (
                        <div
                          key={reactionEmoji}
                          onClick={() => onReactMessage && onReactMessage(msg.id, reactionEmoji)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            backgroundColor: "rgba(0,0,0,0.25)",
                            borderRadius: "10px",
                            padding: "2px 6px",
                            fontSize: "11px",
                            cursor: "pointer",
                            border: `1px solid ${THEME.border}`
                          }}
                        >
                          <span>{reactionEmoji}</span>
                          {count > 1 && <span style={{ fontSize: "10px" }}>{count}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomAnchorRef} />

      {/* ------------------------------------------------------------- */}
      {/* 2. ACTIONS TOOLBAR & ALL-EMOJI PICKER (Point 5) */}
      {/* ------------------------------------------------------------- */}
      {activeMenuMsg && (
        <div
          onClick={() => {
            setActiveMenuMsg(null);
            setShowFullEmojiPicker(false);
          }}
          style={{
            ...styles.modalOverlay,
            zIndex: 6000,
            backgroundColor: "rgba(0,0,0,0.4)"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: "280px",
              backgroundColor: THEME.sidebar,
              border: `1px solid ${THEME.border}`,
              borderRadius: "14px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
              animation: "fadeIn 0.15s ease-out"
            }}
          >
            {/* Quick Emoji Reaction Strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: THEME.card,
                padding: "6px 8px",
                borderRadius: "24px",
                border: `1px solid ${THEME.border}`
              }}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleQuickReaction(emoji)}
                  style={{
                    ...styles.cleanBtn,
                    fontSize: "20px",
                    cursor: "pointer",
                    padding: "2px 4px",
                    transition: "transform 0.1s ease"
                  }}
                >
                  {emoji}
                </button>
              ))}

              {/* Full Emoji Picker Button (+) */}
              <button
                onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                style={{
                  ...styles.cleanBtn,
                  backgroundColor: THEME.cardHover,
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: THEME.text
                }}
                title="All Emojis"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* FULL EMOJI PICKER POPUP (Point 5) */}
            {showFullEmojiPicker && (
              <div
                style={{
                  maxHeight: "160px",
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: "6px",
                  padding: "8px",
                  backgroundColor: THEME.card,
                  borderRadius: "8px",
                  border: `1px solid ${THEME.border}`
                }}
              >
                {ALL_EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleQuickReaction(emoji)}
                    style={{
                      ...styles.cleanBtn,
                      fontSize: "18px",
                      cursor: "pointer",
                      padding: "4px"
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Actions Menu List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {/* Reply */}
              <button
                onClick={() => {
                  if (onReplyMessage) onReplyMessage(activeMenuMsg);
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Reply size={16} color={THEME.text} />
                <span style={{ fontSize: "13px", color: THEME.text }}>Reply</span>
              </button>

              {/* Copy */}
              <button
                onClick={() => {
                  if (onCopyMessage) onCopyMessage(activeMenuMsg.content || "");
                  else navigator.clipboard.writeText(activeMenuMsg.content || "");
                  if (showToast) showToast("Copied to clipboard");
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Copy size={16} color={THEME.text} />
                <span style={{ fontSize: "13px", color: THEME.text }}>Copy</span>
              </button>

              {/* Forward */}
              <button
                onClick={() => {
                  if (onForwardMessage) onForwardMessage(activeMenuMsg);
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Share2 size={16} color={THEME.text} />
                <span style={{ fontSize: "13px", color: THEME.text }}>Forward</span>
              </button>

              {/* Pin / Unpin */}
              <button
                onClick={() => {
                  if (onPinMessage) onPinMessage(activeMenuMsg.id);
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Pin size={16} color={THEME.primary} />
                <span style={{ fontSize: "13px", color: THEME.text }}>
                  {activeMenuMsg.isPinned ? "Unpin Message" : "Pin Message"}
                </span>
              </button>

              {/* Edit (only available if current user is author) */}
              {activeMenuMsg.senderId === currentUserId && (
                <button
                  onClick={() => {
                    if (onEditMessage) onEditMessage(activeMenuMsg);
                    setActiveMenuMsg(null);
                  }}
                  style={{
                    ...styles.settingsItem,
                    backgroundColor: "transparent",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    cursor: "pointer"
                  }}
                >
                  <Edit2 size={16} color={THEME.accent} />
                  <span style={{ fontSize: "13px", color: THEME.text }}>Edit Message</span>
                </button>
              )}

              {/* Schedule */}
              <button
                onClick={() => {
                  if (onScheduleMessage) onScheduleMessage(activeMenuMsg);
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Clock size={16} color="#60A5FA" />
                <span style={{ fontSize: "13px", color: THEME.text }}>Schedule</span>
              </button>

              {/* Favorite */}
              <button
                onClick={() => {
                  if (onFavoriteMessage) onFavoriteMessage(activeMenuMsg);
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Star size={16} color="#f59e0b" />
                <span style={{ fontSize: "13px", color: THEME.text }}>Star / Favorite</span>
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  if (onDeleteMessage) onDeleteMessage(activeMenuMsg.id);
                  setActiveMenuMsg(null);
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <Trash2 size={16} color={THEME.danger} />
                <span style={{ fontSize: "13px", color: THEME.danger, fontWeight: "600" }}>
                  Delete Message
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
