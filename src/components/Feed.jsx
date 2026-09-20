import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Image as ImageIcon,
  Video,
  Send,
  Heart,
  MessageCircle,
  Share2,
  Users,
  PlusCircle,
  UserCheck,
  UserPlus,
  Play,
  X,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Bell,
  RefreshCw,
  CornerDownRight,
  Smile,
  Compass,
  ArrowUp
} from "lucide-react";
import { styles } from "../firebase";

const REACTION_EMOJIS = [
  { id: "like", emoji: "👍", label: "Like", color: "#22c55e" },
  { id: "love", emoji: "❤️", label: "Love", color: "#f43f5e" },
  { id: "care", emoji: "🥰", label: "Care", color: "#eab308" },
  { id: "haha", emoji: "😂", label: "Haha", color: "#facc15" },
  { id: "wow", emoji: "😮", label: "Wow", color: "#a855f7" },
  { id: "sad", emoji: "😢", label: "Sad", color: "#38bdf8" },
  { id: "angry", emoji: "😡", label: "Angry", color: "#ef4444" }
];

export default function Feed({
  feedPosts = [],
  currentUser,
  channels = [],
  THEME,
  t,
  onOpenChannel,
  onToggleLike,
  onReaction,
  onForward,
  onLightbox,
  onBroadcastPost,
  showToast
}) {
  const currentUserId = currentUser?.phone || currentUser?.uid || currentUser?.id || "";

  // Main scrollable feed container ref
  const feedContainerRef = useRef(null);

  // --- POST CREATOR STATE ---
  const [postText, setPostText] = useState("");
  const [mediaPreview, setMediaPreview] = useState(null); // { url, type, name, size }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- MANDATORY CHANNEL MODAL ---
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelBio, setChannelBio] = useState("");

  // --- COMMENTS & NESTED REPLIES STATE ---
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentInputMap, setCommentInputMap] = useState({});
  const [replyingToCommentMap, setReplyingToCommentMap] = useState({}); // { [postId]: { commentId, authorName } }
  const [localCommentsMap, setLocalCommentsMap] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_feed_comments_v2");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // --- REACTION POPUP BAR & REACTION LIST MODAL ---
  const [hoveredReactionPostId, setHoveredReactionPostId] = useState(null);
  const [viewingReactionsPost, setViewingReactionsPost] = useState(null);
  const reactionTimerRef = useRef(null);

  // --- NOTIFICATIONS STATE ---
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(`infinity_notifs_${currentUserId}`);
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: "notif_welcome",
              type: "welcome",
              senderName: "Infinity Team",
              senderAvatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Infinity",
              text: "Welcome to the News Feed! React, comment, and discover channels.",
              time: "Just now",
              read: false
            }
          ];
    } catch (e) {
      return [];
    }
  });

  // --- FEED DEDUPLICATION & SHUFFLE STATE ---
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- PULL TO REFRESH TOUCH STATE ---
  const touchStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const isPullingRef = useRef(false);

  // --- CHANNEL PROFILE & SUBSCRIPTIONS ---
  const [selectedChannelProfile, setSelectedChannelProfile] = useState(null);
  const [showSubListType, setShowSubListType] = useState(null);

  const [localSubscriptions, setLocalSubscriptions] = useState(() => {
    try {
      const s = localStorage.getItem(`infinity_subs_${currentUserId}`);
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  });

  // --- 1. FACEBOOK-STYLE BACK BUTTON HANDLING (SCROLL TO TOP ON BACK) ---
  const isScrolledRef = useRef(false);

  const scrollToTop = useCallback(() => {
    if (feedContainerRef.current) {
      feedContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = feedContainerRef.current
        ? feedContainerRef.current.scrollTop
        : window.scrollY;

      if (currentScroll > 150) {
        if (!isScrolledRef.current) {
          isScrolledRef.current = true;
          // Push dummy state to capture back button
          window.history.pushState({ feedScrolled: true }, "");
        }
      } else {
        isScrolledRef.current = false;
      }
    };

    const container = feedContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { passive: true });

    const handlePopState = (e) => {
      const currentScroll = feedContainerRef.current
        ? feedContainerRef.current.scrollTop
        : window.scrollY;

      // If user is scrolled down, scroll up smoothly instead of closing app or leaving
      if (currentScroll > 120 || isScrolledRef.current) {
        scrollToTop();
        isScrolledRef.current = false;
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      if (container) container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [scrollToTop]);

  // --- 2. PULL-TO-REFRESH IMPLEMENTATION ---
  const handleTouchStart = (e) => {
    const container = feedContainerRef.current;
    const isAtTop = !container || container.scrollTop <= 0;
    if (isAtTop && e.touches && e.touches[0]) {
      touchStartY.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPullingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0) {
      // Apply tension dampening
      const distance = Math.min(80, diff * 0.45);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 50) {
      handleRefreshFeed();
    }
    setPullDistance(0);
    isPullingRef.current = false;
  };

  // Re-shuffle and refresh feed
  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setShuffleSeed((prev) => prev + 1);
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(30);
    }
    setTimeout(() => {
      setIsRefreshing(false);
      scrollToTop();
      if (showToast) showToast("Feed refreshed with latest updates!");
    }, 500);
  };

  // Save notifications locally
  const pushNotification = (notif) => {
    const updated = [
      {
        id: "notif_" + Date.now(),
        time: "Just now",
        read: false,
        ...notif
      },
      ...notifications
    ].slice(0, 30);

    setNotifications(updated);
    try {
      localStorage.setItem(`infinity_notifs_${currentUserId}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const markAllNotifsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      localStorage.setItem(`infinity_notifs_${currentUserId}`, JSON.stringify(updated));
    } catch (e) {}
  };

  // Check if current user owns a channel
  const myChannel = useMemo(() => {
    return channels.find(
      (c) =>
        c.creatorPhone === currentUserId ||
        c.creatorId === currentUserId ||
        (Array.isArray(c.admins) && c.admins.includes(currentUserId))
    );
  }, [channels, currentUserId]);

  // Suggested channels (not yet subscribed by user)
  const suggestedChannels = useMemo(() => {
    return channels
      .filter((c) => c.id !== myChannel?.id && !localSubscriptions.includes(c.id))
      .slice(0, 6);
  }, [channels, myChannel, localSubscriptions]);

  // --- DEDUPLICATED & ALGORITHMIC ORDERED POSTS ---
  const processedPosts = useMemo(() => {
    const map = new Map();
    // Unique deduplication by ID
    feedPosts.forEach((post) => {
      if (post && post.id && !map.has(post.id)) {
        map.set(post.id, post);
      }
    });

    const uniqueList = Array.from(map.values());

    // Algorithmic weighting: (Likes * 2) + Comments count + freshness
    return uniqueList.sort((a, b) => {
      const aReactions = Object.keys(a.reactions || a.likes || {}).length;
      const bReactions = Object.keys(b.reactions || b.likes || {}).length;
      const aComments = (localCommentsMap[a.id] || []).length;
      const bComments = (localCommentsMap[b.id] || []).length;

      const aScore = aReactions * 2 + aComments + (shuffleSeed % 2 === 0 ? 1 : 0);
      const bScore = bReactions * 2 + bComments;

      return bScore - aScore;
    });
  }, [feedPosts, localCommentsMap, shuffleSeed]);

  // --- MEDIA PICKER ---
  const handleMediaSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setMediaPreview({
        url: evt.target.result,
        type: type,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB"
      });
    };
    reader.readAsDataURL(file);
  };

  // --- CREATE CHANNEL ---
  const handleCreateChannelSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) {
      if (showToast) showToast("Please enter a channel name");
      return;
    }

    const newChannelData = {
      id: "ch_" + Date.now(),
      name: channelName.trim(),
      desc: channelBio.trim() || "Official public broadcast channel",
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(channelName.trim())}`,
      creatorPhone: currentUserId,
      creatorId: currentUserId,
      admins: [currentUserId],
      subscribers: [currentUserId],
      subscriptions: [],
      createdAt: new Date().toISOString()
    };

    if (onBroadcastPost) {
      await onBroadcastPost(newChannelData, "🎉 Welcome to our official broadcast channel!", null);
    }

    setShowChannelModal(false);
    setChannelName("");
    setChannelBio("");
    if (showToast) showToast(`Channel "${newChannelData.name}" created! You can now publish posts.`);
  };

  // --- PUBLISH POST ---
  const handlePublishPost = async (e) => {
    e.preventDefault();

    if (!myChannel) {
      setShowChannelModal(true);
      if (showToast) showToast("You must create a Channel before posting!");
      return;
    }

    if (!postText.trim() && !mediaPreview) {
      if (showToast) showToast("Please write something or attach media");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onBroadcastPost) {
        await onBroadcastPost(myChannel, postText.trim(), mediaPreview);
      }
      setPostText("");
      setMediaPreview(null);
      if (showToast) showToast("Post published to the News Feed!");
    } catch (err) {
      if (showToast) showToast("Error publishing post: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- TOGGLE SUBSCRIBE ---
  const handleToggleSubscribe = (channelId, channelTitle = "Channel") => {
    const isSubscribed = localSubscriptions.includes(channelId);
    let updated;
    if (isSubscribed) {
      updated = localSubscriptions.filter((id) => id !== channelId);
      if (showToast) showToast(`Unsubscribed from ${channelTitle}`);
    } else {
      updated = [...localSubscriptions, channelId];
      if (showToast) showToast(`Subscribed to ${channelTitle}! 🎉`);

      // Trigger notification
      pushNotification({
        type: "subscriber",
        senderName: channelTitle,
        senderAvatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${channelId}`,
        text: `You subscribed to ${channelTitle}. You will receive fresh updates.`
      });
    }

    setLocalSubscriptions(updated);
    try {
      localStorage.setItem(`infinity_subs_${currentUserId}`, JSON.stringify(updated));
    } catch (e) {}
  };

  // --- REACTIONS ---
  const handleSelectReaction = (post, reactionObj) => {
    if (onReaction) {
      onReaction(post.id, reactionObj.emoji);
    } else if (onToggleLike) {
      onToggleLike(post.id);
    }
    setHoveredReactionPostId(null);
    if (showToast) showToast(`Reacted ${reactionObj.emoji}`);

    if (post.creatorPhone && post.creatorPhone !== currentUserId) {
      pushNotification({
        type: "reaction",
        senderName: currentUser?.name || "You",
        senderAvatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
        text: `Reacted ${reactionObj.emoji} to ${post.channelName || "Channel"}'s post.`,
        postId: post.id
      });
    }
  };

  // --- THREADED COMMENTS & REPLIES ---
  const handleAddComment = (postId) => {
    const text = (commentInputMap[postId] || "").trim();
    if (!text) return;

    const replyContext = replyingToCommentMap[postId];

    const newComment = {
      id: "comment_" + Date.now(),
      authorId: currentUserId,
      authorName: currentUser?.name || "User",
      authorAvatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
      content: text,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      replyToAuthor: replyContext?.authorName || null,
      replyToCommentId: replyContext?.commentId || null,
      likes: {}
    };

    const existing = localCommentsMap[postId] || [];
    const updated = [...existing, newComment];
    const newMap = { ...localCommentsMap, [postId]: updated };

    setLocalCommentsMap(newMap);
    setCommentInputMap((prev) => ({ ...prev, [postId]: "" }));
    setReplyingToCommentMap((prev) => ({ ...prev, [postId]: null }));

    try {
      localStorage.setItem("infinity_feed_comments_v2", JSON.stringify(newMap));
    } catch (e) {}

    pushNotification({
      type: "comment",
      senderName: currentUser?.name || "User",
      senderAvatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
      text: replyContext
        ? `Replied to ${replyContext.authorName}: "${text.slice(0, 30)}..."`
        : `Commented on post: "${text.slice(0, 30)}..."`,
      postId: postId
    });
  };

  const handleToggleCommentLike = (postId, commentId) => {
    const existing = localCommentsMap[postId] || [];
    const updated = existing.map((comm) => {
      if (comm.id === commentId) {
        const likes = { ...(comm.likes || {}) };
        if (likes[currentUserId]) {
          delete likes[currentUserId];
        } else {
          likes[currentUserId] = true;
        }
        return { ...comm, likes };
      }
      return comm;
    });

    const newMap = { ...localCommentsMap, [postId]: updated };
    setLocalCommentsMap(newMap);
    try {
      localStorage.setItem("infinity_feed_comments_v2", JSON.stringify(newMap));
    } catch (e) {}
  };

  // --- REACTION SUMMARY (TOP 3 EMOJIS) ---
  const getReactionSummary = (post) => {
    const reactions = post.reactions || {};
    const emojisCount = {};

    Object.values(reactions).forEach((emoji) => {
      emojisCount[emoji] = (emojisCount[emoji] || 0) + 1;
    });

    if (post.likes && Object.keys(post.likes).length > 0) {
      emojisCount["❤️"] = (emojisCount["❤️"] || 0) + Object.keys(post.likes).length;
    }

    const topEmojis = Object.entries(emojisCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emoji]) => emoji);

    const totalCount = Object.values(emojisCount).reduce((acc, count) => acc + count, 0);

    return { topEmojis, totalCount, details: reactions };
  };

  return (
    <div
      ref={feedContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        flex: 1,
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorY: "contain",
        backgroundColor: THEME.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 12px 60px",
        position: "relative"
      }}
    >
      {/* Pull-to-refresh Visual Indicator */}
      {pullDistance > 0 && (
        <div
          style={{
            height: `${pullDistance}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            color: THEME.primary || "#22c55e",
            fontSize: "12px",
            fontWeight: "600",
            gap: "8px",
            overflow: "hidden",
            transition: pullDistance === 0 ? "height 0.2s ease" : "none"
          }}
        >
          <RefreshCw
            size={16}
            style={{
              transform: `rotate(${pullDistance * 4}deg)`,
              transition: "transform 0.1s linear"
            }}
          />
          <span>{pullDistance >= 50 ? "Release to refresh feed" : "Pull down to refresh"}</span>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "620px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* --- FEED TOP NAVIGATION: REFRESH & NOTIFICATIONS TOGGLE --- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 2px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: "800", color: THEME.text }}>News Feed</span>
            <button
              onClick={handleRefreshFeed}
              style={{
                ...styles.cleanBtn,
                color: THEME.textMuted,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px"
              }}
              title="Refresh Feed"
            >
              <RefreshCw size={13} style={{ transform: isRefreshing ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Notifications Drawer Toggle */}
          <button
            onClick={() => {
              setShowNotificationsDrawer(true);
              markAllNotifsRead();
            }}
            style={{
              position: "relative",
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.border}`,
              borderRadius: "20px",
              padding: "6px 12px",
              color: THEME.text,
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Bell size={15} color={unreadNotifCount > 0 ? (THEME.primary || "#22c55e") : THEME.textMuted} />
            <span>Alerts</span>
            {unreadNotifCount > 0 && (
              <span
                style={{
                  backgroundColor: THEME.primary || "#22c55e",
                  color: "#fff",
                  borderRadius: "10px",
                  fontSize: "10px",
                  fontWeight: "800",
                  padding: "0 6px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {unreadNotifCount}
              </span>
            )}
          </button>
        </div>

        {/* --- BANNER: MANDATORY CHANNEL REMINDER IF NO CHANNEL EXISTS --- */}
        {!myChannel && (
          <div
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              border: `1.5px solid ${THEME.primary || "#22c55e"}`,
              borderRadius: "12px",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Sparkles size={24} color={THEME.primary || "#22c55e"} />
              <div>
                <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  Create a Channel to start posting!
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  All public posts on the News Feed originate from an official Channel profile.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowChannelModal(true)}
              style={{
                backgroundColor: THEME.primary || "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap"
              }}
            >
              <PlusCircle size={15} />
              <span>Create Channel</span>
            </button>
          </div>
        )}

        {/* --- FACEBOOK-STYLE POST CREATOR (TOP OF FEED) --- */}
        <div
          style={{
            backgroundColor: THEME.card,
            borderRadius: "14px",
            border: `1px solid ${THEME.border}`,
            padding: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <img
              src={myChannel?.avatar || currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
              alt=""
              style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "700", fontSize: "13px", color: THEME.text }}>
                {myChannel ? myChannel.name : currentUser?.name || "Your Profile"}
              </div>
              <div style={{ fontSize: "11px", color: myChannel ? (THEME.primary || "#22c55e") : THEME.textMuted }}>
                {myChannel ? "Posting as Official Channel" : "Channel required to publish"}
              </div>
            </div>
          </div>

          <form onSubmit={handlePublishPost}>
            <textarea
              placeholder={myChannel ? `What's on your mind, ${myChannel.name}?` : "Create a channel to post updates..."}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                backgroundColor: THEME.header,
                border: `1px solid ${THEME.border}`,
                borderRadius: "10px",
                padding: "12px",
                color: THEME.text,
                fontSize: "13px",
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: "10px"
              }}
            />

            {/* Media Upload Preview */}
            {mediaPreview && (
              <div
                style={{
                  position: "relative",
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginBottom: "12px",
                  maxHeight: "260px",
                  backgroundColor: "#000"
                }}
              >
                {mediaPreview.type === "video" ? (
                  <video src={mediaPreview.url} controls style={{ width: "100%", maxHeight: "260px", objectFit: "contain" }} />
                ) : (
                  <img src={mediaPreview.url} alt="Preview" style={{ width: "100%", maxHeight: "260px", objectFit: "contain" }} />
                )}
                <button
                  type="button"
                  onClick={() => setMediaPreview(null)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    backgroundColor: "rgba(0,0,0,0.7)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "28px",
                    height: "28px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Actions: Photo, Video, Submit */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: `1px solid ${THEME.border}`,
                paddingTop: "12px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: THEME.textMuted,
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    backgroundColor: THEME.header
                  }}
                >
                  <ImageIcon size={16} color="#22c55e" />
                  <span>Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMediaSelect(e, "image")}
                    style={{ display: "none" }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: THEME.textMuted,
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    backgroundColor: THEME.header
                  }}
                >
                  <Video size={16} color="#38bdf8" />
                  <span>Video</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleMediaSelect(e, "video")}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (!postText.trim() && !mediaPreview)}
                style={{
                  backgroundColor: THEME.primary || "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: "20px",
                  padding: "8px 22px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: isSubmitting || (!postText.trim() && !mediaPreview) ? 0.5 : 1
                }}
              >
                <Send size={14} />
                <span>{isSubmitting ? "Posting..." : "Post"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* --- SUGGESTED CHANNELS DISCOVERY CAROUSEL --- */}
        {suggestedChannels.length > 0 && (
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "14px",
              border: `1px solid ${THEME.border}`,
              padding: "14px 16px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <Compass size={16} color={THEME.primary || "#22c55e"} />
              <span style={{ fontSize: "13px", fontWeight: "700", color: THEME.text }}>
                Suggested Channels to Follow
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                overflowX: "auto",
                paddingBottom: "6px",
                WebkitOverflowScrolling: "touch"
              }}
            >
              {suggestedChannels.map((sug) => (
                <div
                  key={sug.id}
                  style={{
                    minWidth: "130px",
                    backgroundColor: THEME.header,
                    borderRadius: "10px",
                    border: `1px solid ${THEME.border}`,
                    padding: "12px 10px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <img
                    src={sug.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${sug.id}`}
                    alt=""
                    style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: THEME.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      width: "100%"
                    }}
                  >
                    {sug.name}
                  </div>
                  <button
                    onClick={() => handleToggleSubscribe(sug.id, sug.name)}
                    style={{
                      backgroundColor: THEME.primary || "#22c55e",
                      color: "#fff",
                      border: "none",
                      borderRadius: "14px",
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      width: "100%"
                    }}
                  >
                    Subscribe
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- DYNAMIC NEWS FEED POSTS --- */}
        {processedPosts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
            <Users size={48} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: "15px", fontWeight: "700", color: THEME.text }}>No posts in the News Feed yet</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Be the first to create a channel and publish a public broadcast!
            </div>
          </div>
        ) : (
          processedPosts.map((post) => {
            const channelId = post.channelId || post.id;
            const isSubscribed = localSubscriptions.includes(channelId);
            const isLiked = post.likes && post.likes[currentUserId];
            const { topEmojis, totalCount, details } = getReactionSummary(post);

            const postComments = localCommentsMap[post.id] || [];
            const isCommentsOpen = activeCommentsPostId === post.id;
            const currentReplyingTo = replyingToCommentMap[post.id];

            return (
              <div
                key={post.id}
                style={{
                  backgroundColor: THEME.card,
                  borderRadius: "14px",
                  border: `1px solid ${THEME.border}`,
                  padding: "16px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  position: "relative"
                }}
              >
                {/* Header: Channel info & Subscribe button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div
                    onClick={() => {
                      const channelObj = channels.find((c) => c.id === channelId) || {
                        id: channelId,
                        name: post.channelName || post.authorName || "Channel",
                        avatar: post.channelAvatar,
                        subscribers: [currentUserId],
                        subscriptions: []
                      };
                      setSelectedChannelProfile(channelObj);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                  >
                    <img
                      src={post.channelAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${channelId}`}
                      alt=""
                      style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                        {post.channelName || post.authorName || "Public Channel"}
                      </div>
                      <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleSubscribe(channelId, post.channelName)}
                    style={{
                      backgroundColor: isSubscribed ? "rgba(34, 197, 94, 0.15)" : (THEME.primary || "#22c55e"),
                      color: isSubscribed ? (THEME.primary || "#22c55e") : "#fff",
                      border: isSubscribed ? `1px solid ${THEME.primary || "#22c55e"}` : "none",
                      borderRadius: "18px",
                      padding: "5px 12px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px"
                    }}
                  >
                    {isSubscribed ? <UserCheck size={13} /> : <UserPlus size={13} />}
                    <span>{isSubscribed ? "Subscribed" : "Subscribe"}</span>
                  </button>
                </div>

                {/* Post Text */}
                {post.content && (
                  <div
                    style={{
                      fontSize: "14px",
                      color: THEME.text,
                      lineHeight: "1.5",
                      marginBottom: post.fileUrl ? "12px" : "8px",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {post.content}
                  </div>
                )}

                {/* Media Preview (Video / Photo) */}
                {post.fileUrl && (
                  <div
                    style={{
                      borderRadius: "10px",
                      overflow: "hidden",
                      backgroundColor: "#000",
                      marginBottom: "12px",
                      position: "relative"
                    }}
                  >
                    {post.type === "video" ? (
                      <video
                        src={post.fileUrl}
                        controls
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", maxHeight: "380px", display: "block" }}
                      />
                    ) : (
                      <img
                        src={post.fileUrl}
                        alt=""
                        onClick={() => onLightbox && onLightbox({ url: post.fileUrl, type: post.type, name: post.fileName })}
                        style={{ width: "100%", maxHeight: "420px", objectFit: "contain", display: "block", cursor: "pointer" }}
                      />
                    )}
                  </div>
                )}

                {/* Reaction Summary Bar (Clicking opens Reaction List Modal) */}
                {totalCount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingBottom: "8px",
                      borderBottom: `1px solid ${THEME.border}`,
                      fontSize: "12px",
                      color: THEME.textMuted
                    }}
                  >
                    <div
                      onClick={() => setViewingReactionsPost(post)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                    >
                      <span style={{ fontSize: "14px" }}>{topEmojis.join("")}</span>
                      <span style={{ fontWeight: "700", color: THEME.text }}>{totalCount}</span>
                      <span style={{ fontSize: "11px", color: THEME.textMuted }}>(View Reacted)</span>
                    </div>

                    {postComments.length > 0 && (
                      <div
                        onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                        style={{ cursor: "pointer" }}
                      >
                        {postComments.length} {postComments.length === 1 ? "comment" : "comments"}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Bar: Like (Floating Picker), Comment, Share */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                    paddingTop: "8px",
                    position: "relative"
                  }}
                >
                  {/* Floating Multi-Reaction Bar */}
                  {hoveredReactionPostId === post.id && (
                    <div
                      onMouseEnter={() => clearTimeout(reactionTimerRef.current)}
                      onMouseLeave={() => setHoveredReactionPostId(null)}
                      style={{
                        position: "absolute",
                        bottom: "42px",
                        left: "10px",
                        backgroundColor: THEME.sidebar,
                        borderRadius: "30px",
                        border: `1px solid ${THEME.border}`,
                        padding: "6px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        zIndex: 100,
                        animation: "fadeIn 0.2s ease"
                      }}
                    >
                      {REACTION_EMOJIS.map((rec) => (
                        <button
                          key={rec.id}
                          onClick={() => handleSelectReaction(post, rec)}
                          style={{
                            background: "none",
                            border: "none",
                            fontSize: "20px",
                            cursor: "pointer",
                            padding: "2px",
                            transition: "transform 0.15s ease"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.35)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                          title={rec.label}
                        >
                          {rec.emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Like Button */}
                  <button
                    onMouseEnter={() => {
                      reactionTimerRef.current = setTimeout(() => {
                        setHoveredReactionPostId(post.id);
                      }, 250);
                    }}
                    onMouseLeave={() => {
                      reactionTimerRef.current = setTimeout(() => {
                        setHoveredReactionPostId(null);
                      }, 600);
                    }}
                    onClick={() => {
                      if (onToggleLike) onToggleLike(post.id);
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: isLiked ? (THEME.primary || "#22c55e") : THEME.textMuted,
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      borderRadius: "8px"
                    }}
                  >
                    <Heart size={16} fill={isLiked ? (THEME.primary || "#22c55e") : "none"} />
                    <span>Like</span>
                  </button>

                  {/* Comment Button */}
                  <button
                    onClick={() => setActiveCommentsPostId(isCommentsOpen ? null : post.id)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: isCommentsOpen ? (THEME.primary || "#22c55e") : THEME.textMuted,
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      borderRadius: "8px"
                    }}
                  >
                    <MessageCircle size={16} />
                    <span>Comment</span>
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: post.channelName || "Infinity Chat Post",
                          text: post.content || "",
                          url: window.location.href
                        }).catch(() => {});
                      } else if (onForward) {
                        onForward(post);
                      }
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "8px",
                      border: "none",
                      backgroundColor: "transparent",
                      color: THEME.textMuted,
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      borderRadius: "8px"
                    }}
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>

                {/* --- THREADED & NESTED COMMENTS SECTION --- */}
                {isCommentsOpen && (
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: `1px solid ${THEME.border}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px"
                    }}
                  >
                    {/* Replying Context Indicator */}
                    {currentReplyingTo && (
                      <div
                        style={{
                          backgroundColor: THEME.header,
                          borderRadius: "8px",
                          padding: "4px 10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          color: THEME.primary || "#22c55e"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <CornerDownRight size={13} />
                          <span>Replying to <strong>{currentReplyingTo.authorName}</strong></span>
                        </div>
                        <button
                          onClick={() => setReplyingToCommentMap({ ...replyingToCommentMap, [post.id]: null })}
                          style={styles.cleanBtn}
                        >
                          <X size={13} color={THEME.textMuted} />
                        </button>
                      </div>
                    )}

                    {/* Input Composer */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img
                        src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
                        alt=""
                        style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                      />
                      <input
                        type="text"
                        placeholder={currentReplyingTo ? `Reply to ${currentReplyingTo.authorName}...` : "Write a comment..."}
                        value={commentInputMap[post.id] || ""}
                        onChange={(e) => setCommentInputMap({ ...commentInputMap, [post.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddComment(post.id);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: THEME.header,
                          border: `1px solid ${THEME.border}`,
                          borderRadius: "20px",
                          padding: "8px 14px",
                          fontSize: "12px",
                          color: THEME.text,
                          outline: "none"
                        }}
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={!(commentInputMap[post.id] || "").trim()}
                        style={{
                          backgroundColor: THEME.primary || "#22c55e",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          opacity: (commentInputMap[post.id] || "").trim() ? 1 : 0.5
                        }}
                      >
                        <Send size={13} />
                      </button>
                    </div>

                    {/* Threaded Comments List */}
                    {postComments.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                        {postComments.map((comm) => {
                          const isCommentLiked = comm.likes && comm.likes[currentUserId];
                          const commentLikeCount = Object.keys(comm.likes || {}).length;
                          const isNestedReply = !!comm.replyToCommentId;

                          return (
                            <div
                              key={comm.id}
                              style={{
                                display: "flex",
                                gap: "8px",
                                marginLeft: isNestedReply ? "28px" : "0px"
                              }}
                            >
                              <img
                                src={comm.authorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
                                alt=""
                                style={{ width: "26px", height: "26px", borderRadius: "50%", marginTop: "2px" }}
                              />
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    backgroundColor: THEME.header,
                                    borderRadius: "12px",
                                    padding: "8px 12px"
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: "700", fontSize: "12px", color: THEME.text }}>
                                      {comm.authorName}
                                    </span>
                                    <span style={{ fontSize: "10px", color: THEME.textMuted }}>{comm.createdAt}</span>
                                  </div>

                                  {/* Reply tag if nested */}
                                  {comm.replyToAuthor && (
                                    <div style={{ fontSize: "10px", color: THEME.primary || "#22c55e", marginBottom: "2px" }}>
                                      replying to @{comm.replyToAuthor}
                                    </div>
                                  )}

                                  <div style={{ fontSize: "12px", color: THEME.text, marginTop: "2px" }}>
                                    {comm.content}
                                  </div>
                                </div>

                                {/* Comment Actions: Like Comment & Reply */}
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", paddingLeft: "6px" }}>
                                  <button
                                    onClick={() => handleToggleCommentLike(post.id, comm.id)}
                                    style={{
                                      ...styles.cleanBtn,
                                      color: isCommentLiked ? (THEME.primary || "#22c55e") : THEME.textMuted,
                                      fontSize: "11px",
                                      fontWeight: "600",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "3px"
                                    }}
                                  >
                                    <Heart size={11} fill={isCommentLiked ? (THEME.primary || "#22c55e") : "none"} />
                                    <span>{commentLikeCount > 0 ? `${commentLikeCount} Like` : "Like"}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setReplyingToCommentMap({
                                        ...replyingToCommentMap,
                                        [post.id]: { commentId: comm.id, authorName: comm.authorName }
                                      });
                                    }}
                                    style={{
                                      ...styles.cleanBtn,
                                      color: THEME.textMuted,
                                      fontSize: "11px",
                                      fontWeight: "600"
                                    }}
                                  >
                                    Reply
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: "11px", color: THEME.textMuted, textAlign: "center", padding: "4px" }}>
                        No comments yet. Start the conversation!
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        style={{
          position: "fixed",
          bottom: "75px",
          right: "20px",
          backgroundColor: THEME.card,
          border: `1px solid ${THEME.border}`,
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: THEME.text,
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          zIndex: 40
        }}
        title="Scroll to Top"
      >
        <ArrowUp size={18} />
      </button>

      {/* --- NOTIFICATIONS DRAWER / SLIDE-OVER --- */}
      {showNotificationsDrawer && (
        <div style={styles.modalOverlay}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "460px"
            }}
          >
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text, display: "flex", alignItems: "center", gap: "8px" }}>
                <Bell size={18} color={THEME.primary || "#22c55e"} />
                <span>Notifications & Alerts</span>
              </div>
              <button onClick={() => setShowNotificationsDrawer(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <div
              style={{
                maxHeight: "380px",
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                WebkitOverflowScrolling: "touch"
              }}
            >
              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: THEME.textMuted, fontSize: "13px" }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      borderRadius: "10px",
                      backgroundColor: n.read ? THEME.card : "rgba(34, 197, 94, 0.1)",
                      border: `1px solid ${THEME.border}`
                    }}
                  >
                    <img
                      src={n.senderAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
                      alt=""
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", color: THEME.text, lineHeight: "1.4" }}>
                        <strong>{n.senderName}</strong> {n.text}
                      </div>
                      <div style={{ fontSize: "10px", color: THEME.textMuted, marginTop: "2px" }}>
                        {n.time}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- REACTED BY MODAL (REACTION BREAKDOWN LIST) --- */}
      {viewingReactionsPost && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border, maxWidth: "420px" }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                People who reacted to this post
              </div>
              <button onClick={() => setViewingReactionsPost(null)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <div style={{ padding: "14px", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(viewingReactionsPost.reactions || {}).length === 0 &&
              (!viewingReactionsPost.likes || Object.keys(viewingReactionsPost.likes).length === 0) ? (
                <div style={{ textAlign: "center", color: THEME.textMuted, fontSize: "12px", padding: "20px" }}>
                  No reactions yet.
                </div>
              ) : (
                <>
                  {Object.entries(viewingReactionsPost.reactions || {}).map(([uid, emo]) => (
                    <div
                      key={uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        backgroundColor: THEME.header,
                        borderRadius: "8px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img
                          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`}
                          alt=""
                          style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                          {uid === currentUserId ? "You" : `User ${uid.slice(-4)}`}
                        </span>
                      </div>
                      <span style={{ fontSize: "18px" }}>{emo}</span>
                    </div>
                  ))}

                  {Object.keys(viewingReactionsPost.likes || {}).map((uid) => (
                    <div
                      key={"like_" + uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        backgroundColor: THEME.header,
                        borderRadius: "8px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img
                          src={`https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`}
                          alt=""
                          style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                          {uid === currentUserId ? "You" : `User ${uid.slice(-4)}`}
                        </span>
                      </div>
                      <span style={{ fontSize: "18px" }}>❤️</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE CHANNEL MODAL --- */}
      {showChannelModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>
                Create Channel to Post
              </div>
              <button onClick={() => setShowChannelModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12px", color: THEME.textMuted, margin: 0 }}>
                To maintain high-quality news broadcasts, all posts are published from an official Channel profile with subscribers.
              </p>

              <div>
                <label style={styles.label}>Channel Name</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="text"
                    placeholder="e.g. Dhaka Live Updates, Tech Beat"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    style={{ ...styles.bareInput, color: THEME.text }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label style={styles.label}>Channel Bio / Description</label>
                <div style={{ ...styles.inputWrap, backgroundColor: THEME.card, borderColor: THEME.border }}>
                  <input
                    type="text"
                    placeholder="Brief description of what your channel shares"
                    value={channelBio}
                    onChange={(e) => setChannelBio(e.target.value)}
                    style={{ ...styles.bareInput, color: THEME.text }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary || "#22c55e",
                  marginTop: "6px"
                }}
              >
                Create Channel & Start Posting
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CHANNEL PROFILE MODAL --- */}
      {selectedChannelProfile && (
        <div style={styles.modalOverlay}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              textAlign: "center",
              padding: "20px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setSelectedChannelProfile(null)} style={styles.cleanBtn}>
                <X size={18} color={THEME.textMuted} />
              </button>
            </div>

            <img
              src={selectedChannelProfile.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${selectedChannelProfile.id}`}
              alt=""
              style={{ width: "80px", height: "80px", borderRadius: "50%", margin: "0 auto 10px", objectFit: "cover" }}
            />

            <h3 style={{ margin: "0 0 4px", color: THEME.text }}>{selectedChannelProfile.name}</h3>
            <p style={{ fontSize: "12px", color: THEME.textMuted, margin: "0 0 16px" }}>
              {selectedChannelProfile.desc || "Official News & Broadcast Channel"}
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "24px",
                padding: "12px",
                backgroundColor: THEME.card,
                borderRadius: "10px",
                marginBottom: "16px"
              }}
            >
              <div onClick={() => setShowSubListType("subscribers")} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: "18px", fontWeight: "800", color: THEME.primary || "#22c55e" }}>
                  {(selectedChannelProfile.subscribers || []).length || 1}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>Subscribers</div>
              </div>

              <div style={{ width: "1px", backgroundColor: THEME.border }} />

              <div onClick={() => setShowSubListType("subscriptions")} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: "18px", fontWeight: "800", color: THEME.text }}>
                  {(selectedChannelProfile.subscriptions || []).length || 0}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>Subscriptions</div>
              </div>
            </div>

            <button
              onClick={() => handleToggleSubscribe(selectedChannelProfile.id, selectedChannelProfile.name)}
              style={{
                ...styles.primaryBtn,
                backgroundColor: localSubscriptions.includes(selectedChannelProfile.id)
                  ? THEME.card
                  : (THEME.primary || "#22c55e"),
                color: localSubscriptions.includes(selectedChannelProfile.id) ? THEME.text : "#fff",
                border: `1px solid ${THEME.primary || "#22c55e"}`
              }}
            >
              {localSubscriptions.includes(selectedChannelProfile.id) ? "Unsubscribe Channel" : "Subscribe to Channel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
