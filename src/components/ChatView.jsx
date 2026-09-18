import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Phone,
  Video,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Flame,
  Eye,
  Reply,
  Share2,
  Paperclip,
  Mic,
  Send,
  X,
  FileText,
  Download,
  Check,
  CheckCheck
} from "lucide-react";
import { normalizePhone, styles } from "../firebase";

export default function ChatView({
  activeChat,
  setActiveChat,
  messages = [],
  currentUser,
  peerPresence,
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
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [openedViewOnceMap, setOpenedViewOnceMap] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const longPressTimeoutRef = useRef(null);

  const myNorm = normalizePhone(currentUser?.phone);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const txt = inputText.trim();
    if (!txt) return;
    onSendMessage({
      content: txt,
      type: "text",
      replyTo: replyingTo
        ? { id: replyingTo.id, content: replyingTo.content, senderName: replyingTo.senderName }
        : null
    });
    setInputText("");
    setReplyingTo(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

    const reader = new FileReader();
    reader.onload = (ev) => {
      onSendMedia({
        type: isImg ? "image" : isVid ? "video" : isPdf ? "pdf" : "file",
        fileUrl: ev.target.result,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        isViewOnce: viewOnceMode && (isImg || isVid),
        replyTo: replyingTo
          ? { id: replyingTo.id, content: replyingTo.content, senderName: replyingTo.senderName }
          : null
      });
      setViewOnceMode(false);
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
  };

  // Voice recording engine using browser MediaRecorder
  const toggleRecording = async () => {
    if (isRecording) {
      clearInterval(recordIntervalRef.current);
      setIsRecording(false);
      try {
        mediaRecorderRef.current?.stop();
      } catch (e) {}
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onload = (ev) => {
            onSendMedia({
              type: "audio",
              fileUrl: ev.target.result,
              fileName: `Voice Note (${recordSecs}s).webm`,
              fileSize: `${(audioBlob.size / 1024).toFixed(1)} KB`
            });
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordSecs(0);
        recordIntervalRef.current = setInterval(() => {
          setRecordSecs((s) => s + 1);
        }, 1000);
      } catch (err) {
        showToast?.("Microphone permission denied or unsupported.");
      }
    }
  };

  // Long press gestures handlers
  const handleTouchStart = (msgId) => {
    longPressTimeoutRef.current = setTimeout(() => {
      setActiveMessageMenu(msgId);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
  };

  if (!activeChat) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", backgroundColor: THEME.bg }}>
      {/* Top Header */}
      <div style={{ ...styles.headerBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => {
              setActiveChat(null);
              setMobileView?.("list");
            }}
            style={styles.cleanBtn}
          >
            <ArrowLeft size={18} color={THEME.text} />
          </button>
          <img
            src={activeChat.avatar}
            alt=""
            onClick={() => openProfile?.(activeChat)}
            style={{ ...styles.roundAvatar, cursor: "pointer" }}
          />
          <div onClick={() => openProfile?.(activeChat)} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{activeChat.name}</div>
            <div style={{ fontSize: "11px", color: peerPresence?.isOnline ? THEME.accent : THEME.textMuted }}>
              {peerPresence?.isOnline ? t.online : peerPresence?.lastSeen ? `${t.lastSeen} ${peerPresence.lastSeen}` : activeChat.phone}
            </div>
          </div>
        </div>

        {/* Header Action Icons: Call, Video, Pin, Mute */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={() => onTogglePin?.(activeChat.id)} style={styles.cleanBtn} title={isPinned ? "Unpin Chat" : "Pin Chat to Top"}>
            {isPinned ? <PinOff size={17} color={THEME.primary} /> : <Pin size={17} color={THEME.textMuted} />}
          </button>
          <button onClick={() => onToggleMute?.(activeChat.id)} style={styles.cleanBtn} title={isMuted ? "Unmute Notifications" : "Mute Chat"}>
            {isMuted ? <BellOff size={17} color={THEME.danger} /> : <Bell size={17} color={THEME.textMuted} />}
          </button>
          <button onClick={() => startCall?.(activeChat, "audio")} style={styles.cleanBtn} title="Voice Call">
            <Phone size={17} color={THEME.text} />
          </button>
          <button onClick={() => startCall?.(activeChat, "video")} style={styles.cleanBtn} title="Video Call">
            <Video size={17} color={THEME.text} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div style={styles.messagesViewport}>
        {messages.map((msg) => {
          const isMe = normalizePhone(msg.senderPhone) === myNorm;
          const isViewOnce = msg.isViewOnce;
          const isOpened = openedViewOnceMap[msg.id] || msg.isViewed;
          const reactions = Object.entries(msg.reactions || {});

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                width: "100%",
                position: "relative"
              }}
            >
              {/* Threaded Reply Reference */}
              {msg.replyTo && (
                <div
                  style={{
                    fontSize: "11px",
                    color: THEME.textMuted,
                    backgroundColor: isMe ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.08)",
                    borderLeft: `3px solid ${THEME.primary}`,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    marginBottom: "2px",
                    maxWidth: "76%"
                  }}
                >
                  <span style={{ fontWeight: "700", color: THEME.primary }}>{msg.replyTo.senderName}: </span>
                  <span>{msg.replyTo.content}</span>
                </div>
              )}

              {/* Chat Message Bubble */}
              <div
                onTouchStart={() => handleTouchStart(msg.id)}
                onTouchEnd={handleTouchEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id);
                }}
                style={{
                  ...styles.msgBubble,
                  backgroundColor: isMe ? THEME.bubbleMe : THEME.bubblePeer,
                  color: THEME.text,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  position: "relative",
                  userSelect: "none"
                }}
              >
                {/* Forwarded Status Label */}
                {msg.isForwarded && (
                  <div style={{ fontSize: "10px", fontStyle: "italic", color: THEME.textMuted, marginBottom: "2px" }}>
                    Forwarded
                  </div>
                )}

                {/* View-Once Photo/Video Gating */}
                {isViewOnce ? (
                  <div
                    onClick={() => {
                      if (!isOpened) {
                        setOpenedViewOnceMap((prev) => ({ ...prev, [msg.id]: true }));
                        onLightbox?.({ url: msg.fileUrl, type: msg.type, name: "View Once Media" });
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: isOpened ? "default" : "pointer",
                      padding: "6px 0",
                      opacity: isOpened ? 0.6 : 1
                    }}
                  >
                    <Eye size={18} color={isOpened ? THEME.textMuted : THEME.primary} />
                    <span style={{ fontWeight: "600", fontSize: "12px" }}>
                      {isOpened ? "Opened View-Once Media" : "Photo / Video (View Once)"}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Image Attachment */}
                    {msg.type === "image" && msg.fileUrl && (
                      <img
                        src={msg.fileUrl}
                        alt=""
                        onClick={() => onLightbox?.({ url: msg.fileUrl, type: "image", name: msg.fileName || "Photo" })}
                        style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", cursor: "zoom-in", marginBottom: "4px" }}
                      />
                    )}

                    {/* Video Attachment */}
                    {msg.type === "video" && msg.fileUrl && (
                      <video src={msg.fileUrl} controls style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", marginBottom: "4px" }} />
                    )}

                    {/* Voice Note Audio */}
                    {msg.type === "audio" && msg.fileUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "4px 0" }}>
                        <audio src={msg.fileUrl} controls style={{ maxWidth: "220px", height: "36px" }} />
                      </div>
                    )}

                    {/* PDF or Document File */}
                    {(msg.type === "file" || msg.type === "pdf") && msg.fileUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                        <FileText size={20} color={THEME.secondary} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {msg.fileName || "File"}
                          </div>
                          <div style={{ fontSize: "10px", color: THEME.textMuted }}>{msg.fileSize || ""}</div>
                        </div>
                        <a href={msg.fileUrl} download={msg.fileName || "file"} style={{ ...styles.cleanBtn, color: THEME.primary }}>
                          <Download size={16} />
                        </a>
                      </div>
                    )}

                    {/* Text Message Content */}
                    {msg.content && <div style={{ fontSize: "13px", lineHeight: "1.4" }}>{msg.content}</div>}
                  </>
                )}

                {/* Bubble Timestamp & Status */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "3px" }}>
                  <span style={{ fontSize: "10px", color: THEME.textMuted }}>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                  {isMe && (
                    <span style={{ display: "flex", alignItems: "center" }}>
                      {msg.status === "read" ? <CheckCheck size={13} color={THEME.tickRead} /> : <Check size={13} color={THEME.tickSent} />}
                    </span>
                  )}
                  <button
                    onClick={() => setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id)}
                    style={{ ...styles.cleanBtn, color: THEME.textMuted, padding: "0 2px" }}
                  >
                    ⋮
                  </button>
                </div>

                {/* Long-Press / Click Action Menu */}
                {activeMessageMenu === msg.id && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      right: isMe ? 0 : "auto",
                      left: isMe ? "auto" : 0,
                      backgroundColor: THEME.card,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: "8px",
                      padding: "6px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                      zIndex: 20
                    }}
                  >
                    {["❤️", "👍", "😂", "😮", "🙏"].map((emo) => (
                      <button
                        key={emo}
                        onClick={() => {
                          onReactMessage?.(msg.id, emo);
                          setActiveMessageMenu(null);
                        }}
                        style={{ ...styles.cleanBtn, fontSize: "15px" }}
                      >
                        {emo}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setReplyingTo({
                          id: msg.id,
                          senderName: isMe ? "You" : activeChat.name,
                          content: msg.content || (msg.type === "image" ? "Photo" : "Attachment")
                        });
                        setActiveMessageMenu(null);
                      }}
                      style={{ ...styles.cleanBtn, color: THEME.textMuted }}
                      title="Reply"
                    >
                      <Reply size={15} />
                    </button>
                    <button
                      onClick={() => {
                        onForwardMessage?.(msg);
                        setActiveMessageMenu(null);
                      }}
                      style={{ ...styles.cleanBtn, color: THEME.textMuted }}
                      title="Forward"
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                )}

                {/* Reaction Badges */}
                {reactions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-8px",
                      right: isMe ? "6px" : "auto",
                      left: isMe ? "auto" : "6px",
                      backgroundColor: THEME.card,
                      borderRadius: "10px",
                      padding: "1px 5px",
                      fontSize: "11px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      display: "flex",
                      gap: "2px"
                    }}
                  >
                    {reactions.map(([phone, emo]) => (
                      <span key={phone}>{emo}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div
          style={{
            padding: "8px 14px",
            backgroundColor: THEME.card,
            borderTop: `1px solid ${THEME.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: "12px", borderLeft: `3px solid ${THEME.primary}`, paddingLeft: "8px" }}>
            <div style={{ fontWeight: "700", color: THEME.primary }}>Replying to {replyingTo.senderName}</div>
            <div style={{ color: THEME.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "260px" }}>
              {replyingTo.content}
            </div>
          </div>
          <button onClick={() => setReplyingTo(null)} style={styles.cleanBtn}>
            <X size={16} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <div style={{ ...styles.inputBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
        <button
          onClick={() => {
            const next = !vanishMode;
            setVanishMode(next);
            showToast?.(next ? t.vanishOn : "Vanish Mode OFF");
          }}
          style={styles.cleanBtn}
          title="Vanish Mode (15s)"
        >
          <Flame size={18} color={vanishMode ? THEME.danger : THEME.textMuted} />
        </button>

        <button
          onClick={() => {
            const next = !viewOnceMode;
            setViewOnceMode(next);
            showToast?.(next ? "View Once ON" : "View Once OFF");
          }}
          style={styles.cleanBtn}
          title="View Once Media (Photo/Video)"
        >
          <Eye size={18} color={viewOnceMode ? THEME.primary : THEME.textMuted} />
        </button>

        <input
          type="file"
          id="chat-file-input"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <button
          onClick={() => document.getElementById("chat-file-input")?.click()}
          style={styles.cleanBtn}
          title="Attach photo, video or document"
        >
          <Paperclip size={18} color={THEME.textMuted} />
        </button>

        <div style={{ ...styles.inputWrap, flex: 1, backgroundColor: THEME.card, borderColor: THEME.border }}>
          <input
            type="text"
            placeholder={isRecording ? `Recording voice note... (${recordSecs}s)` : t.typeMessage}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            disabled={isRecording}
            style={{ ...styles.bareInput, color: THEME.text }}
          />
        </div>

        {inputText.trim() ? (
          <button onClick={handleSend} style={{ ...styles.circleBtn, backgroundColor: THEME.primary }}>
            <Send size={16} color="#fff" />
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            style={{
              ...styles.circleBtn,
              backgroundColor: isRecording ? THEME.danger : THEME.card,
              color: isRecording ? "#fff" : THEME.textMuted
            }}
            title={isRecording ? "Stop Recording" : "Record Voice Note"}
          >
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
