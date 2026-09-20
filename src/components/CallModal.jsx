import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  RefreshCw,
  AlertCircle,
  Clock
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, normalizePhone, getRoomId, styles } from "../firebase";

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
    sidebar: "#1E293B",
    border: "#334155",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    accent: "#38BDF8",
    primary: "#22C55E",
    danger: "#EF4444",
    card: "#0F172A"
  },
  t = {},
  currentUser: propCurrentUser,
  activeChat
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState("user"); // "user" (front) | "environment" (rear)
  const [permissionError, setPermissionError] = useState(null);
  const [internalDuration, setInternalDuration] = useState(0);

  // Prevent multiple logs for the same call
  const loggedCallIdsRef = useRef(new Set());
  const activeCallRef = useRef(activeCall);
  const incomingCallRef = useRef(incomingCall);
  const callDurationRef = useRef(0);
  const callStatusRef = useRef(callStatus);

  // Keep references up to date for cleanup/logging
  activeCallRef.current = activeCall;
  incomingCallRef.current = incomingCall;
  callStatusRef.current = callStatus;

  // Resolve current user from prop or local storage fallback
  const currentUser = propCurrentUser || (() => {
    try {
      const s = localStorage.getItem("infinity_chat_user");
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  })();

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const totalSecs = Math.max(0, Math.floor(secs || 0));
    const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
    const s = (totalSecs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Internal real-time timer when callStatus === "Connected"
  useEffect(() => {
    let timer = null;
    if (callStatus === "Connected") {
      timer = setInterval(() => {
        setInternalDuration((prev) => {
          const next = prev + 1;
          callDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      setInternalDuration(0);
      callDurationRef.current = 0;
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  // Sync external callDuration if provided
  useEffect(() => {
    if (callDuration > 0) {
      callDurationRef.current = callDuration;
    }
  }, [callDuration]);

  const effectiveDuration = callDuration > 0 ? callDuration : internalDuration;

  // Reset controls state on new call
  useEffect(() => {
    if (activeCall) {
      setIsMuted(false);
      setIsVideoOff(false);
      setFacingMode("user");
      setPermissionError(null);
    }
  }, [activeCall?.id]);

  // Check browser camera / microphone permissions
  const requestMediaPermissions = async (videoRequired = false) => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: videoRequired ? { facingMode } : false
      });
      return stream;
    } catch (err) {
      console.warn("Permission check error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionError("Camera and microphone permissions were blocked. Please enable them in your browser settings to continue.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setPermissionError("No camera or microphone device found on this system.");
      } else {
        setPermissionError(err.message || "Failed to access media devices.");
      }
      return null;
    }
  };

  // Toggle Microphone Mute/Unmute
  const handleToggleMic = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localVideoRef?.current?.srcObject) {
      const audioTracks = localVideoRef.current.srcObject.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
  };

  // Toggle Video Off/On
  const handleToggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);

    if (localVideoRef?.current?.srcObject) {
      const videoTracks = localVideoRef.current.srcObject.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !nextVideoOff;
      });
    }
  };

  // Toggle Camera Front / Rear
  const handleToggleCameraFacing = async () => {
    if (!activeCall || activeCall.type !== "video") return;
    const nextFacing = facingMode === "user" ? "environment" : "user";

    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing } },
          audio: false
        });
      } catch (fallbackErr) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
          audio: false
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && localVideoRef?.current?.srcObject) {
        const currentStream = localVideoRef.current.srcObject;
        const oldVideoTracks = currentStream.getVideoTracks();

        // Replace track in local stream
        oldVideoTracks.forEach((t) => {
          t.stop();
          currentStream.removeTrack(t);
        });
        currentStream.addTrack(newVideoTrack);

        // Update local video element
        localVideoRef.current.srcObject = currentStream;
        setFacingMode(nextFacing);
        setIsVideoOff(false);
      }
    } catch (err) {
      console.warn("Unable to switch camera:", err);
      // Fallback: simply toggle video track visibility
      handleToggleVideo();
    }
  };

  // --- AUTOMATIC CALL LOGGING INTO FIRESTORE CHAT THREAD ---
  const logCallEntry = async ({
    targetCall,
    isMissed,
    duration = 0
  }) => {
    if (!targetCall || !targetCall.id) return;
    if (loggedCallIdsRef.current.has(targetCall.id)) return;
    loggedCallIdsRef.current.add(targetCall.id);

    try {
      const myPhone = normalizePhone(currentUser?.phone || "");
      const peerPhone = normalizePhone(
        targetCall.peerPhone ||
        (targetCall.callerPhone === myPhone ? targetCall.recipientPhone : targetCall.callerPhone) ||
        activeChat?.id ||
        ""
      );

      if (!myPhone || !peerPhone) return;

      const roomId = getRoomId(myPhone, peerPhone);
      const callType = targetCall.type || targetCall.callType || "audio";
      const isCaller = targetCall.callerPhone ? targetCall.callerPhone === myPhone : !targetCall.peerAvatar;

      const callerPhone = isCaller ? myPhone : peerPhone;
      const callerName = isCaller
        ? (currentUser?.name || myPhone)
        : (targetCall.callerName || targetCall.peerName || peerPhone);
      const recipientPhone = isCaller ? peerPhone : myPhone;

      const durationText = formatTime(duration);
      const content = isMissed
        ? `Missed ${callType === "video" ? "Video" : "Audio"} Call`
        : `${callType === "video" ? "Video" : "Audio"} Call (${durationText})`;

      const msgId = `call_${Date.now()}`;
      const callDoc = {
        id: msgId,
        type: "call",
        callType,
        status: isMissed ? "missed" : "connected",
        duration: isMissed ? 0 : duration,
        content,
        senderId: callerPhone,
        senderPhone: callerPhone,
        senderName: callerName,
        recipientPhone,
        createdAt: new Date().toISOString(),
        read: false
      };

      // 1. Write message entry in Firestore room thread
      await setDoc(doc(db, "rooms", roomId, "messages", msgId), callDoc);

      // 2. Update conversation preview
      await setDoc(
        doc(db, "conversations", roomId),
        {
          id: roomId,
          participants: [callerPhone, recipientPhone],
          lastMessage: content,
          lastMessageTimestamp: Date.now(),
          lastSenderId: callerPhone,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to log call entry to Firestore:", err);
    }
  };

  // End active outgoing/connected call
  const handleEndCall = async () => {
    const isMissed = effectiveDuration === 0 && callStatus !== "Connected";
    if (activeCall) {
      await logCallEntry({
        targetCall: activeCall,
        isMissed,
        duration: effectiveDuration
      });
    }
    if (endCall) endCall();
  };

  // Decline incoming call
  const handleRejectIncomingCall = async () => {
    if (incomingCall) {
      await logCallEntry({
        targetCall: incomingCall,
        isMissed: true,
        duration: 0
      });
    }
    if (rejectIncomingCall) rejectIncomingCall();
  };

  // Accept incoming call
  const handleAcceptIncomingCall = async () => {
    const stream = await requestMediaPermissions(incomingCall?.callType === "video");
    if (acceptIncomingCall) acceptIncomingCall(stream);
  };

  // --- 1. INCOMING CALL OVERLAY ---
  if (incomingCall && !activeCall) {
    return (
      <div style={styles.callOverlay}>
        <div
          style={{
            ...styles.callBox,
            backgroundColor: THEME.sidebar,
            borderColor: THEME.border,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            textAlign: "center"
          }}
        >
          {/* Caller Avatar with Pulse Effect */}
          <div style={{ position: "relative", width: "86px", height: "86px", margin: "0 auto 16px" }}>
            <img
              src={incomingCall.callerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
                border: `3px solid ${THEME.primary}`
              }}
            />
          </div>

          <h3 style={{ margin: "0 0 6px", color: THEME.text, fontSize: "18px", fontWeight: "700" }}>
            {incomingCall.callerName || "Unknown Caller"}
          </h3>
          <p style={{ fontSize: "13px", color: THEME.accent, margin: "0 0 8px", fontWeight: "500" }}>
            {incomingCall.callType === "video" ? "📹 Incoming Video Call..." : "📞 Incoming Voice Call..."}
          </p>
          <span style={{ fontSize: "11px", color: THEME.textMuted, display: "block", marginBottom: "24px" }}>
            Bangladeshi Secure WebRTC Line
          </span>

          {permissionError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${THEME.danger}`,
                padding: "8px 12px",
                borderRadius: "8px",
                color: THEME.danger,
                fontSize: "12px",
                marginBottom: "16px",
                textAlign: "left"
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{permissionError}</span>
            </div>
          )}

          {/* Action Buttons: Reject & Accept */}
          <div style={{ display: "flex", justifyContent: "center", gap: "28px", marginTop: "8px" }}>
            {/* Decline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <button
                onClick={handleRejectIncomingCall}
                style={{
                  ...styles.circleBtn,
                  backgroundColor: THEME.danger,
                  width: "56px",
                  height: "56px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)"
                }}
                title="Decline"
              >
                <PhoneOff size={24} color="#fff" />
              </button>
              <span style={{ fontSize: "11px", color: THEME.textMuted }}>Decline</span>
            </div>

            {/* Accept */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <button
                onClick={handleAcceptIncomingCall}
                style={{
                  ...styles.circleBtn,
                  backgroundColor: THEME.primary,
                  width: "56px",
                  height: "56px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(34, 197, 94, 0.4)"
                }}
                title="Accept"
              >
                <Phone size={24} color="#fff" />
              </button>
              <span style={{ fontSize: "11px", color: THEME.primary, fontWeight: "600" }}>Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. ACTIVE OUTGOING / CONNECTED CALL OVERLAY ---
  if (activeCall) {
    const isVideo = activeCall.type === "video";
    const isConnected = callStatus === "Connected";

    return (
      <div style={styles.callOverlay}>
        <div
          style={{
            ...styles.callBox,
            backgroundColor: THEME.sidebar,
            borderColor: THEME.border,
            maxWidth: isVideo ? "560px" : "390px",
            width: "92vw",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
            textAlign: "center"
          }}
        >
          {/* Permission error prompt if device access is blocked */}
          {permissionError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${THEME.danger}`,
                padding: "8px 12px",
                borderRadius: "8px",
                color: THEME.danger,
                fontSize: "12px",
                marginBottom: "14px",
                textAlign: "left"
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>{permissionError}</div>
              <button
                onClick={() => requestMediaPermissions(isVideo)}
                style={{
                  background: THEME.danger,
                  color: "#fff",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  cursor: "pointer"
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Caller / Peer Avatar (shown directly for Audio calls) */}
          {!isVideo && (
            <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 12px" }}>
              <img
                src={activeCall.peerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `3px solid ${isConnected ? THEME.primary : THEME.accent}`
                }}
              />
            </div>
          )}

          <h3 style={{ margin: "0 0 4px", color: THEME.text, fontSize: "17px", fontWeight: "700" }}>
            {activeCall.peerName || "Contact"}
          </h3>

          {/* Status & Live Duration Counter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "13px",
              color: isConnected ? THEME.primary : THEME.accent,
              marginBottom: "16px",
              fontWeight: "500"
            }}
          >
            {isConnected ? (
              <>
                <Clock size={14} />
                <span>Connected • {formatTime(effectiveDuration)}</span>
              </>
            ) : (
              <span>{callStatus}</span>
            )}
          </div>

          {/* --- WebRTC Video Feeds --- */}
          {isVideo && (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "320px",
                backgroundColor: "#000",
                borderRadius: "12px",
                overflow: "hidden",
                marginBottom: "16px"
              }}
            >
              {/* Remote Peer Video Stream */}
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

              {/* Local User Self-Preview Stream (Picture-in-Picture) */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "12px",
                  width: "96px",
                  height: "128px",
                  borderRadius: "10px",
                  objectFit: "cover",
                  border: "2px solid #fff",
                  backgroundColor: "#1e293b",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.5)"
                }}
              />

              {/* Facing mode badge */}
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  backgroundColor: "rgba(0,0,0,0.6)",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "10px",
                  color: "#fff",
                  backdropFilter: "blur(4px)"
                }}
              >
                {facingMode === "user" ? "Front Camera" : "Rear Camera"}
              </div>
            </div>
          )}

          {/* Audio-only stream element for remote peer sound playback */}
          {!isVideo && (
            <audio ref={remoteVideoRef} autoPlay />
          )}

          {/* --- Call Controls: Mute Mic, Toggle Camera Front/Rear, Video Off/On, End Call --- */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "14px",
              marginTop: "16px",
              flexWrap: "wrap"
            }}
          >
            {/* 1. Mute / Unmute Mic Button */}
            <button
              onClick={handleToggleMic}
              style={{
                ...styles.circleBtn,
                width: "46px",
                height: "46px",
                backgroundColor: isMuted ? THEME.danger : THEME.card,
                color: isMuted ? "#fff" : THEME.text,
                border: `1px solid ${THEME.border}`,
                cursor: "pointer"
              }}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* 2. Video On / Off Button (for video calls) */}
            {isVideo && (
              <button
                onClick={handleToggleVideo}
                style={{
                  ...styles.circleBtn,
                  width: "46px",
                  height: "46px",
                  backgroundColor: isVideoOff ? THEME.danger : THEME.card,
                  color: isVideoOff ? "#fff" : THEME.text,
                  border: `1px solid ${THEME.border}`,
                  cursor: "pointer"
                }}
                title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
              >
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            {/* 3. Toggle Camera Front / Rear Button (for video calls) */}
            {isVideo && (
              <button
                onClick={handleToggleCameraFacing}
                style={{
                  ...styles.circleBtn,
                  width: "46px",
                  height: "46px",
                  backgroundColor: THEME.card,
                  color: THEME.accent,
                  border: `1px solid ${THEME.border}`,
                  cursor: "pointer"
                }}
                title={`Switch to ${facingMode === "user" ? "Rear" : "Front"} Camera`}
              >
                <RefreshCw size={19} />
              </button>
            )}

            {/* 4. End Call Button */}
            <button
              onClick={handleEndCall}
              style={{
                ...styles.circleBtn,
                backgroundColor: THEME.danger,
                width: "52px",
                height: "52px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)"
              }}
              title="End Call"
            >
              <PhoneOff size={24} color="#fff" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
