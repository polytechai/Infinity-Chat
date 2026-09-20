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
  Smile,
  Mic,
  MicOff,
  Download,
  Play,
  Pause,
  RotateCw,
  Crop,
  Palette,
  Sparkles,
  PhoneCall,
  PhoneMissed,
  Square,
  AlertCircle
} from "lucide-react";
import { db, styles, normalizePhone } from "../../firebase";

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

// Helper to format seconds to mm:ss
function formatTime(secs = 0) {
  const totalSecs = Math.max(0, Math.floor(secs || 0));
  const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
  const s = (totalSecs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Interactive Audio Bubble Player Component
function AudioBubblePlayer({ fileUrl, duration = 0, THEME, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.floor(audio.duration));
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [fileUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.warn("Audio play error:", err));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = pct * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Render simulated waveform frequency bars
  const waveBars = [35, 60, 45, 80, 95, 70, 50, 85, 60, 40, 75, 90, 65, 45, 70, 55];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 10px",
        borderRadius: "10px",
        backgroundColor: "rgba(0,0,0,0.18)",
        minWidth: "220px",
        maxWidth: "280px"
      }}
    >
      <audio ref={audioRef} src={fileUrl} preload="metadata" />

      {/* Play / Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          backgroundColor: isMe ? THEME.primary : THEME.accent,
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
          flexShrink: 0
        }}
      >
        {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" style={{ marginLeft: "2px" }} />}
      </button>

      {/* Waveform Scrubber & Timer */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={handleSeek}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            height: "26px",
            cursor: "pointer",
            padding: "2px 0"
          }}
          title="Click to seek"
        >
          {waveBars.map((height, idx) => {
            const barPct = (idx / waveBars.length) * 100;
            const isPlayed = barPct <= progressPct;
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${height}%`,
                  backgroundColor: isPlayed ? (isMe ? THEME.primary : THEME.accent) : "rgba(255,255,255,0.3)",
                  borderRadius: "2px",
                  transition: "background-color 0.1s linear"
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            opacity: 0.75,
            marginTop: "2px"
          }}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration || duration)}</span>
        </div>
      </div>
    </div>
  );
}

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

  // -------------------------------------------------------------
  // 1. MEDIA PREVIEW & EDIT STATE (Point 15)
  // -------------------------------------------------------------
  const [pendingMedia, setPendingMedia] = useState(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [brushColor, setBrushColor] = useState("#22c55e");
  const [brushSize, setBrushSize] = useState(5);
  const [isBrushActive, setIsBrushActive] = useState(false);
  const [mediaRotation, setMediaRotation] = useState(0); // 0, 90, 180, 270

  // -------------------------------------------------------------
  // 2. REAL-TIME VOICE MESSAGES (Point 16)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 3. PUSH NOTIFICATIONS TRACKING (Point 11 & 14)
  // -------------------------------------------------------------
  const lastKnownMsgIdRef = useRef(null);

  // Request browser Notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Check incoming messages and trigger push notifications if window in background or not active
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const latestMsg = messages[messages.length - 1];
    if (!latestMsg || !latestMsg.id) return;

    if (lastKnownMsgIdRef.current && lastKnownMsgIdRef.current !== latestMsg.id) {
      const isFromPeer =
        latestMsg.senderPhone !== currentUserId &&
        latestMsg.senderId !== currentUserId;

      if (isFromPeer) {
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const title = activeChat?.name || latestMsg.senderName || "New Message";
          let body = latestMsg.content || "";
          if (latestMsg.type === "call" || latestMsg.callType) {
            body = latestMsg.content;
          } else if (latestMsg.type === "image") {
            body = "📷 Photo received";
          } else if (latestMsg.type === "video") {
            body = "📹 Video received";
          } else if (latestMsg.type === "voice" || latestMsg.type === "audio") {
            body = "🎤 Voice message";
          } else if (latestMsg.type === "file") {
            body = `📎 File: ${latestMsg.fileName || "document"}`;
          }

          const icon =
            activeChat?.avatar ||
            latestMsg.senderAvatar ||
            `https://api.dicebear.com/7.x/identicon/svg?seed=${latestMsg.senderId || "user"}`;

          try {
            const notification = new Notification(title, {
              body,
              icon,
              badge: icon,
              tag: latestMsg.id,
              silent: false
            });
            notification.onclick = () => {
              window.focus();
            };
          } catch (e) {
            console.warn("Push notification failed:", e);
          }
        }
      }
    }

    lastKnownMsgIdRef.current = latestMsg.id;
  }, [messages, currentUserId, activeChat]);

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
    setPendingMedia(null);
    cleanupVoiceRecording();
  }, [activeChat?.id]);

  // Smooth scroll to bottom on new message if user is near bottom
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < 320) {
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

  // -------------------------------------------------------------
  // ATTACHMENT DOWNLOAD TO LOCAL STORAGE
  // -------------------------------------------------------------
  const handleDownloadAttachment = (e, fileUrl, fileName = "infinity_download") => {
    e.stopPropagation();
    if (!fileUrl) return;

    try {
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (showToast) showToast(`Downloaded: ${fileName}`);
    } catch (err) {
      console.warn("Download error, opening directly:", err);
      window.open(fileUrl, "_blank");
    }
  };

  // -------------------------------------------------------------
  // SEND MESSAGE & STICKY KEYBOARD FOCUS
  // -------------------------------------------------------------
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

    // Sticky keyboard retention
    setTimeout(() => {
      inputRef.current?.focus();
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 40);
  };

  // -------------------------------------------------------------
  // MEDIA PREVIEW & EDITING MODAL (Point 15)
  // -------------------------------------------------------------
  const handleFileSelect = (e, fileType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    const reader = new FileReader();

    reader.onload = (loadEvt) => {
      const base64Data = loadEvt.target.result;
      setPendingMedia({
        file,
        fileType,
        rawDataUrl: base64Data,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + " KB",
        isHD: false,
        caption: ""
      });
      setMediaRotation(0);
      setIsBrushActive(false);
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Draw image into canvas on initial load or rotation
  useEffect(() => {
    if (!pendingMedia || pendingMedia.fileType !== "image" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = pendingMedia.rawDataUrl;

    img.onload = () => {
      const isRotated = mediaRotation % 180 !== 0;
      const targetW = isRotated ? img.height : img.width;
      const targetH = isRotated ? img.width : img.height;

      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(targetW, targetH));
      canvas.width = targetW * scale;
      canvas.height = targetH * scale;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((mediaRotation * Math.PI) / 180);
      const drawW = isRotated ? canvas.height : canvas.width;
      const drawH = isRotated ? canvas.width : canvas.height;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    };
  }, [pendingMedia?.rawDataUrl, mediaRotation]);

  // Canvas Brush Drawing handlers
  const startDrawing = (e) => {
    if (!isBrushActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const drawOnCanvas = (e) => {
    if (!isDrawingRef.current || !isBrushActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleRotateImage = () => {
    setMediaRotation((prev) => (prev + 90) % 360);
  };

  const handleSendEditedMedia = () => {
    if (!pendingMedia) return;

    let finalDataUrl = pendingMedia.rawDataUrl;
    if (pendingMedia.fileType === "image" && canvasRef.current) {
      finalDataUrl = canvasRef.current.toDataURL(
        "image/jpeg",
        pendingMedia.isHD ? 0.98 : 0.75
      );
    }

    const payload = {
      type: pendingMedia.fileType,
      fileUrl: finalDataUrl,
      fileName: pendingMedia.fileName,
      fileSize: pendingMedia.fileSize,
      isHD: pendingMedia.isHD,
      content: pendingMedia.caption.trim() || (pendingMedia.fileType === "image" ? "Photo" : pendingMedia.fileType === "video" ? "Video" : pendingMedia.fileName),
      isViewOnce: !!viewOnceMode
    };

    if (onSendMedia) {
      onSendMedia(payload);
    } else if (onSendMessage) {
      onSendMessage(payload);
    }

    setPendingMedia(null);
    if (showToast) showToast(`${pendingMedia.isHD ? "HD " : ""}${pendingMedia.fileType} sent!`);
  };

  // -------------------------------------------------------------
  // REAL-TIME VOICE RECORDING LOGIC (Point 16)
  // -------------------------------------------------------------
  const cleanupVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (visualizerAnimRef.current) {
      cancelAnimationFrame(visualizerAnimRef.current);
      visualizerAnimRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRecordingVoice(false);
    setVoiceRecordingSeconds(0);
    setRecordedAudioBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setIsPreviewingVoice(false);
  };

  const startVoiceRecording = async () => {
    try {
      cleanupVoiceRecording();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Setup Web Audio Analyser for dynamic voice wave bars
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWave = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const bars = [];
        const step = Math.floor(dataArray.length / 9);
        for (let i = 0; i < 9; i++) {
          const val = dataArray[i * step] || 0;
          bars.push(Math.max(12, Math.min(100, Math.floor((val / 255) * 100))));
        }
        setVoiceWaveform(bars);
        visualizerAnimRef.current = requestAnimationFrame(updateWave);
      };
      updateWave();

      // Setup MediaRecorder
      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedAudioBlob(blob);
        setRecordedAudioUrl(url);
        setIsPreviewingVoice(true);
      };

      recorder.start(100);
      setIsRecordingVoice(true);
      setVoiceRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn("Microphone access error:", err);
      if (showToast) {
        showToast("Microphone access denied. Enable mic in browser settings.");
      }
    }
  };

  const stopVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (visualizerAnimRef.current) {
      cancelAnimationFrame(visualizerAnimRef.current);
      visualizerAnimRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecordingVoice(false);
  };

  const handleSendVoiceNote = () => {
    if (!recordedAudioBlob) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      const durationText = formatTime(voiceRecordingSeconds);
      const payload = {
        type: "voice",
        fileUrl: base64Data,
        fileName: `Voice_${Date.now()}.webm`,
        duration: voiceRecordingSeconds,
        content: `🎤 Voice note (${durationText})`,
        isViewOnce: !!viewOnceMode
      };

      if (onSendMedia) {
        onSendMedia(payload);
      } else if (onSendMessage) {
        onSendMessage(payload);
      }
      cleanupVoiceRecording();
      if (showToast) showToast("Voice message sent!");
    };
    reader.readAsDataURL(recordedAudioBlob);
  };

  // -------------------------------------------------------------
  // GESTURE & ACTION CONTROLS (Swipe to reply, long press, etc)
  // -------------------------------------------------------------
  const handleTouchStart = (e, msg) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isSwipingHorizontal.current = false;
    isLongPressTriggered.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

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

    if (Math.abs(deltaY) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!isSwipingHorizontal.current) return;
    }

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
    if (offset >= 30 && !isLongPressTriggered.current) {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(25);
      }
      setReplyingTo({
        id: msg.id,
        content: msg.content || (msg.fileUrl ? "Media file" : ""),
        senderName: msg.senderName || "User"
      });

      setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
    }

    setBubbleOffsets((prev) => ({ ...prev, [msg.id]: 0 }));
    isSwipingHorizontal.current = false;
  };

  // Long-press Actions
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
          `Reminder scheduled for ${new Date(scheduleDateTime).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })}`
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

  const isMsgSentByMe = (msg) =>
    msg && (msg.senderPhone === currentUserId || msg.senderId === currentUserId);

  return (
    <div
      className="chatbox-root"
      onContextMenu={(e) => e.preventDefault()}
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
              <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
            </button>

            <button
              onClick={() => {
                setVanishMode && setVanishMode(!vanishMode);
                setShowChatOptions(false);
                if (showToast)
                  showToast(
                    !vanishMode ? "Vanish Mode ON (15s)" : "Vanish Mode OFF"
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

      {/* --- MESSAGES CONTAINER --- */}
      <div
        ref={messagesContainerRef}
        className="overflow-y-auto overscroll-y-contain -webkit-overflow-scrolling-touch h-full"
        onTouchMove={(e) => e.stopPropagation()}
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
              color: THEME.textMuted,
              fontSize: "13px"
            }}
          >
            No messages yet. Send a greeting, share media, or record a voice note!
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isMe = isMsgSentByMe(msg);
            const isDeleted = msg.type === "deleted" || msg.isDeleted;
            const isCall = msg.type === "call" || msg.callType;
            const isVoice = msg.type === "voice" || msg.type === "audio";
            const isMedia = !!msg.fileUrl && !isVoice;
            const isStarred = msg.starred?.[currentUserId] || msg.isStarred;
            const offset = bubbleOffsets[msg.id] || 0;

            return (
              <div
                key={msg.id}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchMove={(e) => handleTouchMove(e, msg.id)}
                onTouchEnd={(e) => handleTouchEnd(e, msg)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setToolbarMessage(msg);
                  setShowFullEmojiPicker(false);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  transform: `translateX(${offset}px)`,
                  transition: isSwipingHorizontal.current ? "none" : "transform 0.15s ease",
                  position: "relative"
                }}
              >
                {/* Swipe Reply indicator icon */}
                {offset > 10 && (
                  <div
                    style={{
                      position: "absolute",
                      left: "-28px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      opacity: Math.min(1, offset / 30)
                    }}
                  >
                    <Reply size={18} color={THEME.primary} />
                  </div>
                )}

                {/* --- MESSAGE BUBBLE --- */}
                <div
                  style={{
                    maxWidth: "82%",
                    padding: isCall ? "10px 14px" : isMedia ? "6px" : "8px 12px",
                    borderRadius: "14px",
                    backgroundColor: isCall
                      ? msg.status === "missed" || msg.content?.toLowerCase().includes("missed")
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(34, 197, 94, 0.15)"
                      : isMe
                      ? THEME.primary
                      : THEME.card,
                    color: isMe && !isCall ? "#fff" : THEME.text,
                    border: isCall
                      ? `1px solid ${
                          msg.status === "missed" || msg.content?.toLowerCase().includes("missed")
                            ? "rgba(239, 68, 68, 0.45)"
                            : "rgba(34, 197, 94, 0.45)"
                        }`
                      : `1px solid ${THEME.border}`,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    position: "relative",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    if (isCall && startCall) {
                      startCall(activeChat, msg.callType || "audio");
                    }
                  }}
                >
                  {/* Quoted Replying Header */}
                  {msg.replyTo && (
                    <div
                      style={{
                        backgroundColor: "rgba(0,0,0,0.18)",
                        borderLeft: `3px solid ${isMe ? "#fff" : THEME.primary}`,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        marginBottom: "6px",
                        fontSize: "11px"
                      }}
                    >
                      <div style={{ fontWeight: "700", opacity: 0.9 }}>
                        {msg.replyTo.senderName || "User"}
                      </div>
                      <div
                        style={{
                          opacity: 0.75,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {msg.replyTo.content}
                      </div>
                    </div>
                  )}

                  {/* 1. CALL LOG BUBBLE (Point 11 & 14) */}
                  {isCall && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        minWidth: "210px"
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          backgroundColor:
                            msg.status === "missed" || msg.content?.toLowerCase().includes("missed")
                              ? "rgba(239, 68, 68, 0.2)"
                              : "rgba(34, 197, 94, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        {msg.status === "missed" || msg.content?.toLowerCase().includes("missed") ? (
                          <PhoneMissed size={18} color="#EF4444" />
                        ) : msg.callType === "video" ? (
                          <Video size={18} color="#22C55E" />
                        ) : (
                          <PhoneCall size={18} color="#22C55E" />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: "700",
                            fontSize: "13px",
                            color:
                              msg.status === "missed" || msg.content?.toLowerCase().includes("missed")
                                ? "#EF4444"
                                : "#22C55E"
                          }}
                        >
                          {msg.content || (msg.status === "missed" ? "Missed Call" : "Audio Call")}
                        </div>
                        <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                          {msg.status === "missed" || msg.content?.toLowerCase().includes("missed")
                            ? "Unanswered • Tap to call back"
                            : "Completed • Tap to call back"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. REAL-TIME VOICE NOTE PLAYER BUBBLE (Point 16) */}
                  {isVoice && (
                    <div style={{ position: "relative" }}>
                      <AudioBubblePlayer
                        fileUrl={msg.fileUrl}
                        duration={msg.duration || 0}
                        THEME={THEME}
                        isMe={isMe}
                      />

                      {/* Download button for voice note */}
                      <button
                        onClick={(e) =>
                          handleDownloadAttachment(
                            e,
                            msg.fileUrl,
                            msg.fileName || `voice_note_${Date.now()}.webm`
                          )
                        }
                        style={{
                          position: "absolute",
                          right: "6px",
                          top: "6px",
                          background: "none",
                          border: "none",
                          color: isMe ? "rgba(255,255,255,0.7)" : THEME.textMuted,
                          cursor: "pointer",
                          padding: "4px"
                        }}
                        title="Download Voice Note"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  )}

                  {/* 3. MEDIA ATTACHMENT BUBBLE WITH DOWNLOAD BUTTON (Point 15) */}
                  {isMedia && (
                    <div
                      style={{
                        borderRadius: "8px",
                        overflow: "hidden",
                        marginBottom: "4px",
                        position: "relative"
                      }}
                    >
                      {/* HD Badge if sent in HD quality */}
                      {msg.isHD && (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            left: "8px",
                            backgroundColor: "rgba(0,0,0,0.65)",
                            color: "#38BDF8",
                            fontSize: "10px",
                            fontWeight: "800",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backdropFilter: "blur(4px)",
                            zIndex: 2
                          }}
                        >
                          HD
                        </div>
                      )}

                      {/* Attachment Download Action Button */}
                      <button
                        onClick={(e) =>
                          handleDownloadAttachment(
                            e,
                            msg.fileUrl,
                            msg.fileName || (msg.type === "image" ? "photo.jpg" : msg.type === "video" ? "video.mp4" : "document")
                          )
                        }
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          backgroundColor: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: "30px",
                          height: "30px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          backdropFilter: "blur(4px)",
                          zIndex: 2,
                          transition: "transform 0.15s ease"
                        }}
                        title="Download Attachment"
                      >
                        <Download size={15} />
                      </button>

                      {msg.type === "video" ? (
                        <video
                          src={msg.fileUrl}
                          controls
                          style={{
                            width: "100%",
                            maxHeight: "220px",
                            borderRadius: "8px",
                            objectFit: "cover",
                            display: "block"
                          }}
                        />
                      ) : msg.type === "image" ? (
                        <img
                          src={msg.fileUrl}
                          alt=""
                          onClick={() => onLightbox && onLightbox(msg.fileUrl)}
                          style={{
                            width: "100%",
                            maxHeight: "240px",
                            borderRadius: "8px",
                            objectFit: "cover",
                            display: "block",
                            cursor: "pointer"
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor: "rgba(0,0,0,0.15)",
                            padding: "10px",
                            borderRadius: "8px"
                          }}
                        >
                          <FileText size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {msg.fileName || "Download file"}
                            </div>
                            <div style={{ fontSize: "10px", opacity: 0.7 }}>
                              {msg.fileSize || "File attachment"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  {!isCall && !isVoice && (
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
                  )}

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

      {/* ------------------------------------------------------------- */}
      {/* 4. MEDIA PREVIEW & EDIT MODAL (Point 15) */}
      {/* ------------------------------------------------------------- */}
      {pendingMedia && (
        <div
          style={{
            ...styles.modalOverlay,
            zIndex: 5000,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)"
          }}
        >
          <div
            style={{
              width: "92%",
              maxWidth: "460px",
              backgroundColor: THEME.sidebar,
              border: `1px solid ${THEME.border}`,
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.7)"
            }}
          >
            {/* Modal Header with HD Toggle & Tools */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                backgroundColor: THEME.header
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: "700", color: THEME.text, fontSize: "14px" }}>
                  Preview & Edit
                </span>
                {/* HD Quality Toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setPendingMedia((prev) => ({ ...prev, isHD: !prev.isHD }))
                  }
                  style={{
                    backgroundColor: pendingMedia.isHD ? THEME.primary : THEME.card,
                    color: pendingMedia.isHD ? "#fff" : THEME.textMuted,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: "14px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer"
                  }}
                  title="Toggle High Definition (HD)"
                >
                  <Sparkles size={12} />
                  <span>{pendingMedia.isHD ? "HD ON" : "Standard"}</span>
                </button>
              </div>

              {/* Editing Tools (Rotate & Brush/Draw) for Image */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {pendingMedia.fileType === "image" && (
                  <>
                    <button
                      type="button"
                      onClick={handleRotateImage}
                      style={{
                        ...styles.cleanBtn,
                        color: THEME.text,
                        padding: "6px",
                        backgroundColor: THEME.card,
                        borderRadius: "8px"
                      }}
                      title="Rotate 90°"
                    >
                      <RotateCw size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsBrushActive(!isBrushActive)}
                      style={{
                        ...styles.cleanBtn,
                        color: isBrushActive ? THEME.primary : THEME.text,
                        padding: "6px",
                        backgroundColor: isBrushActive ? "rgba(34, 197, 94, 0.2)" : THEME.card,
                        borderRadius: "8px"
                      }}
                      title="Brush / Draw"
                    >
                      <Palette size={17} />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  style={{ ...styles.cleanBtn, color: THEME.textMuted, padding: "6px" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Brush Colors Bar when Brush Active */}
            {isBrushActive && pendingMedia.fileType === "image" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 14px",
                  backgroundColor: THEME.card,
                  borderBottom: `1px solid ${THEME.border}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {["#ffffff", "#ef4444", "#22c55e", "#38bdf8", "#facc15", "#ec4899", "#000000"].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBrushColor(color)}
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          backgroundColor: color,
                          border: brushColor === color ? "2px solid #fff" : "1px solid rgba(0,0,0,0.4)",
                          cursor: "pointer",
                          transform: brushColor === color ? "scale(1.2)" : "scale(1)"
                        }}
                      />
                    )
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: THEME.textMuted }}>
                  <span>Size:</span>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    style={{ width: "70px", cursor: "pointer" }}
                  />
                </div>
              </div>
            )}

            {/* Canvas / Preview Display */}
            <div
              style={{
                padding: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#000",
                maxHeight: "360px",
                overflow: "hidden"
              }}
            >
              {pendingMedia.fileType === "image" ? (
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={drawOnCanvas}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={drawOnCanvas}
                  onTouchEnd={stopDrawing}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "340px",
                    borderRadius: "8px",
                    cursor: isBrushActive ? "crosshair" : "default",
                    touchAction: "none"
                  }}
                />
              ) : pendingMedia.fileType === "video" ? (
                <video
                  src={pendingMedia.rawDataUrl}
                  controls
                  style={{ maxWidth: "100%", maxHeight: "340px", borderRadius: "8px" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                    padding: "30px",
                    color: THEME.text
                  }}
                >
                  <FileText size={48} color={THEME.accent} />
                  <span style={{ fontWeight: "600", fontSize: "14px" }}>
                    {pendingMedia.fileName}
                  </span>
                  <span style={{ fontSize: "12px", color: THEME.textMuted }}>
                    {pendingMedia.fileSize}
                  </span>
                </div>
              )}
            </div>

            {/* Caption Input Field */}
            <div
              style={{
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                backgroundColor: THEME.sidebar,
                borderTop: `1px solid ${THEME.border}`
              }}
            >
              <input
                type="text"
                placeholder="Add a caption..."
                value={pendingMedia.caption}
                onChange={(e) =>
                  setPendingMedia((prev) => ({ ...prev, caption: e.target.value }))
                }
                className="chatbox-input"
                style={{
                  ...styles.bareInput,
                  color: THEME.text,
                  backgroundColor: THEME.card,
                  padding: "10px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  flex: 1,
                  border: `1px solid ${THEME.border}`
                }}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSendEditedMedia}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: THEME.primary,
                  color: "#fff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0
                }}
                title="Send"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. VOICE NOTE PREVIEW BANNER (Point 16) */}
      {/* ------------------------------------------------------------- */}
      {isPreviewingVoice && recordedAudioUrl && (
        <div
          style={{
            backgroundColor: THEME.header,
            borderTop: `1.5px solid ${THEME.accent}`,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
            <audio
              ref={previewAudioRef}
              src={recordedAudioUrl}
              onPlay={() => setIsVoicePreviewPlaying(true)}
              onPause={() => setIsVoicePreviewPlaying(false)}
              onEnded={() => setIsVoicePreviewPlaying(false)}
            />

            <button
              type="button"
              onClick={() => {
                if (!previewAudioRef.current) return;
                if (isVoicePreviewPlaying) {
                  previewAudioRef.current.pause();
                } else {
                  previewAudioRef.current.play();
                }
              }}
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: THEME.accent,
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              {isVoicePreviewPlaying ? <Pause size={15} fill="#fff" /> : <Play size={15} fill="#fff" style={{ marginLeft: "2px" }} />}
            </button>

            <div style={{ fontSize: "13px", color: THEME.text }}>
              Voice Note ({formatTime(voiceRecordingSeconds)})
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={cleanupVoiceRecording}
              style={{
                ...styles.cleanBtn,
                color: THEME.danger,
                padding: "8px"
              }}
              title="Discard"
            >
              <Trash2 size={18} />
            </button>

            <button
              type="button"
              onClick={handleSendVoiceNote}
              style={{
                backgroundColor: THEME.primary,
                color: "#fff",
                border: "none",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer"
              }}
            >
              <Send size={14} />
              <span>Send</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. REAL-TIME RECORDING BAR (Wave Visualizer & Timer) (Point 16) */}
      {/* ------------------------------------------------------------- */}
      {isRecordingVoice && (
        <div
          style={{
            backgroundColor: THEME.header,
            borderTop: `1px solid ${THEME.danger}`,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px"
          }}
        >
          {/* Pulsing Recording Indicator & Timer */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: THEME.danger,
                boxShadow: "0 0 8px #EF4444"
              }}
            />
            <span style={{ color: THEME.text, fontWeight: "700", fontSize: "13px" }}>
              {formatTime(voiceRecordingSeconds)}
            </span>
          </div>

          {/* Real-time Waveform Visualizer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              height: "28px",
              flex: 1,
              justifyContent: "center",
              maxWidth: "200px"
            }}
          >
            {voiceWaveform.map((h, idx) => (
              <div
                key={idx}
                style={{
                  width: "4px",
                  height: `${h}%`,
                  backgroundColor: THEME.primary,
                  borderRadius: "2px",
                  transition: "height 0.08s ease"
                }}
              />
            ))}
          </div>

          {/* Cancel & Stop Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={cleanupVoiceRecording}
              style={{
                ...styles.cleanBtn,
                color: THEME.textMuted,
                padding: "6px"
              }}
              title="Cancel Recording"
            >
              <Trash2 size={18} />
            </button>

            <button
              type="button"
              onClick={stopVoiceRecording}
              style={{
                backgroundColor: THEME.danger,
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
              title="Stop & Preview"
            >
              <Square size={16} fill="#fff" />
            </button>
          </div>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && !isRecordingVoice && !isPreviewingVoice && (
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

      {/* --- 7. CHAT INPUT COMPOSER --- */}
      {!isRecordingVoice && !isPreviewingVoice && (
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

          {/* Input Box with ref for sticky keyboard focus */}
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

          {/* Send button when text typed, Microphone button when empty */}
          {inputText.trim() || editingMessage ? (
            <button
              type="submit"
              onMouseDown={(e) => e.preventDefault()}
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
                flexShrink: 0
              }}
              title={editingMessage ? "Update message" : "Send message"}
            >
              {editingMessage ? <CheckCircle size={18} /> : <Send size={17} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceRecording}
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
                flexShrink: 0
              }}
              title="Record Voice Note"
            >
              <Mic size={18} />
            </button>
          )}
        </form>
      )}

      {/* --- LONG-PRESS MESSAGE TOOLBAR MODAL --- */}
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
              maxHeight: "85vh",
              overflowY: "auto"
            }}
          >
            {/* Quick Reaction Bar */}
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
                      lineHeight: "1"
                    }}
                  >
                    {emo}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
                style={{
                  backgroundColor: showFullEmojiPicker ? THEME.primary : THEME.header,
                  color: showFullEmojiPicker ? "#fff" : THEME.text,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0
                }}
                title="All Emojis"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Extended Emoji Picker */}
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 1fr)",
                    gap: "6px",
                    textAlign: "center"
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
                        padding: "4px 0"
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                backgroundColor: THEME.card,
                borderRadius: "14px",
                overflow: "hidden",
                border: `1px solid ${THEME.border}`
              }}
            >
              <button
                onClick={() => handleReplyAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <Reply size={16} color={THEME.accent} />
                <span>Reply</span>
              </button>

              <button
                onClick={() => handleCopyAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <Copy size={16} color="#60A5FA" />
                <span>Copy</span>
              </button>

              <button
                onClick={() => handleForwardAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <Share2 size={16} color="#A78BFA" />
                <span>Forward</span>
              </button>

              <button
                onClick={() => handleStarAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <Star size={16} color="#FACC15" />
                <span>Star</span>
              </button>

              <button
                onClick={() => handlePinAction()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.text,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <Pin size={16} color={THEME.primary} />
                <span>Pin Message</span>
              </button>

              {isMsgSentByMe(toolbarMessage) && (
                <button
                  onClick={() => handleEditAction()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: THEME.text,
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  <Edit2 size={16} color="#34D399" />
                  <span>Edit Message</span>
                </button>
              )}

              <button
                onClick={() => setShowDeleteDialog(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: THEME.danger,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                <Trash2 size={16} color={THEME.danger} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE DIALOG MODAL --- */}
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
              <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
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
    </div>
  );
}
