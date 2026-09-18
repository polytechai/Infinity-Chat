import React, { useState } from "react";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff
} from "lucide-react";
import { styles } from "../firebase";

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
  THEME,
  t
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Format call timer to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // --- 1. FULL-SCREEN INCOMING CALL OVERLAY ---
  if (incomingCall && !activeCall) {
    return (
      <div style={styles.callOverlay}>
        <div style={{ ...styles.callBox, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
          <img
            src={incomingCall.callerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
            alt=""
            style={{ width: "86px", height: "86px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 14px", border: `3px solid ${THEME.accent}` }}
          />
          <h3 style={{ margin: "0 0 6px", color: THEME.text, fontSize: "18px" }}>{incomingCall.callerName}</h3>
          <p style={{ fontSize: "14px", color: THEME.accent, margin: "0 0 24px", fontWeight: "600" }}>
            {incomingCall.callType === "video" ? "📹 Incoming Video Call..." : "📞 Incoming Voice Call..."}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "28px" }}>
            {/* Decline Call */}
            <button
              onClick={rejectIncomingCall}
              style={{ ...styles.circleBtn, backgroundColor: THEME.danger, width: "56px", height: "56px" }}
              title="Decline"
            >
              <PhoneOff size={24} color="#fff" />
            </button>
            {/* Accept Call */}
            <button
              onClick={acceptIncomingCall}
              style={{ ...styles.circleBtn, backgroundColor: THEME.accent, width: "56px", height: "56px" }}
              title="Accept"
            >
              <Phone size={24} color="#fff" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. ACTIVE OUTGOING / ONGOING CALL OVERLAY ---
  if (activeCall) {
    const isVideo = activeCall.type === "video";

    return (
      <div style={styles.callOverlay}>
        <div
          style={{
            ...styles.callBox,
            backgroundColor: THEME.sidebar,
            borderColor: THEME.border,
            maxWidth: isVideo ? "560px" : "380px"
          }}
        >
          <img
            src={activeCall.peerAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
            alt=""
            style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px" }}
          />
          <h3 style={{ margin: "0 0 4px", color: THEME.text, fontSize: "16px" }}>{activeCall.peerName}</h3>
          
          {/* Dynamic Status: Ringing... / Calling... / Connected (mm:ss) */}
          <p style={{ fontSize: "13px", color: callStatus === "Connected" ? THEME.accent : THEME.secondary, margin: "0 0 16px", fontWeight: "600" }}>
            {callStatus} {callDuration > 0 ? `(${formatTime(callDuration)})` : ""}
          </p>

          {/* WebRTC Video Streams (Google STUN STUN:stun.l.google.com:19302) */}
          {isVideo && (
            <div style={styles.videoBox}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={styles.fullVideo}
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "10px",
                  width: "90px",
                  height: "70px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: "2px solid #fff",
                  backgroundColor: "#111"
                }}
              />
            </div>
          )}

          {/* Audio-only stream indicator */}
          {!isVideo && (
            <audio ref={remoteVideoRef} autoPlay />
          )}

          {/* Controls: Mute Microphone, Toggle Camera, End Call */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "18px", marginTop: "16px" }}>
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (localVideoRef?.current?.srcObject) {
                  const tracks = localVideoRef.current.srcObject.getAudioTracks();
                  tracks.forEach((t) => (t.enabled = isMuted));
                }
              }}
              style={{ ...styles.iconBtn, backgroundColor: isMuted ? THEME.danger : THEME.card, color: THEME.text }}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {isVideo && (
              <button
                onClick={() => {
                  setIsVideoOff(!isVideoOff);
                  if (localVideoRef?.current?.srcObject) {
                    const tracks = localVideoRef.current.srcObject.getVideoTracks();
                    tracks.forEach((t) => (t.enabled = isVideoOff));
                  }
                }}
                style={{ ...styles.iconBtn, backgroundColor: isVideoOff ? THEME.danger : THEME.card, color: THEME.text }}
                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
            )}

            {/* End / Hang Up Call */}
            <button
              onClick={endCall}
              style={{ ...styles.circleBtn, backgroundColor: THEME.danger, width: "50px", height: "50px" }}
              title="End Call"
            >
              <PhoneOff size={22} color="#fff" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
