import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Video,
  Smile,
  X,
  Reply,
  Sparkles
} from "lucide-react";
import { styles } from "../../firebase";

export default function MessageInput({
  messageText = "",
  setMessageText,
  onSendMessage,
  onSendVoiceNote,
  onOpenMediaPreview,
  replyMessage = null,
  onCancelReply,
  isEditing = false,
  onCancelEdit,
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
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // -------------------------------------------------------------
  // 1. STICKY KEYBOARD FOCUS RETENTION (Point 6)
  // -------------------------------------------------------------
  useEffect(() => {
    // Whenever replyMessage triggers or edit mode changes, focus the input
    if (replyMessage || isEditing) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [replyMessage, isEditing]);

  // Attachment popup menu state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // -------------------------------------------------------------
  // 2. REAL-TIME VOICE NOTES WITH PLAY/CANCEL/SEND (Point 16)
  // -------------------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Start recording audio
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (showToast) showToast("Microphone recording not supported on this device");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // Stop all audio tracks to free up mic
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);

      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      if (window.navigator?.vibrate) {
        window.navigator.vibrate(35);
      }
    } catch (err) {
      console.warn("Microphone access error:", err);
      if (showToast) showToast("Microphone access denied or unavailable");
    }
  };

  // Stop recording and show playback preview controls
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Discard recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setIsRecording(false);
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setIsPlayingRecorded(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Play / Pause recorded preview
  const togglePlayRecordedAudio = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingRecorded) {
      previewAudioRef.current.pause();
      setIsPlayingRecorded(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingRecorded(true);
    }
  };

  // Send confirmed voice note
  const sendRecordedVoiceNote = () => {
    if (!recordedAudioBlob) return;
    const durationStr = formatTimer(recordingSeconds);
    if (onSendVoiceNote) {
      onSendVoiceNote(recordedAudioBlob, durationStr);
    }
    cancelRecording();
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // -------------------------------------------------------------
  // 3. ATTACHMENT TRIGGERS (Point 15)
  // Photos/Videos opening MediaPreviewModal
  // -------------------------------------------------------------
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
      ? "image"
      : "file";

    const previewUrl = URL.createObjectURL(file);

    if (onOpenMediaPreview) {
      onOpenMediaPreview({
        file,
        fileUrl: previewUrl,
        fileName: file.name,
        fileType,
        caption: ""
      });
    }

    setShowAttachmentMenu(false);
    e.target.value = "";
  };

  // Handle Text Submit
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    if (onSendMessage) {
      onSendMessage(messageText.trim());
    }

    // Keep sticky keyboard focused (Point 6)
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: THEME.header,
        borderTop: `1px solid ${THEME.border}`,
        padding: "8px 12px",
        position: "relative",
        zIndex: 20
      }}
    >
      {/* --- SWIPE-TO-REPLY / EDITING BANNER --- */}
      {(replyMessage || isEditing) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: THEME.card,
            borderLeft: `4px solid ${THEME.primary}`,
            borderRadius: "6px",
            padding: "6px 10px",
            marginBottom: "6px",
            fontSize: "12px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            {isEditing ? (
              <Sparkles size={16} color={THEME.accent} />
            ) : (
              <Reply size={16} color={THEME.primary} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: "700", color: THEME.primary, fontSize: "11px" }}>
                {isEditing
                  ? "Editing Message"
                  : `Replying to ${replyMessage.senderName || "message"}`}
              </div>
              <div
                style={{
                  color: THEME.textMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "240px"
                }}
              >
                {isEditing ? messageText : replyMessage.content || "Attachment"}
              </div>
            </div>
          </div>

          <button
            onClick={isEditing ? onCancelEdit : onCancelReply}
            style={{ ...styles.cleanBtn, color: THEME.textMuted, padding: "4px" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* --- ATTACHMENT ACTION MENU POPUP --- */}
      {showAttachmentMenu && (
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            left: "14px",
            backgroundColor: THEME.sidebar,
            border: `1px solid ${THEME.border}`,
            borderRadius: "12px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
            zIndex: 30
          }}
        >
          {/* Photo picker */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*";
                fileInputRef.current.click();
              }
            }}
            style={{
              ...styles.settingsItem,
              backgroundColor: "transparent",
              padding: "8px 12px",
              cursor: "pointer",
              borderRadius: "6px"
            }}
          >
            <ImageIcon size={16} color={THEME.primary} />
            <span style={{ fontSize: "13px", color: THEME.text }}>Photo / Image</span>
          </button>

          {/* Video picker */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "video/*";
                fileInputRef.current.click();
              }
            }}
            style={{
              ...styles.settingsItem,
              backgroundColor: "transparent",
              padding: "8px 12px",
              cursor: "pointer",
              borderRadius: "6px"
            }}
          >
            <Video size={16} color="#60A5FA" />
            <span style={{ fontSize: "13px", color: THEME.text }}>Video File</span>
          </button>
        </div>
      )}

      {/* HIDDEN FILE INPUT */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* --- 2. VOICE NOTE PLAYBACK / RECORDING BAR --- */}
      {isRecording ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: THEME.card,
            padding: "8px 14px",
            borderRadius: "24px",
            border: `1px solid ${THEME.danger}`
          }}
        >
          {/* Pulsing indicator and timer */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: THEME.danger,
                animation: "pulse 1.2s infinite ease-in-out"
              }}
            />
            <span style={{ color: THEME.danger, fontWeight: "700", fontSize: "13px" }}>
              Recording: {formatTimer(recordingSeconds)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={cancelRecording}
              style={{ ...styles.cleanBtn, color: THEME.textMuted }}
              title="Cancel Recording"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={stopRecording}
              style={{
                ...styles.primaryBtn,
                backgroundColor: THEME.danger,
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                padding: 0
              }}
              title="Stop Recording"
            >
              <Square size={16} />
            </button>
          </div>
        </div>
      ) : recordedAudioBlob ? (
        /* Preview audio controls: Play / Cancel / Send */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: THEME.card,
            padding: "8px 14px",
            borderRadius: "24px",
            border: `1px solid ${THEME.primary}`
          }}
        >
          {/* Audio HTML element for playback */}
          <audio
            ref={previewAudioRef}
            src={recordedAudioUrl}
            onEnded={() => setIsPlayingRecorded(false)}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={togglePlayRecordedAudio}
              style={{
                ...styles.cleanBtn,
                backgroundColor: THEME.primary,
                color: "#fff",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title={isPlayingRecorded ? "Pause" : "Play"}
            >
              {isPlayingRecorded ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <span style={{ fontSize: "12px", color: THEME.text, fontWeight: "600" }}>
              Voice Note ({formatTimer(recordingSeconds)})
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={cancelRecording}
              style={{ ...styles.cleanBtn, color: THEME.danger }}
              title="Discard Voice Note"
            >
              <Trash2 size={18} />
            </button>

            <button
              onClick={sendRecordedVoiceNote}
              style={{
                ...styles.primaryBtn,
                backgroundColor: THEME.primary,
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                padding: 0
              }}
              title="Send Voice Note"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* --- NORMAL INPUT BAR WITH STICKY FOCUS --- */
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%"
          }}
        >
          {/* Paperclip Attachment Trigger Button */}
          <button
            type="button"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            style={{
              ...styles.cleanBtn,
              color: showAttachmentMenu ? THEME.primary : THEME.textMuted,
              padding: "8px"
            }}
            title="Attach file or photo"
          >
            <Paperclip size={20} />
          </button>

          {/* Sticky Text Input */}
          <div
            style={{
              flex: 1,
              backgroundColor: THEME.card,
              borderRadius: "24px",
              padding: "6px 14px",
              border: `1px solid ${THEME.border}`,
              display: "flex",
              alignItems: "center"
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="chatbox-input allow-text-select"
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{
                ...styles.bareInput,
                color: THEME.text,
                fontSize: "14px",
                width: "100%",
                userSelect: "text",
                WebkitUserSelect: "text"
              }}
            />
          </div>

          {/* Send or Mic Button */}
          {messageText.trim() ? (
            <button
              type="submit"
              style={{
                ...styles.primaryBtn,
                backgroundColor: THEME.primary,
                color: "#fff",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
              title="Send Message"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              style={{
                ...styles.cleanBtn,
                backgroundColor: THEME.cardHover,
                color: THEME.text,
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
              title="Record Voice Note"
            >
              <Mic size={18} color={THEME.primary} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
