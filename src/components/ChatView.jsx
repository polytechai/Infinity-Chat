import React, { useState, Component } from "react";
import {
  Users,
  MessageSquare,
  Radio,
  Share2,
  Settings as SettingsIcon,
  Plus,
  AlertTriangle
} from "lucide-react";
import ChatList from "./Chat/ChatList";
import GroupModal from "./Chat/GroupModal";
import ChatBox from "./Chat/ChatBox";
import { styles } from "../firebase";

// Safe Error Boundary for ChatView sub-components
class SafeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("Error caught in ChatView SafeErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            color: "#8696A0"
          }}
        >
          <AlertTriangle size={32} color="#EF4444" style={{ marginBottom: "12px" }} />
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#E9EDEF", marginBottom: "6px" }}>
            Unable to display conversation list
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: "12px",
              padding: "8px 16px",
              backgroundColor: "#22c55e",
              color: "#fff",
              borderRadius: "16px",
              border: "none",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ChatView(props = {}) {
  // 1. SAFE PROPS HANDLING & NULL-CHECKS
  const {
    activeChat = null,
    setActiveChat = () => {},
    currentUser = null,
    activeUser = null,
    chats = [],
    onSelectChat = null,
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
    setMainTab = () => {},
    mobileView = "list",
    setMobileView = () => {},
    pinnedChats = [],
    onTogglePin = () => {},
    mutedChats = [],
    onToggleMute = () => {},
    showToast = () => {}
  } = props;

  // Normalized user & select chat handler
  const resolvedUser = currentUser || activeUser;
  const handleSelectChat = onSelectChat || setActiveChat;

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [conversationsCount, setConversationsCount] = useState(
    Array.isArray(chats) && chats.length > 0 ? chats.length : null
  );

  // ROUTE TO ACTIVE CHAT CONVERSATION (CHATBOX)
  if (activeChat) {
    return (
      <ChatBox
        {...props}
        activeChat={activeChat}
        setActiveChat={handleSelectChat}
        currentUser={resolvedUser}
        setMobileView={setMobileView}
      />
    );
  }

  // PRIMARY CHAT VIEW WITH SAFE SUB-COMPONENT RENDERING
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: THEME?.sidebar || "#111B21",
        color: THEME?.text || "#E9EDEF",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Scrollable Conversation List with Error Isolation */}
      <div style={{ flex: 1, width: "100%", height: "100%", overflow: "hidden" }}>
        <SafeErrorBoundary>
          <ChatList
            currentUser={resolvedUser}
            activeChat={activeChat}
            setActiveChat={handleSelectChat}
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
        </SafeErrorBoundary>
      </div>

      {/* 2. ISOLATION & CLEAN EMPTY STATE (Point 1) */}
      {conversationsCount === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            top: "56px",
            bottom: "56px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            backgroundColor: THEME?.sidebar || "#111B21",
            zIndex: 10,
            pointerEvents: "auto"
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              color: THEME?.primary || "#22c55e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px"
            }}
          >
            <Users size={28} />
          </div>

          <h3
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: THEME?.text || "#E9EDEF",
              marginBottom: "6px"
            }}
          >
            No chats yet
          </h3>

          <p
            style={{
              fontSize: "13px",
              color: THEME?.textMuted || "#8696A0",
              maxWidth: "280px",
              lineHeight: "1.4",
              marginBottom: "18px"
            }}
          >
            No chats yet. Start a new conversation or create a group!
          </p>

          <button
            onClick={() => setShowGroupModal(true)}
            style={{
              ...styles.primaryBtn,
              backgroundColor: THEME?.primary || "#22c55e",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 22px",
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

      {/* 3. FLOATING ACTION BUTTON (+) TO TRIGGER GROUPMODAL */}
      <button
        onClick={() => setShowGroupModal(true)}
        style={{
          position: "absolute",
          bottom: "68px",
          right: "20px",
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          backgroundColor: THEME?.primary || "#22c55e",
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

      {/* BOTTOM TAB BAR: ALWAYS VISIBLE FOR INSTANT TAB SWITCHING */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          backgroundColor: THEME?.header || "#202C33",
          borderTop: `1px solid ${THEME?.border || "#2A3942"}`,
          padding: "8px 0 10px",
          zIndex: 30,
          flexShrink: 0
        }}
      >
        <button
          onClick={() => setMainTab("chats")}
          style={{
            ...styles.cleanBtn,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            color: mainTab === "chats" ? THEME?.primary || "#22c55e" : THEME?.textMuted || "#8696A0",
            cursor: "pointer"
          }}
        >
          <MessageSquare size={19} />
          <span style={{ fontSize: "11px", fontWeight: mainTab === "chats" ? "700" : "500" }}>
            {t?.chats || "Chats"}
          </span>
        </button>

        <button
          onClick={() => setMainTab("feeds")}
          style={{
            ...styles.cleanBtn,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            color: mainTab === "feeds" || mainTab === "feed" ? THEME?.primary || "#22c55e" : THEME?.textMuted || "#8696A0",
            cursor: "pointer"
          }}
        >
          <Share2 size={19} />
          <span style={{ fontSize: "11px", fontWeight: mainTab === "feeds" || mainTab === "feed" ? "700" : "500" }}>
            {t?.feed || "Feeds"}
          </span>
        </button>

        <button
          onClick={() => setMainTab("channels")}
          style={{
            ...styles.cleanBtn,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            color: mainTab === "channels" ? THEME?.primary || "#22c55e" : THEME?.textMuted || "#8696A0",
            cursor: "pointer"
          }}
        >
          <Radio size={19} />
          <span style={{ fontSize: "11px", fontWeight: mainTab === "channels" ? "700" : "500" }}>
            {t?.channels || "Channels"}
          </span>
        </button>

        <button
          onClick={() => setMainTab("settings")}
          style={{
            ...styles.cleanBtn,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
            color: mainTab === "settings" ? THEME?.primary || "#22c55e" : THEME?.textMuted || "#8696A0",
            cursor: "pointer"
          }}
        >
          <SettingsIcon size={19} />
          <span style={{ fontSize: "11px", fontWeight: mainTab === "settings" ? "700" : "500" }}>
            {t?.settings || "Settings"}
          </span>
        </button>
      </div>

      {/* Group Creation Overlay Modal */}
      {showGroupModal && (
        <GroupModal
          currentUser={resolvedUser}
          onClose={() => setShowGroupModal(false)}
          onGroupCreated={(newGroup) => {
            handleSelectChat(newGroup);
            setMobileView("chat");
          }}
          THEME={THEME}
          showToast={showToast}
        />
      )}
    </div>
  );
}
