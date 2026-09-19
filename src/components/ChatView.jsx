import React, { useState, useEffect, useRef } from "react";
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
  AlertCircle
} from "lucide-react";
import { styles } from "../firebase";

export default function ChatView({
  activeChat,
  setActiveChat,
  messages = [],
  currentUser,
  peerPresence = { isOnline: false, lastSeen: "" },
  THEME,
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
  const [inputText, setInputText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);

  // --- LONG-PRESS CONTEXT SELECTION STATE ---
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // References for scrolling
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const prevMessagesLength = useRef(0);

  // Long press timer ref
  const pressTimerRef = useRef(null);
  const isLongPressTriggered = useRef(false);

  // Swipe gesture tracking
  const touchStartPos = useRef({ x: 0, y: 0 });
  const [swipeOffsets, setSwipeOffsets] = useState({}); // { [msgId]: number }

  const myIdent = currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  // --- 1. AUTO-SCROLL TO BOTTOM ON MOUNT & NEW MESSAGES ---
  useEffect(() => {
    isInitialScrollDone.current = false;
    setSelectedMessage(null);
    setEditingMessage(null);
  }, [activeChat?.id]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const isNewMessage = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 150;

    if (!isInitialScrollDone.current) {
      container.scrollTop = container.scrollHeight;
      isInitialScrollDone.current = true;
    } else if (isNewMessage && isNearBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  // --- 2. SEND / EDIT MESSAGE HANDLER ---
  const handleSend = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim()) return;

    if (editingMessage) {
      // Inline edit mode: update existing message
      editingMessage.content = inputText.trim();
      editingMessage.isEdited = true;
      if (showToast) showToast("Message updated");
      setEditingMessage(null);
      setInputText("");
      return;
    }

    const payload = {
      content: inputText.trim(),
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

    onSendMessage(payload);
    setInputText("");
    setReplyingTo(null);

    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
    }, 50);
  };

  // --- 3. ATTACHMENT HANDLER ---
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
          content: fileType === "image" ? "Photo" : fileType === "video" ? "Video" : file.name,
          isViewOnce: !!viewOnceMode
        });
      }
    };

    reader.readAsDataURL(file);
  };

  // --- 4. SWIPE-TO-REPLY GESTURE HANDLERS ---
  const handleTouchStart = (e, msg) => {
    isLongPressTriggered.current = false;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Long press trigger after 400ms
    pressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
      setSelectedMessage(msg);
    }, 400);
  };

  const handleTouchMove = (e, msgId) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.current.x;
    const deltaY = touch.clientY - touchStartPos.current.y;

    // If vertical scroll detected, cancel long-press
    if (Math.abs(deltaY) > 8 && pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    // Horizontal swipe gesture for reply (up to 80px translation)
    if (Math.abs(deltaX) > 15 && Math.abs(deltaY) < 25) {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      const boundedOffset = Math.max(-80, Math.min(80, deltaX));
      setSwipeOffsets((prev) => ({ ...prev, [msgId]: boundedOffset }));
    }
  };

  const handleTouchEnd = (e, msg) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    const currentOffset = swipeOffsets[msg.id] || 0;
    // If swiped horizontally more than 45px, trigger Reply
    if (Math.abs(currentOffset) >= 45) {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(25);
      }
      setReplyingTo({
        id: msg.id,
        content: msg.content || (msg.fileUrl ? "Media file" : ""),
        senderName: msg.senderName || "User"
      });
      if (showToast) showToast(`Replying to ${msg.senderName || "message"}`);
    }

    // Reset translation with bounce back
    setSwipeOffsets((prev) => ({ ...prev, [msg.id]: 0 }));
  };

  // --- 5. TOP CONTEXT ACTION HANDLERS ---
  const handleCopySelected = () => {
    if (!selectedMessage) return;
    navigator.clipboard.writeText(selectedMessage.content || "");
    if (showToast) showToast("Message copied to clipboard");
    setSelectedMessage(null);
  };

  const handleReplySelected = () => {
    if (!selectedMessage) return;
    setReplyingTo({
      id: selectedMessage.id,
      content: selectedMessage.content,
      senderName: selectedMessage.senderName || "User"
    });
    setSelectedMessage(null);
  };

  const handleForwardSelected = () => {
    if (!selectedMessage) return;
    if (onForwardMessage) onForwardMessage(selectedMessage);
    setSelectedMessage(null);
  };

  const handleEditSelected = () => {
    if (!selectedMessage) return;
    setEditingMessage(selectedMessage);
    setInputText(selectedMessage.content || "");
    setSelectedMessage(null);
  };

  const handlePinSelected = () => {
    if (!selectedMessage) return;
    if (pinnedMessage?.id === selectedMessage.id) {
      setPinnedMessage(null);
      if (showToast) showToast("Message unpinned");
    } else {
      setPinnedMessage(selectedMessage);
      if (showToast) showToast("Message pinned to top");
    }
    setSelectedMessage(null);
  };

  const handleDeleteSelected = (forEveryone = false) => {
    if (!selectedMessage) return;
    // Mark as deleted in local memory or broadcast deletion
    selectedMessage.content = forEveryone
      ? "🚫 This message was deleted"
      : "🚫 You deleted this message";
    selectedMessage.type = "deleted";
    selectedMessage.fileUrl = null;
    if (showToast) showToast(forEveryone ? "Deleted for everyone" : "Deleted for you");
    setShowDeleteConfirm(false);
    setSelectedMessage(null);
  };

  const isSelectedSentByMe = selectedMessage && (selectedMessage.senderPhone === myIdent || selectedMessage.senderId === myIdent);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: THEME.bg,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* --- TOP HEADER (STANDARD CHAT BAR OR LONG-PRESS ACTION BAR) --- */}
      {selectedMessage ? (
        /* CONTEXTUAL ACTION BAR ON SELECTION */
        <div
          style={{
            ...styles.headerBar,
            backgroundColor: THEME.sidebar,
            borderColor: THEME.primary,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 14px",
            zIndex: 20,
            borderBottom: `2px solid ${THEME.primary}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                setSelectedMessage(null);
                setShowDeleteConfirm(false);
              }}
              style={{ ...styles.cleanBtn, color: THEME.text }}
            >
              <X size={20} />
            </button>
            <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
              1 message selected
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Reply Action */}
            <button
              onClick={handleReplySelected}
              style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
              title="Reply"
            >
              <Reply size={18} />
            </button>

            {/* Copy Action */}
            <button
              onClick={handleCopySelected}
              style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
              title="Copy"
            >
              <Copy size={18} />
            </button>

            {/* Forward Action */}
            <button
              onClick={handleForwardSelected}
              style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
              title="Forward"
            >
              <Share2 size={18} />
            </button>

            {/* Pin Action */}
            <button
              onClick={handlePinSelected}
              style={{
                ...styles.cleanBtn,
                color: pinnedMessage?.id === selectedMessage.id ? THEME.primary : THEME.text,
                padding: "8px"
              }}
              title="Pin message"
            >
              <Pin size={18} />
            </button>

            {/* Edit Action (Sender Only) */}
            {isSelectedSentByMe && selectedMessage.type === "text" && (
              <button
                onClick={handleEditSelected}
                style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
                title="Edit message"
              >
                <Edit2 size={18} />
              </button>
            )}

            {/* Delete Action */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ ...styles.cleanBtn, color: THEME.danger, padding: "8px" }}
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ) : (
        /* STANDARD CHAT TOP HEADER */
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
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
              title="Back to chats"
            >
              <ArrowLeft size={20} />
            </button>

            <div
              onClick={() => openProfile && openProfile(activeChat)}
              style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0 }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={activeChat.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
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
                  {activeChat.name}
                </div>
                <div style={{ fontSize: "11px", color: peerPresence.isOnline ? THEME.accent : THEME.textMuted }}>
                  {peerPresence.isOnline ? "Online" : peerPresence.lastSeen ? `Last seen ${peerPresence.lastSeen}` : activeChat.phone || ""}
                </div>
              </div>
            </div>
          </div>

          {/* Right Header Buttons */}
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
              title="More Options"
            >
              <MoreVertical size={18} />
            </button>
          </div>

          {/* Three-Dot Dropdown Options Menu */}
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
                <Pin size={15} color={isPinned ? THEME.primary : THEME.textMuted} />
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
                <BellOff size={15} color={isMuted ? THEME.danger : THEME.textMuted} />
                <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
              </button>

              <button
                onClick={() => {
                  setVanishMode && setVanishMode(!vanishMode);
                  setShowChatOptions(false);
                  if (showToast) showToast(!vanishMode ? "Vanish Mode ON: Messages vanish in 15s" : "Vanish Mode OFF");
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
                <Flame size={15} color={vanishMode ? THEME.accent : THEME.textMuted} />
                <span>Vanish Mode (15s)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- PINNED MESSAGE BANNER --- */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
            <Pin size={14} color={THEME.primary} />
            <span style={{ fontWeight: "700", color: THEME.primary }}>Pinned:</span>
            <span style={{ color: THEME.text, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {pinnedMessage.content || "Media file"}
            </span>
          </div>
          <button onClick={() => setPinnedMessage(null)} style={styles.cleanBtn}>
            <X size={14} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* Vanish Banner */}
      {vanishMode && (
        <div
          style={{
            backgroundColor: "rgba(241, 92, 109, 0.15)",
            borderBottom: `1px solid ${THEME.danger}`,
            padding: "4px 14px",
            fontSize: "11px",
            color: THEME.danger,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px"
          }}
        >
          <Flame size={13} />
          <span>Vanish Mode Active: New messages vanish in 15 seconds</span>
        </div>
      )}

      {/* --- 6. SCROLLABLE MESSAGE HISTORY & SWIPE-TO-REPLY --- */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          height: "100%",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", color: THEME.textMuted }}>
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
              🔒 Swipe message to reply or long-press for options.
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderPhone === myIdent || msg.senderId === myIdent;
            const isVanished = msg.type === "vanished";
            const isDeleted = msg.type === "deleted";
            const isSelected = selectedMessage?.id === msg.id;
            const currentSwipeOffset = swipeOffsets[msg.id] || 0;

            return (
              <div
                key={msg.id}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchMove={(e) => handleTouchMove(e, msg.id)}
                onTouchEnd={(e) => handleTouchEnd(e, msg)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedMessage(msg);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  width: "100%",
                  marginBottom: "2px",
                  position: "relative",
                  transition: currentSwipeOffset === 0 ? "transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)" : "none",
                  transform: `translateX(${currentSwipeOffset}px)`
                }}
              >
                {/* Visual Indicator Behind Bubble When Swiped */}
                {Math.abs(currentSwipeOffset) > 20 && (
                  <div
                    style={{
                      position: "absolute",
                      [isMe ? "right" : "left"]: "-36px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: THEME.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: Math.min(1, Math.abs(currentSwipeOffset) / 45)
                    }}
                  >
                    <Reply size={20} />
                  </div>
                )}

                {/* Message Bubble Card */}
                <div
                  style={{
                    maxWidth: "80%",
                    borderRadius: "12px",
                    borderTopRightRadius: isMe ? "2px" : "12px",
                    borderTopLeftRadius: !isMe ? "2px" : "12px",
                    padding: "8px 12px",
                    backgroundColor: isSelected
                      ? "rgba(34, 197, 94, 0.35)"
                      : isMe
                      ? THEME.primary
                      : THEME.card,
                    border: isSelected ? `1.5px solid ${THEME.primary}` : "1.5px solid transparent",
                    color: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    position: "relative",
                    wordBreak: "break-word",
                    userSelect: "none",
                    WebkitUserSelect: "none"
                  }}
                >
                  {/* Replied Message Quote Preview */}
                  {msg.replyTo && !isDeleted && (
                    <div
                      style={{
                        backgroundColor: "rgba(0,0,0,0.2)",
                        borderLeft: `3px solid ${isMe ? "#fff" : THEME.primary}`,
                        borderRadius: "4px",
                        padding: "4px 8px",
                        marginBottom: "6px",
                        fontSize: "11px"
                      }}
                    >
                      <div style={{ fontWeight: "700", opacity: 0.9 }}>{msg.replyTo.senderName || "User"}</div>
                      <div style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {msg.replyTo.content}
                      </div>
                    </div>
                  )}

                  {/* Media Content */}
                  {msg.fileUrl && !isVanished && !isDeleted && (
                    <div
                      onClick={() => onLightbox && onLightbox({ url: msg.fileUrl, type: msg.type, name: msg.fileName })}
                      style={{ cursor: "pointer", borderRadius: "8px", overflow: "hidden", marginBottom: "6px" }}
                    >
                      {msg.type === "video" ? (
                        <video src={msg.fileUrl} style={{ width: "100%", maxHeight: "200px", objectFit: "cover" }} />
                      ) : msg.type === "image" ? (
                        <img src={msg.fileUrl} alt="" style={{ width: "100%", maxHeight: "200px", objectFit: "cover" }} />
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
                          <span style={{ fontSize: "12px", textDecoration: "underline" }}>{msg.fileName || "Download file"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text Content */}
                  <div style={{ fontSize: "13px", lineHeight: "1.4", fontStyle: isDeleted ? "italic" : "normal", opacity: isDeleted ? 0.7 : 1 }}>
                    {msg.content}
                  </div>

                  {/* Footer: Timestamp, Edited badge & Read Status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "4px",
                      marginTop: "4px",
                      fontSize: "10px",
                      opacity: 0.75
                    }}
                  >
                    {msg.isEdited && <span>(edited)</span>}
                    <span>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                    {isMe && !isDeleted && (
                      <span>
                        {msg.status === "read" ? <CheckCheck size={13} color="#53bdeb" /> : <Check size={13} />}
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

      {/* --- CONFIRMATION DIALOG FOR DELETE --- */}
      {showDeleteConfirm && selectedMessage && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>Delete message?</div>
              <button onClick={() => setShowDeleteConfirm(false)} style={styles.cleanBtn}>
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "13px", color: THEME.textMuted }}>
                Choose how you want to delete this message:
              </div>
              <button
                onClick={() => handleDeleteSelected(false)}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: THEME.card,
                  color: THEME.text,
                  padding: "10px"
                }}
              >
                Delete for Me
              </button>
              {isSelectedSentByMe && (
                <button
                  onClick={() => handleDeleteSelected(true)}
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

      {/* --- REPLIED PREVIEW BANNER (ABOVE INPUT) --- */}
      {replyingTo && (
        <div
          style={{
            backgroundColor: THEME.card,
            borderTop: `1.5px solid ${THEME.primary}`,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fadeIn 0.2s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: THEME.text, minWidth: 0 }}>
            <Reply size={15} color={THEME.primary} />
            <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ color: THEME.primary, fontWeight: "700" }}>{replyingTo.senderName}: </span>
              <span style={{ color: THEME.textMuted }}>{replyingTo.content}</span>
            </div>
          </div>
          <button onClick={() => setReplyingTo(null)} style={styles.cleanBtn}>
            <X size={16} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* --- INLINE EDIT BANNER (ABOVE INPUT) --- */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: THEME.text }}>
            <Edit2 size={14} color={THEME.accent} />
            <span style={{ color: THEME.accent, fontWeight: "700" }}>Editing Message</span>
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

      {/* --- 7. CHAT INPUT & COMPOSER BAR --- */}
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
        {/* Attachment Options */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            style={{ ...styles.cleanBtn, color: THEME.textMuted, padding: "6px" }}
            title="Attach file"
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
            if (showToast) showToast(!viewOnceMode ? "View Once mode enabled" : "View Once mode disabled");
          }}
          style={{
            ...styles.cleanBtn,
            color: viewOnceMode ? THEME.primary : THEME.textMuted,
            padding: "6px"
          }}
          title="View Once message"
        >
          <Eye size={20} />
        </button>

        {/* Text Input Field */}
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
            type="text"
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              ...styles.bareInput,
              color: THEME.text,
              fontSize: "14px",
              padding: "9px 0"
            }}
          />
        </div>

        {/* Send / Update Button */}
        <button
          type="submit"
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
