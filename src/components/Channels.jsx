import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit
} from "firebase/firestore";
import {
  Users,
  Plus,
  Send,
  Trash2,
  Archive,
  ArchiveRestore,
  MoreVertical,
  AlertTriangle,
  ArrowLeft,
  Volume2,
  VolumeX,
  Shield,
  Heart,
  Share2,
  X,
  Search,
  MessageSquarePlus,
  UserPlus
} from "lucide-react";
import { db, styles } from "../firebase";

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

  // Private isolated conversations fetched strictly with participants array-contains currentUserId
  const [privateConversations, setPrivateConversations] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  // New Chat / Contact search modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [isSearchingContact, setIsSearchingContact] = useState(false);
  const [initialMessageText, setInitialMessageText] = useState("");

  // Channel Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  // Broadcast input in channel view
  const [postContent, setPostContent] = useState("");

  // View Filter: 'active' | 'archived'
  const [viewFilter, setViewFilter] = useState("active");

  // Local persistence for archived and deleted items per user
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

  // Clean 11-digit phone number helper
  const cleanPhone = (val) => {
    if (!val) return "";
    const digits = val.toString().replace(/\D/g, "");
    if (digits.startsWith("880") && digits.length === 13) return digits.slice(2);
    return digits.slice(0, 11);
  };

  // --- 1. STRICT PRIVATE CONVERSATION QUERY (WHATSAPP ARCHITECTURE) ---
  // Queries the 'conversations' collection strictly WHERE 'participants' array contains currentUserId.
  // Unrelated users or global directories are NEVER loaded into the list.
  useEffect(() => {
    if (!currentUserId) return;
    setIsLoadingChats(true);

    const convCol = collection(db, "conversations");
    const q = query(
      convCol,
      where("participants", "array-contains", currentUserId),
      orderBy("updatedAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data
          });
        });
        setPrivateConversations(list);
        setIsLoadingChats(false);
      },
      (error) => {
        // Fallback gracefully if composite index is pending
        console.warn("Private query fallback: fetching by participants", error.message);
        const fallbackQ = query(convCol, where("participants", "array-contains", currentUserId));
        onSnapshot(fallbackQ, (snap) => {
          const list = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          setPrivateConversations(list);
          setIsLoadingChats(false);
        });
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  // Combined user-isolated items: Private Conversations + Channels where user is a participant
  const userIsolatedItems = useMemo(() => {
    // Isolated Channels (created, administered, or subscribed to by current user)
    const filteredChannels = channels.filter((ch) => {
      const isCreator = ch.creatorPhone === currentUserId || ch.creatorId === currentUserId;
      const isAdmin = Array.isArray(ch.admins) && ch.admins.includes(currentUserId);
      const isSub = Array.isArray(ch.subscribers) && ch.subscribers.includes(currentUserId);
      return isCreator || isAdmin || isSub;
    });

    // Merge private conversations and user channels
    const combined = [
      ...privateConversations.map((c) => ({ ...c, isPrivateChat: true })),
      ...filteredChannels.map((ch) => ({ ...ch, isChannel: true }))
    ];

    // Filter out deleted items
    return combined.filter((item) => !userDeletedIds.includes(item.id));
  }, [channels, privateConversations, currentUserId, userDeletedIds]);

  // Filter into Active vs Archived
  const displayedItems = useMemo(() => {
    return userIsolatedItems.filter((item) => {
      const isArchived = userArchivedIds.includes(item.id);
      return viewFilter === "archived" ? isArchived : !isArchived;
    });
  }, [userIsolatedItems, userArchivedIds, viewFilter]);

  // --- 2. MANUAL CONTACT SEARCH & CONVERSATION CREATION ---
  const handleStartNewChat = async (e) => {
    e.preventDefault();
    const phone = cleanPhone(contactPhoneInput);

    if (phone.length !== 11) {
      if (showToast) showToast("Please enter an 11-digit mobile number");
      return;
    }

    if (phone === currentUserId) {
      if (showToast) showToast("You cannot start a private chat with yourself");
      return;
    }

    setIsSearchingContact(true);
    try {
      // Look up target contact in Firestore
      const userSnap = await getDoc(doc(db, "users", phone));
      const targetData = userSnap.exists()
        ? userSnap.data()
        : { name: `User ${phone.slice(-4)}`, phone: phone };

      // Form unique deterministic room/conversation ID
      const roomId = [currentUserId, phone].sort().join("_");
      const convDocRef = doc(db, "conversations", roomId);

      const conversationPayload = {
        id: roomId,
        name: targetData.name || phone,
        phone: phone,
        avatar: targetData.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${phone}`,
        participants: [currentUserId, phone],
        participantDetails: {
          [currentUserId]: {
            name: currentUser?.name || currentUserId,
            phone: currentUserId
          },
          [phone]: {
            name: targetData.name || phone,
            phone: phone
          }
        },
        lastMessage: initialMessageText.trim() || "Started a private conversation",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Add conversation to Firestore strictly mapping both participants
      await setDoc(convDocRef, conversationPayload, { merge: true });

      // If initial message provided, save to room messages subcollection
      if (initialMessageText.trim()) {
        const msgId = Date.now().toString();
        await setDoc(doc(db, "rooms", roomId, "messages", msgId), {
          senderPhone: currentUserId,
          senderName: currentUser?.name || currentUserId,
          recipientPhone: phone,
          content: initialMessageText.trim(),
          type: "text",
          status: "sent",
          createdAt: new Date().toISOString()
        });
      }

      setShowNewChatModal(false);
      setContactPhoneInput("");
      setInitialMessageText("");
      setActiveChannel(conversationPayload);
      if (setMobileView) setMobileView("chat");
      if (showToast) showToast(`Private chat started with ${targetData.name || phone}`);
    } catch (err) {
      console.error("Error creating conversation:", err);
      if (showToast) showToast("Could not start chat: " + err.message);
    } finally {
      setIsSearchingContact(false);
    }
  };

  // --- 3. LONG-PRESS / HOLD EVENT HANDLERS (500ms) ---
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

  const handleItemClick = (item) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    setActiveChannel(item);
    if (setMobileView) setMobileView("chat");
  };

  // --- 4. ARCHIVE / RESTORE ACTION ---
  const handleToggleArchive = (id) => {
    const isCurrentlyArchived = userArchivedIds.includes(id);
    let nextList;
    if (isCurrentlyArchived) {
      nextList = userArchivedIds.filter((item) => item !== id);
      if (showToast) showToast("Chat unarchived");
    } else {
      nextList = [...userArchivedIds, id];
      if (showToast) showToast("Chat moved to archive");
      if (activeChannel?.id === id) setActiveChannel(null);
    }
    setUserArchivedIds(nextList);
    try {
      localStorage.setItem(`infinity_archived_${currentUserId}`, JSON.stringify(nextList));
    } catch (e) {}
    setContextItem(null);
  };

  // --- 5. DELETE CONVERSATION ACTION ---
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

    if (showToast) showToast("Chat removed from your list");
    setShowConfirmDelete(false);
    setContextItem(null);
  };

  // --- 6. CHANNEL CREATION ---
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

  // Broadcast in channel
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
      {/* LEFT COLUMN: WhatsApp-Style Isolated Chat & Channel List */}
      <div
        style={{
          width: "100%",
          maxWidth: activeChannel ? "340px" : "100%",
          display: activeChannel && window.innerWidth < 768 ? "none" : "flex",
          flexDirection: "column",
          borderRight: `1px solid ${THEME.border}`,
          backgroundColor: THEME.sidebar,
          height: "100%",
          overflow: "hidden",
          position: "relative"
        }}
      >
        {/* Header with Title, Archive Filter & Add Buttons */}
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
              {viewFilter === "archived" ? "Archived Chats" : "Private Chats & Channels"}
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

            {/* Start New Private Chat Button */}
            <button
              onClick={() => setShowNewChatModal(true)}
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
              title="New Private Chat"
            >
              <MessageSquarePlus size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Isolated List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "6px"
          }}
        >
          {isLoadingChats ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted, fontSize: "12px" }}>
              Loading conversations...
            </div>
          ) : displayedItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
              <Users size={36} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                {viewFilter === "archived" ? "No archived chats" : "No private chats yet"}
              </div>
              <div style={{ fontSize: "11px", marginTop: "6px", lineHeight: "1.5" }}>
                {viewFilter === "archived"
                  ? "Long-press any conversation to archive it."
                  : "Chats only appear when you actively add or message a contact. Tap the '+' button to start a private chat."}
              </div>
              {viewFilter === "active" && (
                <button
                  onClick={() => setShowNewChatModal(true)}
                  style={{
                    ...styles.primaryBtn,
                    backgroundColor: THEME.primary,
                    width: "auto",
                    padding: "8px 16px",
                    margin: "16px auto 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <UserPlus size={15} />
                  <span>Start New Chat</span>
                </button>
              )}
            </div>
          ) : (
            displayedItems.map((item) => {
              const isSelected = activeChannel?.id === item.id;
              const displayName = item.name || item.phone || "Chat";
              const avatarUrl = item.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.id}`;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  onTouchStart={() => handleTouchStart(item)}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={() => handleTouchStart(item)}
                  onMouseUp={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextItem(item);
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
                    src={avatarUrl}
                    alt=""
                    style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "700", fontSize: "13px", color: THEME.text }}>{displayName}</span>
                      {item.isChannel ? (
                        <span
                          style={{
                            fontSize: "9px",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(34, 197, 94, 0.15)",
                            color: THEME.primary,
                            fontWeight: "700"
                          }}
                        >
                          CHANNEL
                        </span>
                      ) : (
                        <span style={{ fontSize: "10px", color: THEME.textMuted }}>
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
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
                      {item.lastMessage || item.desc || "Private message"}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextItem(item);
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

        {/* FLOATING ACTION BUTTON (+) FOR NEW CHAT */}
        <button
          onClick={() => setShowNewChatModal(true)}
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            backgroundColor: THEME.primary,
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            cursor: "pointer",
            zIndex: 10
          }}
          title="New Private Chat"
        >
          <MessageSquarePlus size={22} />
        </button>
      </div>

      {/* RIGHT COLUMN: Active Chat Feed & Broadcasting View */}
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
          {/* Header Bar */}
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
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  {activeChannel.name || activeChannel.phone}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  {activeChannel.isPrivateChat
                    ? "Private Conversation"
                    : `${(activeChannel.subscribers || []).length} subscriber(s)`}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {!activeChannel.isPrivateChat && (
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
              )}

              <button
                onClick={() => setContextItem(activeChannel)}
                style={{ ...styles.cleanBtn, color: THEME.text }}
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          {/* Messages or Channel Posts */}
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
                <div style={{ fontSize: "14px" }}>
                  {activeChannel.isPrivateChat ? "Private conversation active" : "No broadcasts published yet"}
                </div>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>
                  {activeChannel.isPrivateChat
                    ? "Only you and your contact can read and send messages here."
                    : isAdmin
                    ? "Broadcast announcements to your subscribers below."
                    : "Channel announcements will show up here."}
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

          {/* Broadcast Input (Channels only) */}
          {!activeChannel.isPrivateChat && isAdmin && (
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
          <div style={{ fontSize: "15px", fontWeight: "600", color: THEME.text }}>Private Chat & Channels</div>
          <p style={{ fontSize: "12px", maxWidth: "300px", textAlign: "center", lineHeight: "1.4" }}>
            Select a conversation or tap '+' to start an end-to-end private chat with an 11-digit mobile contact.
          </p>
        </div>
      )}

      {/* --- MODAL: START NEW CHAT (MANUAL CONTACT ADDITION) --- */}
      {showNewChatModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text, display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquarePlus size={18} color={THEME.primary} />
                <span>New Private Chat</span>
              </div>
              <button onClick={() => setShowNewChatModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                Chats are completely private. Enter the contact's 11-digit mobile number to open a dedicated conversation.
              </div>

              <div>
                <label style={styles.label}>11-Digit Contact Number</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="tel"
                    placeholder="01712345678"
                    maxLength={11}
                    value={contactPhoneInput}
                    onChange={(e) => setContactPhoneInput(cleanPhone(e.target.value))}
                    style={{ ...styles.bareInput, color: THEME.text }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label style={styles.label}>First Message (Optional)</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="text"
                    placeholder="Hello! How are you?"
                    value={initialMessageText}
                    onChange={(e) => setInitialMessageText(e.target.value)}
                    style={{ ...styles.bareInput, color: THEME.text }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSearchingContact || cleanPhone(contactPhoneInput).length !== 11}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  marginTop: "6px",
                  opacity: isSearchingContact || cleanPhone(contactPhoneInput).length !== 11 ? 0.6 : 1
                }}
              >
                {isSearchingContact ? "Finding Contact..." : "Start Private Chat"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- LONG-PRESS CONTEXT MENU (DELETE / ARCHIVE) --- */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "8px", borderBottom: `1px solid ${THEME.border}` }}>
              <img
                src={contextItem.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${contextItem.id}`}
                alt=""
                style={{ width: "36px", height: "36px", borderRadius: "50%" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  {contextItem.name || contextItem.phone}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>Conversation Options</div>
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

            {/* Confirm Delete State */}
            {showConfirmDelete ? (
              <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: THEME.danger, fontSize: "13px", fontWeight: "600" }}>
                  <AlertTriangle size={18} />
                  <span>Delete this conversation from your list?</span>
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                  This will remove the chat from your active list without affecting your contact's view.
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
                {/* Archive / Unarchive */}
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

                {/* Delete Chat */}
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
    </div>
  );
}
