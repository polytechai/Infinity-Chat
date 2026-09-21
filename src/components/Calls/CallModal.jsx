import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  RefreshCw,
  Clock,
  User
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, normalizePhone, getRoomId, styles } from "../../firebase";

// Robust STUN/TURN ICE servers configuration
export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" }
  ],
  iceCandidatePoolSize: 10
};

export default function CallModal({
  activeCall,
  incomingCall,
  acceptIncomingCall,
  rejectIncomingCall,
  endCall,
  localVideoRef,
  remoteVideoRef,
  callStatus = "Calling...",
  callDuration = 0,
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
  currentUser,
  activeChat,
  showToast
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState("user");
  const [permissionError, setPermissionError] = useState(null);
  const [internalDuration, setInternalDuration] = useState(0);

  const loggedCallIdsRef = useRef(new Set());
  const activeCallRef = useRef(activeCall);
  const durationTimerRef = useRef(null);

  // Sync ref
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const currentCall = activeCall || incomingCall;
  const isIncoming = !activeCall && !!incomingCall;
  const isVideo = currentCall?.type === "video";
  const isConnected = callStatus === "Connected" || callStatus === "In Call";

  // Peer Information
  const peerName =
    currentCall?.name ||
    currentCall?.callerName ||
    activeChat?.name ||
    currentCall?.phone ||
    "Contact";
  const peerPhone = currentCall?.phone || currentCall?.callerPhone || activeChat?.phone || "";
  const peerAvatar =
    currentCall?.avatar ||
    currentCall?.callerAvatar ||
    activeChat?.avatar ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${peerPhone || "call"}`;

  // Track call duration when connected
  useEffect(() => {
    if (isConnected) {
      durationTimerRef.current = setInterval(() => {
        setInternalDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [isConnected]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Toggle Microphone Mute
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (localVideoRef?.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getAudioTracks()
        .forEach((track) => (track.enabled = !next));
    }
    if (showToast) showToast(next ? "Microphone muted" : "Microphone active");
  };

  // Toggle Video Stream
  const toggleVideo = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    if (localVideoRef?.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getVideoTracks()
        .forEach((track) => (track.enabled = !next));
    }
    if (showToast) showToast(next ? "Video paused" : "Video resumed");
  };

  // Flip Camera
  const flipCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode },
        audio: true
      });
      if (localVideoRef?.current) {
        localVideoRef.current.srcObject = stream;
      }
      setFacingMode(newMode);
    } catch (err) {
      console.warn("Could not switch camera:", err);
    }
  };

  // -------------------------------------------------------------
  // 2. CALL LOG RECORDING (Point 14)
  // Calculates exact duration on hangup -> "Audio Call 02:45"
  // If unanswered/rejected -> "Missed Audio/Video Call" in red
  // -------------------------------------------------------------
  const logCallEntry = async (status, durationSecs) => {
    const callObj = activeCallRef.current || currentCall;
    if (!callObj || !db) return;

    const callId = callObj.callId || callObj.id || `${Date.now()}`;
    if (loggedCallIdsRef.current.has(callId)) return;
    loggedCallIdsRef.current.add(callId);

    const callerPhone = normalizePhone(callObj.callerPhone || currentUser?.phone || currentUser?.uid);
    const receiverPhone = normalizePhone(callObj.receiverPhone || callObj.phone || activeChat?.phone);

    if (!callerPhone || !receiverPhone) return;

    const roomId = getRoomId(callerPhone, receiverPhone);
    const callTypeStr = callObj.type === "video" ? "Video" : "Audio";

    const isMissed = status === "missed" || durationSecs === 0;
    const durationFormatted = formatDuration(durationSecs);

    const logMessage = isMissed
      ? `Missed ${callTypeStr} Call`
      : `${callTypeStr} Call (${durationFormatted})`;

    const msgId = `call_${Date.now()}`;

    try {
      // 1. Add call log message to the conversation thread
      await setDoc(doc(db, "rooms", roomId, "messages", msgId), {
        id: msgId,
        senderId: callerPhone,
        receiverId: receiverPhone,
        content: logMessage,
        type: "call_log",
        callType: callObj.type || "audio",
        callStatus: isMissed ? "missed" : "completed",
        duration: isMissed ? null : durationFormatted,
        durationSeconds: durationSecs,
        createdAt: new Date().toISOString()
      });

      // 2. Update conversation preview
      await setDoc(
        doc(db, "conversations", roomId),
        {
          lastMessage: logMessage,
          lastSenderId: callerPhone,
          lastMessageTimestamp: Date.now(),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Failed to record call log in Firestore:", err);
    }
  };

  // Handler for Rejecting / Declining Incoming Call
  const handleRejectCall = () => {
    logCallEntry("missed", 0);
    if (rejectIncomingCall) rejectIncomingCall();
  };

  // Handler for Ending Ongoing Call
  const handleEndCall = () => {
    const finalDuration = internalDuration || callDuration || 0;
    if (isConnected && finalDuration > 0) {
      logCallEntry("completed", finalDuration);
    } else {
      logCallEntry("missed", 0);
    }
    if (endCall) endCall();
  };

  return (
    <div
      style={{
        ...styles.modalOverlay,
        zIndex: 9999,
        backgroundColor: "rgba(5, 10, 14, 0.95)",
        backdropFilter: "blur(8px)",
        padding: 0
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "36px 20px 48px",
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* TOP STATUS HEADER */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            zIndex: 10
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              padding: "4px 12px",
              borderRadius: "16px",
              fontSize: "12px",
              color: THEME.text
            }}
          >
            {isVideo ? <Video size={14} color={THEME.accent} /> : <Phone size={14} color={THEME.accent} />}
            <span>{isVideo ? "Video Call" : "Audio Call"}</span>
          </div>

          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: isConnected ? THEME.primary : THEME.textMuted
            }}
          >
            {isConnected ? `In Call • ${formatDuration(internalDuration || callDuration)}` : callStatus}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 1. WEBRTC STREAMING (AUDIO / VIDEO) */}
        {/* ------------------------------------------------------------- */}
        <div
          style={{
            width: "100%",
            flex: 1,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            margin: "20px 0"
          }}
        >
          {/* VIDEO MODE: REMOTE AND LOCAL STREAMS */}
          {isVideo ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                backgroundColor: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {/* Remote Video Stream Element */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />

              {/* Local Video Stream Picture-in-Picture */}
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  right: "14px",
                  width: "100px",
                  height: "140px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: `2px solid ${THEME.primary}`,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
                  backgroundColor: "#111"
                }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: facingMode === "user" ? "scaleX(-1)" : "none"
                  }}
                />
              </div>
            </div>
          ) : (
            /* AUDIO MODE: CONTACT AVATAR PULSE */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "18px"
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "128px",
                  height: "128px",
                  borderRadius: "50%",
                  padding: "4px",
                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: isConnected ? "none" : "pulse 2s infinite ease-in-out"
                }}
              >
                <img
                  src={peerAvatar}
                  alt=""
                  style={{
                    width: "116px",
                    height: "116px",
                    borderRadius: "50%",
                    objectFit: "cover"
                  }}
                />
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: "700", color: THEME.text }}>
                  {peerName}
                </div>
                <div style={{ fontSize: "13px", color: THEME.textMuted, marginTop: "4px" }}>
                  {peerPhone}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            zIndex: 10,
            width: "100%"
          }}
        >
          {isIncoming ? (
            /* Incoming Call Controls: Decline (Red) / Accept (Green) */
            <>
              <button
                onClick={handleRejectCall}
                style={{
                  ...styles.cleanBtn,
                  backgroundColor: THEME.danger,
                  borderRadius: "50%",
                  width: "64px",
                  height: "64px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(239, 68, 68, 0.4)",
                  cursor: "pointer"
                }}
                title="Decline Call"
              >
                <PhoneOff size={28} />
              </button>

              <button
                onClick={acceptIncomingCall}
                style={{
                  ...styles.cleanBtn,
                  backgroundColor: THEME.primary,
                  borderRadius: "50%",
                  width: "64px",
                  height: "64px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(34, 197, 94, 0.4)",
                  cursor: "pointer"
                }}
                title="Accept Call"
              >
                <Phone size={28} />
              </button>
            </>
          ) : (
            /* Active Call Controls: Mute, Flip Camera, Pause Video, Hang Up */
            <>
              {/* Mic Mute Toggle */}
              <button
                onClick={toggleMute}
                style={{
                  ...styles.cleanBtn,
                  backgroundColor: isMuted ? THEME.danger : "rgba(255, 255, 255, 0.15)",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "50px",
                  height: "50px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {/* Video Flip / Camera Toggle (if video call) */}
              {isVideo && (
                <>
                  <button
                    onClick={flipCamera}
                    style={{
                      ...styles.cleanBtn,
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      borderRadius: "50%",
                      width: "50px",
                      height: "50px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer"
                    }}
                    title="Flip Camera"
                  >
                    <RefreshCw size={22} />
                  </button>

                  <button
                    onClick={toggleVideo}
                    style={{
                      ...styles.cleanBtn,
                      backgroundColor: isVideoOff ? THEME.danger : "rgba(255, 255, 255, 0.15)",
                      color: "#fff",
                      borderRadius: "50%",
                      width: "50px",
                      height: "50px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer"
                    }}
                    title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                  >
                    {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                </>
              )}

              {/* Hang Up Button (Red) */}
              <button
                onClick={handleEndCall}
                style={{
                  ...styles.cleanBtn,
                  backgroundColor: THEME.danger,
                  borderRadius: "50%",
                  width: "60px",
                  height: "60px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(239, 68, 68, 0.4)",
                  cursor: "pointer"
                }}
                title="End Call"
              >
                <PhoneOff size={26} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
