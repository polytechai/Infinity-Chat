import React, { useState } from "react";
import {
  Users,
  MessageSquare,
  MessageSquarePlus,
  Plus
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

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [conversationsCount, setConversationsCount] = useState(null);

  // 1. ACTIVE CONVERSATION VIEW ROUTING:
  // When activeChat is selected, route cleanly to ChatBox
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

  // 2. PRIMARY CHAT LIST & EMPTY STATE CONTAINER:
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
      {/* Primary Sub-Component: ChatList */}
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
          onConversationsCountChange={(count) => setConversationsCount(count)}
          onCreateGroup={() => setShowGroupModal(true)}
          showToast={showToast}
        />
      </div>

      {/* Interactive Empty State (Point 1: Isolation) when 0 conversations exist */}
      {conversationsCount === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            top: "60px", // leave search bar accessible
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            backgroundColor: THEME.sidebar,
            zIndex: 10,
            pointerEvents: "auto"
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              color: THEME.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px"
            }}
          >
            <MessageSquarePlus size={32} />
          </div>

          <h3
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: THEME.text,
              marginBottom: "8px"
            }}
          >
            No conversations yet
          </h3>

          <p
            style={{
              fontSize: "13px",
              color: THEME.textMuted,
              maxWidth: "280px",
              lineHeight: "1.5",
              marginBottom: "20px"
            }}
          >
            No conversations yet. Start a new chat or create a group!
          </p>

          <button
            onClick={() => setShowGroupModal(true)}
            style={{
              ...styles.primaryBtn,
              backgroundColor: THEME.primary,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "24px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(34, 197, 94, 0.3)"
            }}
          >
            <Users size={16} />
            <span>Create Group</span>
          </button>
        </div>
      )}

      {/* Floating Action Button (+) to Trigger GroupModal */}
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
          color: "#ffffff",
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
        title="Create Group"
      >
        <Plus size={24} />
      </button>

      {/* Group Creation Overlay Modal */}
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
