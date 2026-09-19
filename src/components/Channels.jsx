import React, { useState, useRef, useMemo } from "react";
import {
  Users,
  Plus,
  Send,
  Trash2,
  Archive,
  ArchiveRestore,
  UserPlus,
  UserMinus,
  Heart,
  Share2,
  X,
  Volume2,
  VolumeX,
  Shield,
  ArrowLeft,
  MoreVertical,
  AlertTriangle
} from "lucide-react";
import { styles } from "../firebase";

export default function Channels({
  channels = [],
  activeChannel,
  setActiveChannel,
  channelPosts = [],
  currentUser,
  THEME,
  t,
  onToggleSubscribe,
  onBroadcastPost,
  onPromoteAdmin,
  onDemoteAdmin,
  onToggleLike,
  onReaction,
  onForward,
  onLightbox,
  setMobileView,
  showToast
}) {
  const currentUserId = currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  // Local state for Channel creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  // Local state for Broadcasting posts
  const [postContent, setPostContent] = useState("");
  const [promotePhoneInput, setPromotePhoneInput] = useState("");

  // Tab filter: Active vs Archived Channels/Chats
  const [viewFilter, setViewFilter] = useState("active"); // "active" | "archived"

  // Per-user Archive & Deleted lists persisted locally & synced with user ID
  const [userArchivedIds, setUserArchivedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_archived_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [userDeletedIds, setUserDeletedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_deleted_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Long-press Context Modal state
  const [contextItem, setContextItem] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const pressTimer = useRef(null);
  const isLongPressTriggered = useRef(false);

  // --- 1. STRICT USER CHAT & CHANNEL ISOLATION ---
  // Ensure User A only sees their own subscribed or created channels / chats,
  // preventing cross-account leaks of conversation items.
  const userIsolatedChannels = useMemo(() => {
    if (!currentUserId) return [];
    return channels.filter((ch) => {
      // Must not be marked as deleted by the current user
      if (userDeletedIds.includes(ch.id)) return false;

      // Check ownership or explicit subscription by this specific user
      const isCreator = ch.creatorPhone === currentUserId || ch.creatorId === currentUserId;
      const isAdmin = Array.isArray(ch.admins) && ch.admins.includes(currentUserId);
      const isSubscribed = Array.isArray(ch.subscribers) && ch.subscribers.includes(currentUserId);

      // User must be a participant, creator, admin, or subscriber
      return isCreator || isAdmin || isSubscribed;
    });
  }, [channels, currentUserId, userDeletedIds]);

  // Split into Active vs Archived
  const displayedChannels = useMemo(() => {
    return userIsolatedChannels.filter((ch) => {
      const isArchived = userArchivedIds.includes(ch.id);
      return viewFilter === "archived" ? isArchived : !isArchived;
    });
  }, [userIsolatedChannels, userArchivedIds, viewFilter]);

  // --- 2. LONG-PRESS / PRESS-HOLD EVENT HANDLERS (~500ms threshold) ---
  const handleTouchStart = (item) => {
    isLongPressTriggered.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(40);
      }
      setContextItem(item);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleItemClick = (ch) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    setActiveChannel(ch);
    if (setMobileView) setMobileView("chat");
  };

  // --- 3. ARCHIVE / UNARCHIVE ACTION ---
  const handleToggleArchive = (chId) => {
    const isCurrentlyArchived = userArchivedIds.includes(chId);
    let nextList;
    if (isCurrentlyArchived) {
      nextList = userArchivedIds.filter((id) => id !== chId);
      if (showToast) showToast("Chat restored to active list");
    } else {
      nextList = [...userArchivedIds, chId];
      if (showToast) showToast("Chat moved to archived");
      if (activeChannel?.id === chId) {
        setActiveChannel(null);
      }
    }
    setUserArchivedIds(nextList);
    try {
      localStorage.setItem(`infinity_archived_${currentUserId}`, JSON.stringify(nextList));
    } catch (e) {}
    setContextItem(null);
  };

  // --- 4. DELETE CHAT / CHANNEL ACTION ---
  const handleExecuteDelete = () => {
    if (!contextItem) return;
    const targetId = contextItem.id;
    const nextDeleted = [...userDeletedIds, targetId];
    setUserDeletedIds(nextDeleted);

    try {
      localStorage.setItem(`infinity_deleted_${currentUserId}`, JSON.stringify(nextDeleted));
    } catch (e) {}

    if (activeChannel?.id === targetId) {
      setActiveChannel(null);
      if (setMobileView) setMobileView("list");
    }

    if (showToast) showToast("Chat conversation deleted");
    setShowConfirmDelete(false);
    setContextItem(null);
  };

  // --- 5. CHANNEL CREATION ---
  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    if (onPromoteAdmin) {
      await onPromoteAdmin("create", {
        name: newChannelName.trim(),
        desc: newChannelDesc.trim(),
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(newChannelName.trim())}`
      });
    }
    setNewChannelName("");
    setNewChannelDesc("");
    setShowCreateModal(false);
    if (showToast) showToast("Channel created successfully!");
  };

  // --- 6. BROADCAST SUBMISSION ---
  const handleSendBroadcast = (e) => {
    e.preventDefault();
    if (!postContent.trim() || !activeChannel) return;
    if (onBroadcastPost) {
      onBroadcastPost(activeChannel, postContent.trim());
    }
    setPostContent("");
  };

  const isAdmin = useMemo(() => {
    if (!activeChannel) return false;
    return (
      activeChannel.creatorPhone === currentUserId ||
      activeChannel.creatorId === currentUserId ||
      (Array.isArray(activeChannel.admins) && activeChannel.admins.includes(currentUserId))
    );
  }, [activeChannel, currentUserId]);

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", overflow: "hidden", position: "relative" }}>
      {/* LEFT COLUMN: User-Isolated Channels List */}
      <div
        style={{
          width: "100%",
          maxWidth: activeChannel ? "340px" : "100%",
          display: activeChannel && window.innerWidth < 768 ? "none" : "flex",
          flexDirection: "column",
          borderRight: `1px solid ${THEME.border}`,
          backgroundColor: THEME.sidebar,
          height: "100%",
          overflow: "hidden"
        }}
      >
        {/* Header with Archive Filter & New Channel Button */}
        <div
          style={{
            ...styles.headerBar,
            backgroundColor: THEME.header,
            borderColor: THEME.border,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color={THEME.primary} />
            <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
              {viewFilter === "archived" ? "Archived Chats" : "Channels & Chats"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setViewFilter(viewFilter === "active" ? "archived" : "active")}
              title={viewFilter === "active" ? "View Archived" : "View Active"}
              style={{
                ...styles.cleanBtn,
                color: viewFilter === "archived" ? THEME.primary : THEME.textMuted,
                padding: "6px"
              }}
            >
              {viewFilter === "archived" ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                backgroundColor: THEME.primary,
                border: "none",
                borderRadius: "50%",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#fff"
              }}
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Isolated List with Long-Press */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "6px"
          }}
        >
          {displayedChannels.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
              <Users size={36} style={{ margin: "0 auto 10px", opacity: 0.6 }} />
              <div style={{ fontSize: "13px", fontWeight: "600" }}>
                {viewFilter === "archived" ? "No archived chats" : "No active channels found"}
              </div>
              <div style={{ fontSize: "11px", marginTop: "4px" }}>
                {viewFilter === "archived"
                  ? "Long-press any chat item to archive it"
                  : "Tap '+' above to create your own broadcast channel"}
              </div>
            </div>
          ) : (
            displayedChannels.map((ch) => {
              const isSelected = activeChannel?.id === ch.id;
              const isUserSubscribed = Array.isArray(ch.subscribers) && ch.subscribers.includes(currentUserId);
              const isUserAdmin =
                ch.creatorPhone === currentUserId ||
                ch.creatorId === currentUserId ||
                (Array.isArray(ch.admins) && ch.admins.includes(currentUserId));

              return (
                <div
                  key={ch.id}
                  onClick={() => handleItemClick(ch)}
                  onTouchStart={() => handleTouchStart(ch)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(ch)}
                  onMouseUp={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextItem(ch);
                  }}
                  style={{
                    ...styles.contactItem,
                    backgroundColor: isSelected ? THEME.cardHover : "transparent",
                    borderLeft: isSelected ? `3px solid ${THEME.primary}` : "3px solid transparent",
                    userSelect: "none",
                    WebkitUserSelect: "none"
                  }}
                >
                  <img
                    src={ch.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${ch.id}`}
                    alt=""
                    style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "700", fontSize: "13px", color: THEME.text }}>{ch.name}</span>
                      {isUserAdmin && (
                        <span
                          style={{
                            fontSize: "9px",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(37, 211, 102, 0.15)",
                            color: THEME.primary,
                            fontWeight: "700"
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: THEME.textMuted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {ch.desc || `${(ch.subscribers || []).length} subscriber(s)`}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextItem(ch);
                    }}
                    style={{
                      ...styles.cleanBtn,
                      color: THEME.textMuted,
                      padding: "6px"
                    }}
                    title="Options"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Channel Feed & Broadcasting View */}
      {activeChannel ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: THEME.bg,
            height: "100%",
            overflow: "hidden"
          }}
        >
          {/* Channel Header */}
          <div
            style={{
              ...styles.headerBar,
              backgroundColor: THEME.header,
              borderColor: THEME.border,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => {
                  setActiveChannel(null);
                  if (setMobileView) setMobileView("list");
                }}
                style={{ ...styles.cleanBtn, color: THEME.text, display: "flex", alignItems: "center" }}
              >
                <ArrowLeft size={18} />
              </button>
              <img
                src={activeChannel.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeChannel.id}`}
                alt=""
                style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
              />
              <div>
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{activeChannel.name}</div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  {(activeChannel.subscribers || []).length} subscriber(s) • {isAdmin ? "You are Admin" : "Subscriber"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={(e) => onToggleSubscribe && onToggleSubscribe(activeChannel, e)}
                style={{
                  ...styles.pillBtn,
                  backgroundColor:
                    Array.isArray(activeChannel.subscribers) && activeChannel.subscribers.includes(currentUserId)
                      ? THEME.card
                      : THEME.primary,
                  color:
                    Array.isArray(activeChannel.subscribers) && activeChannel.subscribers.includes(currentUserId)
                      ? THEME.textMuted
                      : "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {Array.isArray(activeChannel.subscribers) && activeChannel.subscribers.includes(currentUserId) ? (
                  <>
                    <VolumeX size={14} />
                    <span>Subscribed</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={14} />
                    <span>Subscribe</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setContextItem(activeChannel)}
                style={{ ...styles.cleanBtn, color: THEME.text }}
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          {/* Posts List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              WebkitOverflowScrolling: "touch"
            }}
          >
            {channelPosts.length === 0 ? (
              <div style={{ textAlign: "center", margin: "auto", color: THEME.textMuted }}>
                <Users size={48} style={{ opacity: 0.3, marginBottom: "8px" }} />
                <div style={{ fontSize: "14px" }}>No broadcasts published yet</div>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>
                  {isAdmin ? "Broadcast news, updates, or messages below." : "Updates will show here."}
                </div>
              </div>
            ) : (
              channelPosts.map((post) => {
                const isLiked = post.likes && post.likes[currentUserId];
                const likeCount = Object.keys(post.likes || {}).length;

                return (
                  <div
                    key={post.id}
                    style={{
                      backgroundColor: THEME.card,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      border: `1px solid ${THEME.border}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Shield size={14} color={THEME.primary} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: THEME.text }}>
                        {post.authorName || activeChannel.name}
                      </span>
                      <span style={{ fontSize: "10px", color: THEME.textMuted, marginLeft: "auto" }}>
                        {post.createdAt ? new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: THEME.text, lineHeight: "1.4", whiteSpace: "pre-wrap" }}>
                      {post.content}
                    </div>

                    {post.fileUrl && (
                      <div
                        onClick={() => onLightbox && onLightbox({ url: post.fileUrl, type: post.type, name: post.fileName })}
                        style={{ cursor: "pointer", borderRadius: "8px", overflow: "hidden", maxHeight: "240px" }}
                      >
                        {post.type === "video" ? (
                          <video src={post.fileUrl} controls style={{ width: "100%", maxHeight: "240px", objectFit: "cover" }} />
                        ) : (
                          <img src={post.fileUrl} alt="" style={{ width: "100%", maxHeight: "240px", objectFit: "cover" }} />
                        )}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "6px" }}>
                      <button
                        onClick={() => onToggleLike && onToggleLike(post.id)}
                        style={{
                          ...styles.cleanBtn,
                          color: isLiked ? THEME.danger : THEME.textMuted,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px"
                        }}
                      >
                        <Heart size={14} fill={isLiked ? THEME.danger : "none"} />
                        <span>{likeCount > 0 ? likeCount : ""}</span>
                      </button>

                      <button
                        onClick={() => onForward && onForward(post)}
                        style={{ ...styles.cleanBtn, color: THEME.textMuted, display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                      >
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Admin Broadcast Input Bar */}
          {isAdmin ? (
            <form
              onSubmit={handleSendBroadcast}
              style={{
                padding: "10px 14px",
                backgroundColor: THEME.header,
                borderTop: `1px solid ${THEME.border}`,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <input
                type="text"
                placeholder="Broadcast an announcement to channel..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                style={{ ...styles.bareInput, color: THEME.text, backgroundColor: THEME.card, padding: "8px 12px", borderRadius: "20px" }}
              />
              <button
                type="submit"
                disabled={!postContent.trim()}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !postContent.trim() ? 0.5 : 1
                }}
              >
                <Send size={16} />
              </button>
            </form>
          ) : (
            <div
              style={{
                padding: "10px",
                textAlign: "center",
                backgroundColor: THEME.header,
                borderTop: `1px solid ${THEME.border}`,
                color: THEME.textMuted,
                fontSize: "12px"
              }}
            >
              Only channel administrators can post in this broadcast channel.
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: window.innerWidth < 768 ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: THEME.textMuted,
            gap: "10px"
          }}
        >
          <Users size={56} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: "15px", fontWeight: "600", color: THEME.text }}>Channels & Broadcasts</div>
          <p style={{ fontSize: "12px", maxWidth: "280px", textAlign: "center", lineHeight: "1.4" }}>
            Select a channel to read announcements or create your own community.
          </p>
        </div>
      )}

      {/* --- LONG-PRESS CONTEXT MENU (BOTTOM SHEET / MODAL) --- */}
      {contextItem && (
        <div
          onClick={() => {
            setContextItem(null);
            setShowConfirmDelete(false);
          }}
          style={{
            ...styles.modalOverlay,
            zIndex: 4000,
            alignItems: "flex-end",
            padding: 0
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "500px",
              backgroundColor: THEME.sidebar,
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
              border: `1px solid ${THEME.border}`,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
              margin: "0 auto"
            }}
          >
            {/* Header info */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "8px", borderBottom: `1px solid ${THEME.border}` }}>
              <img
                src={contextItem.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${contextItem.id}`}
                alt=""
                style={{ width: "36px", height: "36px", borderRadius: "50%" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{contextItem.name}</div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>Manage conversation options</div>
              </div>
              <button
                onClick={() => {
                  setContextItem(null);
                  setShowConfirmDelete(false);
                }}
                style={styles.cleanBtn}
              >
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            {/* Confirmation State for Deletion */}
            {showConfirmDelete ? (
              <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: THEME.danger, fontSize: "13px", fontWeight: "600" }}>
                  <AlertTriangle size={18} />
                  <span>Delete this chat for your account?</span>
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                  This will remove the chat from your active list. You can rejoin or start fresh anytime.
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    style={{ ...styles.pillBtn, backgroundColor: THEME.card, color: THEME.text }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteDelete}
                    style={{ ...styles.pillBtn, backgroundColor: THEME.danger, color: "#fff", fontWeight: "700" }}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {/* Archive / Unarchive Option */}
                <button
                  onClick={() => handleToggleArchive(contextItem.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: THEME.text,
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.cardHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {userArchivedIds.includes(contextItem.id) ? (
                    <>
                      <ArchiveRestore size={18} color={THEME.primary} />
                      <span>Unarchive Chat</span>
                    </>
                  ) : (
                    <>
                      <Archive size={18} color={THEME.primary} />
                      <span>Archive Chat</span>
                    </>
                  )}
                </button>

                {/* Delete Option */}
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: THEME.danger,
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = THEME.cardHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Trash2 size={18} color={THEME.danger} />
                  <span>Delete Chat</span>
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setContextItem(null)}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: `1px solid ${THEME.border}`,
                    backgroundColor: THEME.card,
                    color: THEME.textMuted,
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    marginTop: "6px"
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CREATE CHANNEL MODAL --- */}
      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>Create Broadcast Channel</div>
              <button onClick={() => setShowCreateModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={styles.label}>Channel Name</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="text"
                    placeholder="e.g. Bangladesh News & Updates"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    style={{ ...styles.bareInput, color: THEME.text }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label style={styles.label}>Description (Optional)</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="text"
                    placeholder="What is this channel about?"
                    value={newChannelDesc}
                    onChange={(e) => setNewChannelDesc(e.target.value)}
                    style={{ ...styles.bareInput, color: THEME.text }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!newChannelName.trim()}
                style={{ ...styles.primaryBtn, backgroundColor: THEME.primary, marginTop: "4px" }}
              >
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
