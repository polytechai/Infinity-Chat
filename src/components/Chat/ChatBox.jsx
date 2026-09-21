import React, { useState, useEffect, useRef, useMemo } from "react";
import { doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import {
  Reply,
  Copy,
  Trash2,
  Edit2,
  Star,
  Pin,
  Share2,
  X
} from "lucide-react";
import { db, styles, normalizePhone } from "../../firebase";

// Modular Component Imports
import ChatBoxHeader from "./ChatBoxHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import UserProfileModal from "./UserProfileModal";
import MediaPreviewModal from "./MediaPreviewModal";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

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
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Long-press modal & action toolbar state
  const [toolbarMessage, setToolbarMessage] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);

  // References for sticky focus & smooth dual-scroll
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Gesture tracking for swipe-to-reply & long-press (~400ms)
  const touchStartPos = useRef({ x: 0, y: 0, time: 0 });
  const longPressTimerRef = useRef(null);
  const isSwipingHorizontal = useRef(false);
  const isLongPressTriggered = useRef(false);
  const [bubbleOffsets, setBubbleOffsets] = useState({});

  // Media preview and edit modal state
  const [pendingMedia, setPendingMedia] = useState(null);

  // Real-time voice messages state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [voiceWaveform, setVoiceWaveform] = useState([10, 25, 40, 20, 60, 30, 80, 45, 20]);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const visualizerAnimRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Auto-scroll to bottom on incoming messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Determine if a message was sent by the current user
  const isMsgSentByMe = (msg) => {
    if (!msg) return false;
    const sId = normalizePhone(msg.senderPhone || msg.senderId);
    const mId = normalizePhone(currentUserId);
    return sId === mId;
  };

  // -------------------------------------------------------------
  // SWIPE-TO-REPLY & LONG-PRESS GESTURES
  // -------------------------------------------------------------
  const handleTouchStart = (e, msg) => {
    const touch = e.touches[0];
    touchStartPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    isSwipingHorizontal.current = false;
    isLongPressTriggered.current = false;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setToolbarMessage(msg);
      if (window.navigator?.vibrate) window.navigator.vibrate(40);
    }, 450);
  };

  const handleTouchMove = (e, msgId) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }

    if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
      isSwipingHorizontal.current = true;
      const offset = Math.min(dx * 0.45, 70);
      setBubbleOffsets((prev) => ({ ...prev, [msgId]: offset }));
    }
  };

  const handleTouchEnd = (e, msg) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const currentOffset = bubbleOffsets[msg.id] || 0;
    if (currentOffset > 38 && !isLongPressTriggered.current) {
      setReplyingTo(msg);
      if (window.navigator?.vibrate) window.navigator.vibrate(20);
      inputRef.current?.focus();
    }
    setBubbleOffsets((prev) => ({ ...prev, [msg.id]: 0 }));
    isSwipingHorizontal.current = false;
  };

  // -------------------------------------------------------------
  // CHAT COMPOSER: SEND TEXT & REPLIES
  // -------------------------------------------------------------
  const handleSend = (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (editingMessage && db) {
      updateDoc(
        doc(db, "rooms", activeChat.id, "messages", editingMessage.id),
        { content: trimmed, isEdited: true }
      ).catch(() => {});
      setEditingMessage(null);
      setInputText("");
      if (showToast) showToast("Message updated");
      return;
    }

    if (onSendMessage) {
      onSendMessage(trimmed);
    }
    setInputText("");
    setReplyingTo(null);
  };

  // -------------------------------------------------------------
  // VOICE RECORDER CONTROLS
  // -------------------------------------------------------------
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setVoiceRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceRecordingSeconds((sec) => sec + 1);
      }, 1000);

      // Web Audio Visualizer
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualizer = () => {
        analyser.getByteFrequencyData(dataArray);
        const sample = Array.from(dataArray.slice(0, 9)).map((v) => Math.max(4, v / 8));
        setVoiceWaveform(sample);
        visualizerAnimRef.current = requestAnimationFrame(updateVisualizer);
      };
      updateVisualizer();
    } catch (err) {
      console.warn("Audio mic error:", err);
      if (showToast) showToast("Microphone permission required for voice notes");
    }
  };

  const cancelVoiceRecording = () => {
    cleanupVoiceRecording();
    setIsRecordingVoice(false);
    setIsPreviewingVoice(false);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
  };

  const finishVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cleanupVoiceRecording();
    setIsRecordingVoice(false);
    setIsPreviewingVoice(true);
  };

  const cleanupVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (visualizerAnimRef.current) cancelAnimationFrame(visualizerAnimRef.current);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const toggleVoicePreviewPlay = () => {
    if (!previewAudioRef.current && recordedAudioUrl) {
      const audio = new Audio(recordedAudioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setIsVoicePreviewPlaying(false);
    }
    if (!previewAudioRef.current) return;

    if (isVoicePreviewPlaying) {
      previewAudioRef.current.pause();
      setIsVoicePreviewPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsVoicePreviewPlaying(true);
    }
  };

  const sendRecordedVoiceMessage = () => {
    if (!recordedAudioBlob || !recordedAudioUrl) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (onSendMedia) {
        onSendMedia({
          fileUrl: reader.result,
          rawDataUrl: reader.result,
          fileName: `VoiceNote_${Date.now()}.webm`,
          type: "voice",
          duration: voiceRecordingSeconds
        });
      }
      discardRecordedVoice();
    };
    reader.readAsDataURL(recordedAudioBlob);
  };

  const discardRecordedVoice = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setIsPreviewingVoice(false);
    setIsVoicePreviewPlaying(false);
  };

  // -------------------------------------------------------------
  // ATTACHMENT / FILE UPLOAD HANDLERS
  // -------------------------------------------------------------
  const handleAttachClick = (acceptType) => {
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      setPendingMedia({
        file,
        fileType: file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("image/")
          ? "image"
          : "file",
        rawDataUrl: result,
        fileName: file.name,
        fileSize: file.size,
        caption: ""
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // -------------------------------------------------------------
  // TOOLBAR ACTION HANDLERS (Copy, Star, Pin, Edit, Delete)
  // -------------------------------------------------------------
  const handleCopyAction = () => {
    if (toolbarMessage?.content) {
      navigator.clipboard?.writeText(toolbarMessage.content);
      if (showToast) showToast("Copied to clipboard");
    }
    setToolbarMessage(null);
  };

  const handleStarAction = () => {
    if (showToast) showToast("Message starred ⭐");
    setToolbarMessage(null);
  };

  const handlePinAction = () => {
    setPinnedMessage(toolbarMessage);
    if (showToast) showToast("Message pinned to top 📌");
    setToolbarMessage(null);
  };

  const handleEditAction = () => {
    if (toolbarMessage) {
      setEditingMessage(toolbarMessage);
      setInputText(toolbarMessage.content || "");
      inputRef.current?.focus();
    }
    setToolbarMessage(null);
  };

  const handleDeleteAction = (forEveryone = false) => {
    if (!toolbarMessage?.id || !db) return;
    if (forEveryone) {
      updateDoc(
        doc(db, "rooms", activeChat.id, "messages", toolbarMessage.id),
        { type: "deleted", isDeleted: true, content: "" }
      ).catch(() => {});
      if (showToast) showToast("Deleted for everyone");
    } else {
      if (showToast) showToast("Deleted for me");
    }
    setShowDeleteDialog(false);
    setToolbarMessage(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: THEME.bg,
        color: THEME.text,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* 1. CHATBOX HEADER */}
      <ChatBoxHeader
        activeChat={activeChat}
        peerPresence={peerPresence}
        THEME={THEME}
        setMobileView={setMobileView}
        setActiveChat={setActiveChat}
        startCall={startCall}
        onOpenProfile={() => setShowUserProfile(true)}
        showChatOptions={showChatOptions}
        setShowChatOptions={setShowChatOptions}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        vanishMode={vanishMode}
        setVanishMode={setVanishMode}
        showToast={showToast}
      />

      {/* PINNED MESSAGE BANNER */}
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
            zIndex: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <Pin size={14} color={THEME.primary} />
            <span style={{ fontWeight: "700", color: THEME.primary }}>Pinned:</span>
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
          <button onClick={() => setPinnedMessage(null)} style={styles.cleanBtn}>
            <X size={14} color={THEME.textMuted} />
          </button>
        </div>
      )}

      {/* 2. MESSAGE LIST (Dual-scroll, Swipe-to-reply, Reactions, Video Player) */}
      <MessageList
        messages={messages}
        currentUser={currentUser}
        THEME={THEME}
        bubbleOffsets={bubbleOffsets}
        isSwipingHorizontal={isSwipingHorizontal}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        setToolbarMessage={setToolbarMessage}
        onLightbox={onLightbox}
        onReactMessage={onReactMessage}
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        isMsgSentByMe={isMsgSentByMe}
      />

      {/* 3. MESSAGE INPUT (Voice recorder, Sticky text input, Attachments) */}
      <MessageInput
        inputText={inputText}
        setInputText={setInputText}
        handleSend={handleSend}
        showAttachMenu={showAttachMenu}
        setShowAttachMenu={setShowAttachMenu}
        onAttachClick={handleAttachClick}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        isRecordingVoice={isRecordingVoice}
        voiceRecordingSeconds={voiceRecordingSeconds}
        voiceWaveform={voiceWaveform}
        startVoiceRecording={startVoiceRecording}
        cancelVoiceRecording={cancelVoiceRecording}
        finishVoiceRecording={finishVoiceRecording}
        isPreviewingVoice={isPreviewingVoice}
        isVoicePreviewPlaying={isVoicePreviewPlaying}
        toggleVoicePreviewPlay={toggleVoicePreviewPlay}
        recordedAudioUrl={recordedAudioUrl}
        sendRecordedVoiceMessage={sendRecordedVoiceMessage}
        discardRecordedVoice={discardRecordedVoice}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        inputRef={inputRef}
        THEME={THEME}
      />

      {/* --- LONG PRESS MESSAGE TOOLBAR MODAL --- */}
      {toolbarMessage && (
        <div
          onClick={() => setToolbarMessage(null)}
          style={{ ...styles.modalOverlay, zIndex: 6000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "300px",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}
          >
            {/* Quick Emoji Reaction Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 8px",
                backgroundColor: THEME.card,
                borderRadius: "20px"
              }}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    if (onReactMessage) onReactMessage(toolbarMessage.id, emoji);
                    setToolbarMessage(null);
                  }}
                  style={{
                    ...styles.cleanBtn,
                    fontSize: "20px",
                    cursor: "pointer",
                    padding: "2px"
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <button
                onClick={() => {
                  setReplyingTo(toolbarMessage);
                  setToolbarMessage(null);
                  inputRef.current?.focus();
                }}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "10px",
                  cursor: "pointer"
                }}
              >
                <Reply size={16} color={THEME.primary} />
                <span style={{ fontSize: "13px", color: THEME.text }}>Reply</span>
              </button>

              <button
                onClick={handleCopyAction}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "10px",
                  cursor: "pointer"
                }}
              >
                <Copy size={16} color="#60A5FA" />
                <span style={{ fontSize: "13px", color: THEME.text }}>Copy</span>
              </button>

              <button
                onClick={handleStarAction}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "10px",
                  cursor: "pointer"
                }}
              >
                <Star size={16} color="#FACC15" />
                <span style={{ fontSize: "13px", color: THEME.text }}>Star</span>
              </button>

              <button
                onClick={handlePinAction}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "10px",
                  cursor: "pointer"
                }}
              >
                <Pin size={16} color={THEME.primary} />
                <span style={{ fontSize: "13px", color: THEME.text }}>Pin Message</span>
              </button>

              {isMsgSentByMe(toolbarMessage) && (
                <button
                  onClick={handleEditAction}
                  style={{
                    ...styles.settingsItem,
                    backgroundColor: "transparent",
                    padding: "10px",
                    cursor: "pointer"
                  }}
                >
                  <Edit2 size={16} color="#34D399" />
                  <span style={{ fontSize: "13px", color: THEME.text }}>Edit</span>
                </button>
              )}

              <button
                onClick={() => setShowDeleteDialog(true)}
                style={{
                  ...styles.settingsItem,
                  backgroundColor: "transparent",
                  padding: "10px",
                  cursor: "pointer"
                }}
              >
                <Trash2 size={16} color={THEME.danger} />
                <span style={{ fontSize: "13px", color: THEME.danger }}>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      {showDeleteDialog && toolbarMessage && (
        <div style={{ ...styles.modalOverlay, zIndex: 6500 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "280px",
              padding: "16px",
              textAlign: "center"
            }}
          >
            <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text, marginBottom: "14px" }}>
              Delete message?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => handleDeleteAction(false)}
                style={{ ...styles.pillBtn, backgroundColor: THEME.card, color: THEME.text, padding: "10px" }}
              >
                Delete for Me
              </button>
              {isMsgSentByMe(toolbarMessage) && (
                <button
                  onClick={() => handleDeleteAction(true)}
                  style={{ ...styles.primaryBtn, backgroundColor: THEME.danger, padding: "10px" }}
                >
                  Delete for Everyone
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MEDIA PREVIEW & EDIT CANVAS MODAL --- */}
      {pendingMedia && (
        <MediaPreviewModal
          pendingMedia={pendingMedia}
          onClose={() => setPendingMedia(null)}
          onSendMedia={(payload) => {
            if (onSendMedia) onSendMedia(payload);
            setPendingMedia(null);
          }}
          THEME={THEME}
          showToast={showToast}
        />
      )}

      {/* --- USER PROFILE & MEDIA GRID MODAL --- */}
      {showUserProfile && (
        <UserProfileModal
          user={activeChat}
          onClose={() => setShowUserProfile(false)}
          currentUser={currentUser}
          messages={messages}
          THEME={THEME}
          onClearChat={() => {
            setShowUserProfile(false);
            if (showToast) showToast("Chat cleared");
          }}
          onBlockUser={(peerId) => {
            if (showToast) showToast("Contact blocked");
            setShowUserProfile(false);
          }}
          onMuteUser={(peerId) => {
            if (onToggleMute) onToggleMute(activeChat?.id);
          }}
          onLightbox={onLightbox}
          startCall={startCall}
          showToast={showToast}
        />
      )}
    </div>
  );
}
