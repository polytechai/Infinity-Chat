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
  Search,
  MessageSquarePlus,
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Send,
  Check,
  CheckCheck,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertTriangle,
  X,
  Eye,
  Reply,
  Copy,
  Share2,
  FileText,
  Image as ImageIcon
} from "lucide-react";
import { db, styles } from "../firebase";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function ChatView({
  activeChat,
  setActiveChat,
  messages = [],
  currentUser,
  peerPresence = { isOnline: false, lastSeen: "" },
  THEME,
  t,
  isPinned,
  isMuted,
  onTogglePin,
  onToggleMute,
  vanishMode,
  setVanishMode,
  viewOnceMode,
  setViewOnceMode,
  replyingTo,
  setReplyingTo,
  onSendMessage,
  onSendMedia,
  onReactMessage,
  onForwardMessage,
  onLightbox,
  startCall,
  openProfile,
  setMobileView,
  showToast
}) {
  const currentUserId = currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  // 1-on-1 direct conversations strictly queried for current user
  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [viewFilter, setViewFilter] = useState("active"); // 'active' | 'archived'

  // New Chat / Direct Phone Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [initialMessageText, setInitialMessageText] = useState("");
  const [isSearchingContact, setIsSearchingContact] = useState(false);

  // Read status tracking per current user
  const [readChatIds, setReadChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_read_${currentUserId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Local persistence for Pinned, Muted, Archived, and Deleted strictly per user
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

  // Active chat thread states
  const [inputText, setInputText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // References for scrolling and inputs
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Swipe-to-reply gesture references
  const msgTouchStartPos = useRef({ x: 0, y: 0, time: 0 });
  const [bubbleOffsets, setBubbleOffsets] = useState({});

  // Helper to format clean 11-digit Bangladeshi mobile numbers
  const cleanPhone = (val) => {
    if (!val) return "";
    const digits = val.toString().replace(/\D/g, "");
    if (digits.startsWith("880") && digits.length === 13) return digits.slice(2);
    return digits.slice(0, 11);
  };

  // Helper to parse timestamps for dynamic sorting
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

  // --- 1. ABSOLUTE PRIVACY: STRICT PARTICIPANTS QUERY ---
  // Queries Firestore strictly WHERE 'participants' array contains current user ID.
  // Unrelated contacts or conversations are NEVER loaded or leaked.
  useEffect(() => {
    if (!currentUserId) return;
    setIsLoadingConversations(true);

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
          list.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        setConversations(list);
        setIsLoadingConversations(false);
      },
      (err) => {
        console.warn("Private conversations query error:", err.message);
        setIsLoadingConversations(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  // --- 2. LATEST MESSAGE SORTING & SEARCH FILTERING ---
  const displayedConversations = useMemo(() => {
    let list = conversations.filter((item) => !userDeletedIds.includes(item.id));

    // Filter Active vs Archived
    list = list.filter((item) => {
      const isArchived = userArchivedIds.includes(item.id);
      return viewFilter === "archived" ? isArchived : !isArchived;
    });

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const phone = (item.phone || "").toLowerCase();
        const lastMsg = (item.lastMessage || "").toLowerCase();
        return name.includes(term) || phone.includes(term) || lastMsg.includes(term);
      });
    }

    // Sort: Pinned conversations on top, then sorted by lastMessageTimestamp descending
    return list.sort((a, b) => {
      const aPinned = userPinnedIds.includes(a.id);
      const bPinned = userPinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      const timeA = getTimestampMillis(a);
      const timeB = getTimestampMillis(b);
      return timeB - timeA;
    });
  }, [conversations, userDeletedIds, userArchivedIds, userPinnedIds, viewFilter, searchTerm]);

  // Unread badge counter for current user
  const getUnreadCount = (item) => {
    if (activeChat?.id === item.id) return 0;
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

  // --- 3. OPEN CONVERSATION & CLEAR UNREAD BADGE ---
  const handleOpenConversation = async (item) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }

    // Mark as read locally
    if (!readChatIds.includes(item.id)) {
      const updated = [...readChatIds, item.id];
      setReadChatIds(updated);
      try {
        localStorage.setItem(`infinity_read_${currentUserId}`, JSON.stringify(updated));
      } catch (e) {}
    }

    // Reset unread count in Firestore
    if (item.unreadCount && item.unreadCount[currentUserId]) {
      try {
        const convDocRef = doc(db, "conversations", item.id);
        await updateDoc(convDocRef, {
          [`unreadCount.${currentUserId}`]: 0
        });
      } catch (err) {}
    }

    setActiveChat(item);
    if (setMobileView) setMobileView("chat");
  };

  // --- 4. LONG-PRESS TOUCH HANDLERS (~500ms) ---
  const handleRowTouchStart = (e, item) => {
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

  const handleRowTouchMove = (e) => {
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

  const handleRowTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // --- 5. LONG-PRESS ACTIONS (PIN, MUTE, ARCHIVE, DELETE) ---
  const handleTogglePin = (id) => {
    const isCurrentlyPinned = userPinnedIds.includes(id);
    let nextPinned;
    if (isCurrentlyPinned) {
      nextPinned = userPinnedIds.filter((itemId) => itemId !== id);
      if (showToast) showToast("চ্যাট আনপিন করা হয়েছে");
    } else {
      nextPinned = [...userPinnedIds, id];
      if (showToast) showToast("চ্যাট উপরে পিন করা হয়েছে");
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
      if (showToast) showToast("নোটিফিকেশন আনমিউট করা হয়েছে");
    } else {
      nextMuted = [...userMutedIds, id];
      if (showToast) showToast("নোটিফিকেশন মিউট করা হয়েছে");
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
      if (showToast) showToast("চ্যাট আনআর্কাইভ করা হয়েছে");
    } else {
      nextList = [...userArchivedIds, id];
      if (showToast) showToast("চ্যাট আর্কাইভে সরানো হয়েছে");
      if (activeChat?.id === id) setActiveChat(null);
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

    if (activeChat?.id === targetId) {
      setActiveChat(null);
      if (setMobileView) setMobileView("list");
    }

    if (showToast) showToast("চ্যাট তালিকা থেকে মুছে ফেলা হয়েছে");
    setShowConfirmDelete(false);
    setContextItem(null);
  };

  // --- 6. START NEW 1-ON-1 PHONE CHAT ---
  const handleStartNewChat = async (e) => {
    e.preventDefault();
    const phone = cleanPhone(contactPhoneInput);

    if (phone.length !== 11) {
      if (showToast) showToast("সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন");
      return;
    }

    if (phone === currentUserId) {
      if (showToast) showToast("নিজের সাথে সরাসরি চ্যাট সম্ভব নয়");
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
        lastMessage: initialMessageText.trim() || "Started private conversation",
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
      handleOpenConversation(conversationPayload);
      if (showToast) showToast(`${targetData.name || phone}-এর সাথে চ্যাট শুরু হয়েছে`);
    } catch (err) {
      console.error("Error creating conversation:", err);
      if (showToast) showToast("ত্রুটি: " + err.message);
    } finally {
      setIsSearchingContact(false);
    }
  };

  // --- 7. AUTO-SCROLL TO BOTTOM IN ACTIVE CHAT THREAD ---
  useEffect(() => {
    if (activeChat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [activeChat?.id]);

  useEffect(() => {
    if (activeChat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSendMessage = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputText.trim()) return;

    if (onSendMessage) {
      onSendMessage({
        content: inputText.trim(),
        type: "text",
        isViewOnce: !!viewOnceMode,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              content: replyingTo.content,
              senderName: replyingTo.senderName
            }
          : null
      });
    }

    setInputText("");
    setReplyingTo(null);

    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 40);
  };

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        backgroundColor: THEME.bg
      }}
    >
      {/* ================= LEFT PANE: 1-ON-1 DIRECT CONTACT & CHAT LIST ================= */}
      <div
        style={{
          width: "100%",
          maxWidth: activeChat ? "340px" : "100%",
          display: activeChat && window.innerWidth < 768 ? "none" : "flex",
          flexDirection: "column",
          borderRight: `1px solid ${THEME.border}`,
          backgroundColor: THEME.sidebar,
          height: "100%",
          overflow: "hidden",
          position: "relative"
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color={THEME.primary || "#22c55e"} />
            <span style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>
              {viewFilter === "archived" ? "আর্কাইভ করা চ্যাট" : "ব্যক্তিগত চ্যাট"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setViewFilter(viewFilter === "active" ? "archived" : "active")}
              title={viewFilter === "active" ? "আর্কাইভ দেখুন" : "সক্রিয় চ্যাট দেখুন"}
              style={{
                ...styles.cleanBtn,
                color: viewFilter === "archived" ? (THEME.primary || "#22c55e") : THEME.textMuted,
                padding: "6px"
              }}
            >
              {viewFilter === "archived" ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </button>

            <button
              onClick={() => setShowNewChatModal(true)}
              style={{
                backgroundColor: THEME.primary || "#22c55e",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
              }}
              title="নতুন চ্যাট"
            >
              <MessageSquarePlus size={16} />
            </button>
          </div>
        </div>

        {/* Direct Phone Number Search Bar */}
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

        {/* Smooth Scroll Contact Container (No Pull-To-Refresh, Isolated) */}
        <div
          style={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorY: "contain",
            touchAction: "pan-y",
            padding: "6px"
          }}
        >
          {isLoadingConversations ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted, fontSize: "12px" }}>
              চ্যাট তালিকা লোড হচ্ছে...
            </div>
          ) : displayedConversations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
              <Users size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
              <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                {viewFilter === "archived" ? "কোনো আর্কাইভ চ্যাট নেই" : "কোনো ব্যক্তিগত চ্যাট পাওয়া যায়নি"}
              </div>
              <div style={{ fontSize: "11px", marginTop: "6px", lineHeight: "1.5" }}>
                {viewFilter === "archived"
                  ? "চ্যাট চেপে ধরে রাখলে আর্কাইভ অপশন প্রদর্শিত হবে।"
                  : "নতুন কারো সাথে চ্যাট শুরু করতে '+' বোতামে চাপ দিন বা নম্বর খুঁজুন।"}
              </div>
            </div>
          ) : (
            displayedConversations.map((item) => {
              const isSelected = activeChat?.id === item.id;
              const isPinnedItem = userPinnedIds.includes(item.id);
              const isMutedItem = userMutedIds.includes(item.id);
              const unreadCount = getUnreadCount(item);
              const displayName = item.name || item.phone || "Direct Chat";
              const avatarUrl = item.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.id}`;

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenConversation(item)}
                  onTouchStart={(e) => handleRowTouchStart(e, item)}
                  onTouchMove={handleRowTouchMove}
                  onTouchEnd={handleRowTouchEnd}
                  onMouseDown={(e) => handleRowTouchStart(e, item)}
                  onMouseUp={handleRowTouchEnd}
                  onMouseLeave={handleRowTouchEnd}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextItem(item);
                  }}
                  style={{
                    ...styles.contactItem,
                    backgroundColor: isSelected ? THEME.cardHover : "transparent",
                    borderLeft: isSelected ? `3px solid ${THEME.primary || "#22c55e"}` : "3px solid transparent",
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
                        {isPinnedItem && <Pin size={12} color={THEME.primary || "#22c55e"} />}
                        {isMutedItem && <BellOff size={12} color={THEME.danger} />}
                        <span
                          style={{
                            fontSize: "10px",
                            color: unreadCount > 0 ? (THEME.primary || "#22c55e") : THEME.textMuted,
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
                        {item.lastMessage || "বার্তা শুরু করুন"}
                      </span>

                      {/* Green Circular Unread Badge */}
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

        {/* Floating Action Button (+) */}
        <button
          onClick={() => setShowNewChatModal(true)}
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            backgroundColor: THEME.primary || "#22c55e",
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

      {/* ================= RIGHT PANE: ACTIVE DIRECT CHAT THREAD ================= */}
      {activeChat ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: THEME.bg,
            height: "100%",
            overflow: "hidden",
            position: "relative"
          }}
        >
          {/* Active Chat Header Bar */}
          <div
            style={{
              ...styles.headerBar,
              backgroundColor: THEME.header,
              borderColor: THEME.border,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 14px",
              zIndex: 10
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
              <button
                onClick={() => {
                  setActiveChat(null);
                  if (setMobileView) setMobileView("list");
                }}
                style={{ ...styles.cleanBtn, color: THEME.text, display: "flex", alignItems: "center" }}
              >
                <ArrowLeft size={18} />
              </button>

              <div
                onClick={() => openProfile && openProfile(activeChat)}
                style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0 }}
              >
                <img
                  src={activeChat.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeChat.id}`}
                  alt=""
                  style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover" }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: "700",
                      fontSize: "14px",
                      color: THEME.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {activeChat.name || activeChat.phone}
                  </div>
                  <div style={{ fontSize: "11px", color: peerPresence.isOnline ? (THEME.primary || "#22c55e") : THEME.textMuted }}>
                    {peerPresence.isOnline ? "Online" : peerPresence.lastSeen ? `Last seen ${peerPresence.lastSeen}` : activeChat.phone || ""}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={() => startCall && startCall(activeChat, "audio")}
                style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
                title="Audio Call"
              >
                <Phone size={18} />
              </button>
              <button
                onClick={() => startCall && startCall(activeChat, "video")}
                style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
                title="Video Call"
              >
                <Video size={18} />
              </button>
              <button
                onClick={() => setContextItem(activeChat)}
                style={{ ...styles.cleanBtn, color: THEME.text, padding: "8px" }}
                title="Options"
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              height: "100%",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "contain",
              touchAction: "pan-y",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {messages.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", color: THEME.textMuted }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    backgroundColor: THEME.card,
                    fontSize: "12px",
                    border: `1px solid ${THEME.border}`
                  }}
                >
                  🔒 End-to-end direct phone messaging.
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderPhone === currentUserId || msg.senderId === currentUserId;
                const isDeleted = msg.type === "deleted";

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                      width: "100%",
                      marginBottom: "2px"
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "82%",
                        borderRadius: "12px",
                        borderTopRightRadius: isMe ? "2px" : "12px",
                        borderTopLeftRadius: !isMe ? "2px" : "12px",
                        padding: "8px 12px",
                        backgroundColor: isMe ? (THEME.primary || "#22c55e") : THEME.card,
                        color: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                        position: "relative",
                        wordBreak: "break-word"
                      }}
                    >
                      {msg.replyTo && !isDeleted && (
                        <div
                          style={{
                            backgroundColor: "rgba(0,0,0,0.2)",
                            borderLeft: `3px solid ${isMe ? "#fff" : (THEME.primary || "#22c55e")}`,
                            borderRadius: "4px",
                            padding: "4px 8px",
                            marginBottom: "6px",
                            fontSize: "11px"
                          }}
                        >
                          <div style={{ fontWeight: "700", opacity: 0.9 }}>{msg.replyTo.senderName || "User"}</div>
                          <div style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {msg.replyTo.content}
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
                        {msg.content}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "4px",
                          marginTop: "4px",
                          fontSize: "10px",
                          opacity: 0.75
                        }}
                      >
                        <span>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                        {isMe && !isDeleted && (
                          <span>
                            {msg.status === "read" ? <CheckCheck size={13} color="#53bdeb" /> : <Check size={13} />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Input Bar */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: "8px 12px",
              backgroundColor: THEME.header,
              borderTop: `1px solid ${THEME.border}`,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              position: "relative"
            }}
          >
            <div
              style={{
                flex: 1,
                backgroundColor: THEME.card,
                borderRadius: "20px",
                border: `1px solid ${THEME.border}`,
                display: "flex",
                alignItems: "center",
                padding: "0 12px"
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  ...styles.bareInput,
                  color: THEME.text,
                  fontSize: "14px",
                  padding: "9px 0"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim()}
              style={{
                backgroundColor: THEME.primary || "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                opacity: !inputText.trim() ? 0.6 : 1,
                flexShrink: 0
              }}
              title="Send message"
            >
              <Send size={17} />
            </button>
          </form>
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
          <div style={{ fontSize: "16px", fontWeight: "600", color: THEME.text }}>ব্যক্তিগত ১-অন-১ চ্যাট</div>
          <p style={{ fontSize: "12px", maxWidth: "320px", textAlign: "center", lineHeight: "1.5" }}>
            একটি কথোপকথন নির্বাচন করুন অথবা পরিচিত ব্যক্তির নম্বর দিয়ে সরাসরি ব্যক্তিগত চ্যাট শুরু করুন।
          </p>
        </div>
      )}

      {/* --- NEW 1-ON-1 PHONE CHAT MODAL --- */}
      {showNewChatModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text, display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageSquarePlus size={18} color={THEME.primary || "#22c55e"} />
                <span>নতুন ব্যক্তিগত চ্যাট</span>
              </div>
              <button onClick={() => setShowNewChatModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                পরিচিত ব্যক্তির ১১ ডিজিটের মোবাইল নম্বর লিখুন। আপনার চ্যাট তালিকা সম্পূর্ণ ব্যক্তিগত ও সুরক্ষিত থাকবে।
              </div>

              <div>
                <label style={styles.label}>১১ ডিজিট মোবাইল নম্বর</label>
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
                  backgroundColor: THEME.primary || "#22c55e",
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

      {/* --- LONG-PRESS CONTEXT ACTION MODAL / SHEET --- */}
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
            {/* Context Item Header */}
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
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>চ্যাট পরিচালনা অপশন</div>
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
                  এটি শুধুমাত্র আপনার প্রোফাইল থেকে চ্যাটটি সরিয়ে দেবে।
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
                      <PinOff size={18} color={THEME.primary || "#22c55e"} />
                      <span>চ্যাট আনপিন করুন</span>
                    </>
                  ) : (
                    <>
                      <Pin size={18} color={THEME.primary || "#22c55e"} />
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
                      <ArchiveRestore size={18} color={THEME.primary || "#22c55e"} />
                      <span>আর্কাইভ থেকে আনআর্কাইভ করুন</span>
                    </>
                  ) : (
                    <>
                      <Archive size={18} color={THEME.primary || "#22c55e"} />
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
