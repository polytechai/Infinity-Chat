import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Send,
  Mic,
  Smile,
  Check,
  CheckCheck,
  Pin,
  BellOff,
  Flame,
  Eye,
  Reply,
  Share2,
  X,
  Download,
  Image as ImageIcon,
  FileText
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);

  // References for scrolling
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const prevMessagesLength = useRef(0);

  const myIdent = currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  // Common quick emoji reaction list
  const quickEmojis = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

  // --- 1. AUTO-SCROLL TO BOTTOM ON MOUNT & NEW MESSAGES ---
  useEffect(() => {
    isInitialScrollDone.current = false;
  }, [activeChat?.id]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isNewMessage = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    // Check if user is already near bottom (within 150px)
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 150;

    if (!isInitialScrollDone.current) {
      // First load: instantly snap to bottom
      container.scrollTop = container.scrollHeight;
      isInitialScrollDone.current = true;
    } else if (isNewMessage && isNearBottom) {
      // Smooth scroll if user was already at the bottom or sent a message
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  // --- 2. SEND MESSAGE HANDLER ---
  const handleSend = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim()) return;

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

    // Scroll to bottom immediately on user send
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
    }, 50);
  };

  // --- 3. ATTACHMENT UPLOAD HANDLER ---
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
      {/* --- CHAT TOP HEADER --- */}
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

        {/* Right Action Icons: Audio Call, Video Call, Menu */}
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

        {/* Options Dropdown Menu */}
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

      {/* Vanish / View Once Active Banners */}
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
          <span>Vanish Mode Active: New messages self-destruct after 15 seconds</span>
        </div>
      )}

      {/* --- 4. SMOOTH SCROLLABLE MESSAGE HISTORY CONTAINER --- */}
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
              🔒 Messages are end-to-end synced. Send a greeting to start chatting!
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderPhone === myIdent || msg.senderId === myIdent;
            const isVanished = msg.type === "vanished";

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  width: "100%",
                  marginBottom: "2px"
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    borderRadius: "12px",
                    borderTopRightRadius: isMe ? "2px" : "12px",
                    borderTopLeftRadius: !isMe ? "2px" : "12px",
                    padding: "8px 12px",
                    backgroundColor: isMe ? THEME.primary : THEME.card,
                    color: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    position: "relative",
                    wordBreak: "break-word"
                  }}
                >
                  {/* Replied Quote Header */}
                  {msg.replyTo && (
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
                  {msg.fileUrl && !isVanished && (
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

                  {/* Message Text */}
                  <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
                    {msg.content}
                  </div>

                  {/* Footer: Timestamp & Read Receipts */}
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
                    <span>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                    {isMe && (
                      <span>
                        {msg.status === "read" ? <CheckCheck size={13} color="#53bdeb" /> : <Check size={13} />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Emoji Reaction Badges */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div style={{ display: "flex", gap: "2px", marginTop: "-6px", zIndex: 1 }}>
                    {Object.entries(msg.reactions).map(([uid, emo]) => (
                      <span
                        key={uid}
                        style={{
                          backgroundColor: THEME.header,
                          border: `1px solid ${THEME.border}`,
                          borderRadius: "12px",
                          padding: "1px 5px",
                          fontSize: "11px"
                        }}
                      >
                        {emo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying Banner */}
      {replyingTo && (
        <div
          style={{
            backgroundColor: THEME.card,
            borderTop: `1px solid ${THEME.border}`,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: THEME.text }}>
            <Reply size={14} color={THEME.primary} />
            <div>
              <span style={{ color: THEME.primary, fontWeight: "700" }}>{replyingTo.senderName}: </span>
              <span style={{ color: THEME.textMuted }}>{replyingTo.content}</span>
            </div>
          </div>
          <button onClick={() => setReplyingTo(null)} style={styles.cleanBtn}>
            <X size={16} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* --- 5. CHAT INPUT & COMPOSER BAR --- */}
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
          title="View Once photo/message"
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
            placeholder="Type a message..."
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

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          style={{
            backgroundColor: THEME.primary,
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
          title="Send message"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
