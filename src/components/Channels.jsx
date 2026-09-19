import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  limit
} from "firebase/firestore";
import {
  Users,
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
  UserPlus,
  Pin,
  PinOff,
  Bell,
  BellOff
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

  // Strictly isolated 1-on-1 direct phone conversations
  const [privateConversations, setPrivateConversations] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  // Search input state
  const [searchTerm, setSearchTerm] = useState("");

  // Manual Contact / Direct Number Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [isSearchingContact, setIsSearchingContact] = useState(false);
  const [initialMessageText, setInitialMessageText] = useState("");

  // Broadcast in channel input
  const [postContent, setPostContent] = useState("");

  // View Filter: 'active' | 'archived'
  const [viewFilter, setViewFilter] = useState("active");

  // Read status tracking (clears unread badge on click)
  const [readChatIds, setReadChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_read_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Local persistence for Pinned, Muted, Archived, and Deleted lists strictly per user
  const [userPinnedIds, setUserPinnedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_pinned_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [userMutedIds, setUserMutedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_muted_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

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
  const touchStartPos = useRef({ x: 0, y: 0 });
  const isLongPressTriggered = useRef(false);

  // Clean 11-digit phone number helper
  const cleanPhone = (val) => {
    if (!val) return "";
    const digits = val.toString().replace(/\D/g, "");
    if (digits.startsWith("880") && digits.length === 13) return digits.slice(2);
    return digits.slice(0, 11);
  };

  // Helper to parse timestamp to epoch milliseconds for accurate sorting
  const getTimestampMillis = (item) => {
    const raw =
      item.lastMessageTimestamp ||
      item.updatedAt ||
      item.lastMessageTime ||
      item.createdAt;
    if (!raw) return 0;
    if (typeof raw === "number") return raw;
    if (raw?.toMillis) return raw.toMillis();
    if (raw?.seconds) return raw.seconds * 1000;
    const parsed = new Date(raw).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  // --- 1. STRICT ISOLATED QUERY (WHATSAPP-STYLE ABSOLUTE PRIVACY) ---
  // Queries ONLY conversations where the current user's UID or phone is explicitly in participants.
  // Global directory users or unrelated threads are NEVER queried or leaked.
  useEffect(() => {
    if (!currentUserId) return;
    setIsLoadingChats(true);

    const convCol = collection(db, "conversations");
    const q = query(
      convCol,
      where("participants", "array-contains", currentUserId),
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
        console.warn("Private query error:", error.message);
        setIsLoadingChats(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  // Combine strictly isolated 1-on-1 conversations + official user channels
  const userIsolatedItems = useMemo(() => {
    const filteredChannels = channels.filter((ch) => {
      const isCreator = ch.creatorPhone === currentUserId || ch.creatorId === currentUserId;
      const isAdmin = Array.isArray(ch.admins) && ch.admins.includes(currentUserId);
      const isSub = Array.isArray(ch.subscribers) && ch.subscribers.includes(currentUserId);
      return isCreator || isAdmin || isSub;
    });

    const combined = [
      ...privateConversations.map((c) => ({ ...c, isPrivateChat: true })),
      ...filteredChannels.map((ch) => ({ ...ch, isChannel: true }))
    ];

    return combined.filter((item) => !userDeletedIds.includes(item.id));
  }, [channels, privateConversations, currentUserId, userDeletedIds]);

  // Filter Active vs Archived, Apply Search, and Sort with Pinned & Latest Timestamp Descending
  const displayedItems = useMemo(() => {
    let list = userIsolatedItems.filter((item) => {
      const isArchived = userArchivedIds.includes(item.id);
      return viewFilter === "archived" ? isArchived : !isArchived;
    });

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const phone = (item.phone || "").toLowerCase();
        const lastMsg = (item.lastMessage || item.desc || "").toLowerCase();
        return name.includes(term) || phone.includes(term) || lastMsg.includes(term);
      });
    }

    // Sort: Pinned items stay on top, followed immediately by latest message timestamp descending
    return list.sort((a, b) => {
      const aPinned = userPinnedIds.includes(a.id);
      const bPinned = userPinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      const timeA = getTimestampMillis(a);
      const timeB = getTimestampMillis(b);
      return timeB - timeA;
    });
  }, [userIsolatedItems, userArchivedIds, userPinnedIds, viewFilter, searchTerm]);

  // Get unread count for current user
  const getUnreadCount = (item) => {
    if (activeChannel?.id === item.id) return 0;
    if (readChatIds.includes(item.id)) return 0;

    if (item.unreadCount && typeof item.unreadCount === "object") {
      const count = item.unreadCount[currentUserId];
      if (typeof count === "number") return count;
    }

    if (typeof item.unreadCount === "number" && item.lastSender !== currentUserId) {
      return item.unreadCount;
    }

    return 0;
  };

  // --- 2. OPEN CHAT & CLEAR UNREAD BADGE ---
  const handleItemClick = async (item) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }

    // Clear badge locally
    if (!readChatIds.includes(item.id)) {
      const updated = [...readChatIds, item.id];
      setReadChatIds(updated);
      try {
        localStorage.setItem(`infinity_read_${currentUserId}`, JSON.stringify(updated));
      } catch (e) {}
    }

    // Clear badge in Firestore conversation document
    if (item.isPrivateChat && item.unreadCount && item.unreadCount[currentUserId]) {
      try {
        const convDocRef = doc(db, "conversations", item.id);
        await updateDoc(convDocRef, {
          [`unreadCount.${currentUserId}`]: 0
        });
      } catch (err) {}
    }

    setActiveChannel(item);
    if (setMobileView) setMobileView("chat");
  };

  // --- 3. LONG-PRESS TOUCH & MOUSE EVENT HANDLERS (~500ms) ---
  const handleTouchStart = (e, item) => {
    isLongPressTriggered.current = false;
    if (e.touches && e.touches[0]) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    pressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
      setContextItem(item);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!e.touches || !e.touches[0]) return;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

    if (deltaX > 10 || deltaY > 10) {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // --- 4. CONTEXT ACTION HANDLERS ---
  const handleTogglePin = (id) => {
    const isCurrentlyPinned = userPinnedIds.includes(id);
    let nextPinned;
    if (isCurrentlyPinned) {
      nextPinned = userPinnedIds.filter((itemId) => itemId !== id);
      if (showToast) showToast("Chat unpinned");
    } else {
      nextPinned = [...userPinnedIds, id];
      if (showToast) showToast("Chat pinned to top");
    }
    setUserPinnedIds(nextPinned);
    try {
      localStorage.setItem(`infinity_pinned_${currentUserId}`, JSON.stringify(nextPinned));
    } catch (e) {}
    setContextItem(null);
  };

  const handleToggleMute = (id) => {
    const isCurrentlyMuted = userMutedIds.includes(id);
    let nextMuted;
    if (isCurrentlyMuted) {
      nextMuted = userMutedIds.filter((itemId) => itemId !== id);
      if (showToast) showToast("Notifications unmuted");
    } else {
      nextMuted = [...userMutedIds, id];
      if (showToast) showToast("Notifications muted");
    }
    setUserMutedIds(nextMuted);
    try {
      localStorage.setItem(`infinity_muted_${currentUserId}`, JSON.stringify(nextMuted));
    } catch (e) {}
    setContextItem(null);
  };

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

    if (showToast) showToast("Chat deleted for your profile");
    setShowConfirmDelete(false);
    setContextItem(null);
  };

  // --- 5. START DIRECT NUMBER CHAT ---
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
      const userSnap = await getDoc(doc(db, "users", phone));
      const targetData = userSnap.exists()
        ? userSnap.data()
        : { name: `User ${phone.slice(-4)}`, phone: phone };

      const roomId = [currentUserId, phone].sort().join("_");
      const convDocRef = doc(db, "conversations", roomId);

      const conversationPayload = {
        id: roomId,
        name: targetData.name || phone,
        phone: phone,
        avatar: targetData.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${phone}`,
        participants: [currentUserId, phone],
        participantDetails: {
          [currentUserId]: { name: currentUser?.name || currentUserId, phone: currentUserId },
          [phone]: { name: targetData.name || phone, phone: phone }
        },
        lastMessage: initialMessageText.trim() || "Started a private conversation",
        lastMessageTimestamp: Date.now(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        unreadCount: {
          [phone]: initialMessageText.trim() ? 1 : 0,
          [currentUserId]: 0
        }
      };

      await setDoc(convDocRef, conversationPayload, { merge: true });

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
      handleItemClick(conversationPayload);
      if (showToast) showToast(`Private chat started with ${targetData.name || phone}`);
    } catch (err) {
      console.error("Error creating conversation:", err);
      if (showToast) showToast("Could not start chat: " + err.message);
    } finally {
      setIsSearchingContact(false);
    }
  };

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
        {/* Top Header Bar */}
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
              {viewFilter === "archived" ? "আর্কাইভ করা চ্যাট" : "চ্যাট ও চ্যানেল"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setViewFilter(viewFilter === "active" ? "archived" : "active")}
              title={viewFilter === "active" ? "আর্কাইভ দেখুন" : "সক্রিয় চ্যাট দেখুন"}
              style={{
                ...styles.cleanBtn,
                color: viewFilter === "archived" ? THEME.primary : THEME.textMuted,
                padding: "6px"
              }}
            >
              {viewFilter === "archived" ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </button>

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
              title="নতুন চ্যাট"
            >
              <MessageSquarePlus size={16} />
            </button>
          </div>
        </div>

        {/* Direct Number Search Bar */}
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: THEME.sidebar,
            borderBottom: `1px solid ${THEME.border}`
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.border}`,
              borderRadius: "8px",
              padding: "6px 10px"
            }}
          >
            <Search size={16} color={THEME.textMuted} />
            <input
              type="text"
              placeholder="চ্যাট বা মোবাইল নম্বর খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                ...styles.bareInput,
                color: THEME.text,
                fontSize: "13px"
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} style={styles.cleanBtn}>
                <X size={14} color={THEME.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Isolated List with Dynamic Sorting & Unread Badges */}
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
              চ্যাট লোড হচ্ছে...
            </div>
          ) : displayedItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
              <Users size={36} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                {viewFilter === "archived" ? "কোনো আর্কাইভ চ্যাট নেই" : "কোনো কথোপকথন পাওয়া যায়নি"}
              </div>
              <div style={{ fontSize: "11px", marginTop: "6px", lineHeight: "1.5" }}>
                {viewFilter === "archived"
                  ? "যেকোনো চ্যাট চেপে ধরে আর্কাইভ করুন।"
                  : "নতুন চ্যাট শুরু করতে নিচের '+' বোতামে চাপ দিন।"}
              </div>
            </div>
          ) : (
            displayedItems.map((item) => {
              const isSelected = activeChannel?.id === item.id;
              const isPinned = userPinnedIds.includes(item.id);
              const isMuted = userMutedIds.includes(item.id);
              const unreadCount = getUnreadCount(item);
              const displayName = item.name || item.phone || "Chat";
              const avatarUrl = item.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.id}`;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  onTouchStart={(e) => handleTouchStart(e, item)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={(e) => handleTouchStart(e, item)}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextItem(item);
                  }}
                  style={{
                    ...styles.contactItem,
                    backgroundColor: isSelected ? THEME.cardHover : "transparent",
                    borderLeft: isSelected ? `3px solid ${THEME.primary}` : "3px solid transparent",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 8px"
                  }}
                >
                  <img
                    src={avatarUrl}
                    alt=""
                    style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                      <span
                        style={{
                          fontWeight: unreadCount > 0 ? "800" : "700",
                          fontSize: "13px",
                          color: THEME.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {displayName}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        {isPinned && <Pin size={12} color={THEME.primary} />}
                        {isMuted && <BellOff size={12} color={THEME.danger} />}
                        <span
                          style={{
                            fontSize: "10px",
                            color: unreadCount > 0 ? THEME.primary : THEME.textMuted,
                            fontWeight: unreadCount > 0 ? "700" : "normal"
                          }}
                        >
                          {item.lastMessageTimestamp
                            ? new Date(getTimestampMillis(item)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : item.updatedAt
                            ? new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          color: unreadCount > 0 ? THEME.text : THEME.textMuted,
                          fontWeight: unreadCount > 0 ? "600" : "normal",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                          marginRight: "6px"
                        }}
                      >
                        {item.lastMessage || item.desc || "ব্যক্তিগত বার্তা"}
                      </span>

                      {/* Green Circular Unread Message Counter Badge */}
                      {unreadCount > 0 && (
                        <span
                          style={{
                            backgroundColor: THEME.primary || "#22c55e",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: "800",
                            minWidth: "18px",
                            height: "18px",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 5px",
                            flexShrink: 0,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                          }}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
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
                      padding: "6px",
                      flexShrink: 0
                    }}
                    title="অপশন"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Floating Action Button (+) for New Chat */}
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
          title="নতুন চ্যাট শুরু করুন"
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
                    ? "ব্যক্তিগত চ্যাট"
                    : `${(activeChannel.subscribers || []).length} গ্রাহক`}
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
                      <span>গ্রাহকভুক্ত</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} />
                      <span>যুক্ত হোন</span>
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

          {/* Posts or Messages */}
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
                  {activeChannel.isPrivateChat ? "ব্যক্তিগত বার্তালাপ সক্রিয়" : "কোনো প্রকাশনা নেই"}
                </div>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>
                  {activeChannel.isPrivateChat
                    ? "আপনি এবং আপনার পরিচিতি নিরাপদে বার্তা আদান-প্রদান করতে পারেন।"
                    : isAdmin
                    ? "গ্রাহকদের জন্য নিচে বার্তা লিখুন।"
                    : "চ্যানেল আপডেট এখানে প্রদর্শিত হবে।"}
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
                        <span>শেয়ার</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Broadcast Input Bar */}
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
                placeholder="চ্যানেলে একটি বার্তা প্রচার করুন..."
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
          <div style={{ fontSize: "15px", fontWeight: "600", color: THEME.text }}>ব্যক্তিগত চ্যাট ও চ্যানেল</div>
          <p style={{ fontSize: "12px", maxWidth: "300px", textAlign: "center", lineHeight: "1.4" }}>
            যেকোনো চ্যাট নির্বাচন করুন বা নতুন কথোপকথন শুরু করতে '+' বোতামে ক্লিক করুন।
          </p>
        </div>
      )}

      {/* --- NEW CHAT MODAL --- */}
      {showNewChatModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text, display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquarePlus size={18} color={THEME.primary} />
                <span>নতুন ব্যক্তিগত চ্যাট</span>
              </div>
              <button onClick={() => setShowNewChatModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                পরিচিত ব্যক্তির ১১ ডিজিটের মোবাইল নম্বর প্রদান করে ব্যক্তিগত চ্যাট শুরু করুন।
              </div>

              <div>
                <label style={styles.label}>মোবাইল নম্বর (১১ ডিজিট)</label>
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
                <label style={styles.label}>প্রথম বার্তা (ঐচ্ছিক)</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="text"
                    placeholder="কেমন আছেন?"
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
                {isSearchingContact ? "সন্ধান করা হচ্ছে..." : "চ্যাট শুরু করুন"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- LONG-PRESS CONTEXT ACTION MODAL / BOTTOM SHEET --- */}
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
                style={{ width: "38px", height: "38px", borderRadius: "50%" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  {contextItem.name || contextItem.phone}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>চ্যাট অপশন পরিচালনা করুন</div>
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
                  <span>আপনি কি এই চ্যাটটি মুছে ফেলতে চান?</span>
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                  এটি আপনার প্রোফাইল থেকে চ্যাটটি সরিয়ে দেবে।
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    style={{ ...styles.pillBtn, backgroundColor: THEME.card, color: THEME.text }}
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleExecuteDelete}
                    style={{ ...styles.pillBtn, backgroundColor: THEME.danger, color: "#fff", fontWeight: "700" }}
                  >
                    নিশ্চিত করুন
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {/* 1. Pin / Unpin Chat */}
                <button
                  onClick={() => handleTogglePin(contextItem.id)}
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
                  {userPinnedIds.includes(contextItem.id) ? (
                    <>
                      <PinOff size={18} color={THEME.primary} />
                      <span>চ্যাট আনপিন করুন</span>
                    </>
                  ) : (
                    <>
                      <Pin size={18} color={THEME.primary} />
                      <span>উপরে পিন করে রাখুন</span>
                    </>
                  )}
                </button>

                {/* 2. Mute / Unmute Notifications */}
                <button
                  onClick={() => handleToggleMute(contextItem.id)}
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
                  {userMutedIds.includes(contextItem.id) ? (
                    <>
                      <Bell size={18} color={THEME.textMuted} />
                      <span>নোটিফিকেশন আনমিউট করুন</span>
                    </>
                  ) : (
                    <>
                      <BellOff size={18} color={THEME.danger} />
                      <span>নোটিফিকেশন মিউট করুন</span>
                    </>
                  )}
                </button>

                {/* 3. Archive / Unarchive Chat */}
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
                      <span>আর্কাইভ থেকে আনআর্কাইভ করুন</span>
                    </>
                  ) : (
                    <>
                      <Archive size={18} color={THEME.primary} />
                      <span>চ্যাট আর্কাইভ করুন</span>
                    </>
                  )}
                </button>

                {/* 4. Delete Chat */}
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
                  <span>চ্যাট মুছে ফেলুন</span>
                </button>

                {/* 5. Cancel */}
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
                  বাতিল
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
