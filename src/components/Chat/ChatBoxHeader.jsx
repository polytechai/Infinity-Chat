import React from "react";
import {
  ArrowLeft,
  Phone,
  Video,
  Clock,
  MoreVertical,
  Users
} from "lucide-react";
import { styles } from "../../firebase";

export default function ChatBoxHeader({
  activeChat,
  setActiveChat,
  setMobileView,
  peerPresence = { isOnline: false, lastSeen: "" },
  startCall,
  openProfile,
  setShowUserProfile,
  showChatOptions,
  setShowChatOptions,
  disappearingTimer = "off",
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
  }
}) {
  const isGroup = !!activeChat?.isGroup;
  const peerUserId = activeChat?.phone || activeChat?.id || "";

  // Check if disappearing messages are active
  const isDisappearingActive =
    (disappearingTimer && disappearingTimer !== "off") ||
    (activeChat?.disappearingTimer && activeChat?.disappearingTimer !== "off") ||
    (() => {
      try {
        const stored = localStorage.getItem(`infinity_disappearing_${peerUserId}`);
        return stored && stored !== "off";
      } catch (e) {
        return false;
      }
    })();

  const handleHeaderClick = () => {
    if (setShowUserProfile) setShowUserProfile(true);
    if (openProfile) openProfile(activeChat);
  };

  const handleBack = () => {
    if (setActiveChat) setActiveChat(null);
    if (setMobileView) setMobileView("list");
  };

  return (
    <div
      style={{
        ...styles.headerBar,
        backgroundColor: THEME.header,
        borderColor: THEME.border,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 14px",
        zIndex: 10,
        borderBottom: `1px solid ${THEME.border}`,
        userSelect: "none",
        WebkitUserSelect: "none"
      }}
    >
      {/* LEFT: BACK BUTTON & USER / GROUP INFO */}
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
          onClick={handleBack}
          style={{
            ...styles.cleanBtn,
            color: THEME.text,
            display: "flex",
            alignItems: "center",
            padding: "6px",
            cursor: "pointer"
          }}
          title="Back to chat list"
        >
          <ArrowLeft size={20} />
        </button>

        {/* CLICKABLE PROFILE TRIGGER */}
        <div
          onClick={handleHeaderClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            minWidth: 0,
            flex: 1
          }}
          title="View profile details"
        >
          {/* Avatar with Online/Group indicator */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src={
                activeChat?.avatar ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${
                  activeChat?.id || "user"
                }`
              }
              alt=""
              style={{
                ...styles.roundAvatar,
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover"
              }}
            />

            {/* Group icon badge */}
            {isGroup ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "-2px",
                  right: "-2px",
                  backgroundColor: THEME.primary,
                  borderRadius: "50%",
                  width: "15px",
                  height: "15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1.5px solid ${THEME.header}`
                }}
              >
                <Users size={9} color="#fff" />
              </div>
            ) : peerPresence?.isOnline ? (
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
            ) : null}
          </div>

          {/* Name, Status, and Disappearing Clock Indicator */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span
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
              </span>

              {/* Disappearing Messages Subtle Clock Icon */}
              {isDisappearingActive && (
                <span
                  title="Disappearing messages are enabled"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: THEME.accent,
                    flexShrink: 0
                  }}
                >
                  <Clock size={13} strokeWidth={2.2} />
                </span>
              )}
            </div>

            {/* Online Status / Last Seen / Group Participants */}
            <div
              style={{
                fontSize: "11px",
                color: isGroup
                  ? THEME.textMuted
                  : peerPresence?.isOnline
                  ? THEME.accent
                  : THEME.textMuted,
                fontWeight: !isGroup && peerPresence?.isOnline ? "600" : "400",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {isGroup
                ? `${
                    activeChat?.participants?.length || "Group"
                  } members • Tap for info`
                : peerPresence?.isOnline
                ? "Online"
                : peerPresence?.lastSeen
                ? `Last seen ${peerPresence.lastSeen}`
                : activeChat?.phone || "Available"}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: AUDIO CALL, VIDEO CALL & OPTIONS */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {/* Audio Call Button */}
        <button
          onClick={() => startCall && startCall(activeChat, "audio")}
          style={{
            ...styles.cleanBtn,
            color: THEME.text,
            padding: "8px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Start Audio Call"
        >
          <Phone size={18} />
        </button>

        {/* Video Call Button */}
        <button
          onClick={() => startCall && startCall(activeChat, "video")}
          style={{
            ...styles.cleanBtn,
            color: THEME.text,
            padding: "8px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          title="Start Video Call"
        >
          <Video size={18} />
        </button>

        {/* More Options Dropdown Toggle */}
        {setShowChatOptions && (
          <button
            onClick={() => setShowChatOptions(!showChatOptions)}
            style={{
              ...styles.cleanBtn,
              color: THEME.text,
              padding: "8px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title="More Options"
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
