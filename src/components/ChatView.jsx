import React, { useState } from "react";
import {
  Users,
  MessageSquare,
  Radio,
  Share2,
  Settings as SettingsIcon
} from "lucide-react";
import ChatList from "./Chat/ChatList";
import GroupModal from "./Chat/GroupModal";
import ChatBox from "./Chat/ChatBox";
import { styles } from "../firebase";

export default function ChatView(props) {
  const {
    activeChat,
    setActiveChat,
    currentUser,
    messages = [],
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
    t = {},
    mainTab = "chats",
    setMainTab,
    mobileView = "list",
    setMobileView,
    pinnedChats = [],
    onTogglePin,
    mutedChats = [],
    onToggleMute,
    showToast
  } = props;

  // Group Creation Overlay Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);

  // -------------------------------------------------------------
  // 1. CONVERSATION VIEW ROUTING:
  // When activeChat is selected, route smoothly to ChatBox
  // -------------------------------------------------------------
  if (activeChat) {
    return (
      <ChatBox
        {...props}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        setMobileView={setMobileView}
      />
    );
  }

  // -------------------------------------------------------------
  // 2. PRIMARY INDEX VIEW:
  // Render ChatList, Floating "New Group" Action Button, & GroupModal
  // -------------------------------------------------------------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: THEME.sidebar,
        color: THEME.text,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* --- TOP TAB BAR (Chats, Feeds, Channels, Settings) --- */}
      {setMainTab && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            backgroundColor: THEME.header,
            borderBottom: `1px solid ${THEME.border}`,
            padding: "8px 4px",
            zIndex: 10
          }}
        >
          {/* Chats Tab */}
          <button
            onClick={() => setMainTab("chats")}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "6px 0",
              color: mainTab === "chats" ? THEME.primary : THEME.textMuted,
              borderBottom:
                mainTab === "chats"
                  ? `2px solid ${THEME.primary}`
                  : "2px solid transparent",
              cursor: "pointer"
            }}
          >
            <MessageSquare size={18} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: mainTab === "chats" ? "700" : "500"
              }}
            >
              {t?.chats || "Chats"}
            </span>
          </button>

          {/* Feeds Tab */}
          <button
            onClick={() => setMainTab("feed")}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "6px 0",
              color: mainTab === "feed" ? THEME.primary : THEME.textMuted,
              borderBottom:
                mainTab === "feed"
                  ? `2px solid ${THEME.primary}`
                  : "2px solid transparent",
              cursor: "pointer"
            }}
          >
            <Share2 size={18} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: mainTab === "feed" ? "700" : "500"
              }}
            >
              {t?.feed || "Feeds"}
            </span>
          </button>

          {/* Channels Tab */}
          <button
            onClick={() => setMainTab("channels")}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "6px 0",
              color: mainTab === "channels" ? THEME.primary : THEME.textMuted,
              borderBottom:
                mainTab === "channels"
                  ? `2px solid ${THEME.primary}`
                  : "2px solid transparent",
              cursor: "pointer"
            }}
          >
            <Radio size={18} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: mainTab === "channels" ? "700" : "500"
              }}
            >
              {t?.channels || "Channels"}
            </span>
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setMainTab("settings")}
            style={{
              ...styles.cleanBtn,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "6px 0",
              color: mainTab === "settings" ? THEME.primary : THEME.textMuted,
              borderBottom:
                mainTab === "settings"
                  ? `2px solid ${THEME.primary}`
                  : "2px solid transparent",
              cursor: "pointer"
            }}
          >
            <SettingsIcon size={18} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: mainTab === "settings" ? "700" : "500"
              }}
            >
              {t?.settings || "Settings"}
            </span>
          </button>
        </div>
      )}

      {/* --- PRIMARY VIEW: CHATLIST INDEX --- */}
      <div style={{ flex: 1, width: "100%", height: "100%", overflow: "hidden" }}>
        <ChatList
          currentUser={currentUser}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
          setMobileView={setMobileView}
          THEME={THEME}
          t={t}
          pinnedChats={pinnedChats}
          onTogglePin={onTogglePin}
          mutedChats={mutedChats}
          onToggleMute={onToggleMute}
          showToast={showToast}
        />
      </div>

      {/* --- FLOATING "NEW GROUP" ACTION BUTTON --- */}
      <button
        onClick={() => setShowGroupModal(true)}
        style={{
          position: "absolute",
          bottom: "22px",
          right: "20px",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          backgroundColor: THEME.primary,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 18px rgba(34, 197, 94, 0.4)",
          border: "none",
          cursor: "pointer",
          zIndex: 40,
          transition: "transform 0.15s ease",
          WebkitTapHighlightColor: "transparent"
        }}
        title="Create New Group"
      >
        <Users size={22} />
      </button>

      {/* --- GROUP CREATION OVERLAY MODAL --- */}
      {showGroupModal && (
        <GroupModal
          currentUser={currentUser}
          onClose={() => setShowGroupModal(false)}
          onGroupCreated={(newGroup) => {
            if (setActiveChat) setActiveChat(newGroup);
            if (setMobileView) setMobileView("chat");
          }}
          THEME={THEME}
          showToast={showToast}
        />
      )}
    </div>
  );
}
