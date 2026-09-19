import React, { useState, useMemo, useRef } from "react";
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
  Check
} from "lucide-react";
import { styles } from "../firebase";

const REACTION_EMOJIS = [
  { id: "like", emoji: "👍", label: "Like", color: "#22c55e" },
  { id: "love", emoji: "❤️", label: "Love", color: "#f43f5e" },
  { id: "care", emoji: "🥰", label: "Care", color: "#eab308" },
  { id: "haha", emoji: "😂", label: "Haha", color: "#facc15" },
  { id: "angry", emoji: "😡", label: "Angry", color: "#ef4444" },
  { id: "sad", emoji: "😥", label: "Sad", color: "#38bdf8" },
  { id: "wow", emoji: "😱", label: "Wow", color: "#a855f7" }
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

  // --- POST CREATOR STATE ---
  const [postText, setPostText] = useState("");
  const [mediaPreview, setMediaPreview] = useState(null); // { url, type, name, size }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- MANDATORY CHANNEL MODAL ---
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelBio, setChannelBio] = useState("");

  // --- COMMENTS INTERACTIVE INLINE STATE ---
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentInputMap, setCommentInputMap] = useState({});
  const [localCommentsMap, setLocalCommentsMap] = useState(() => {
    try {
      const saved = localStorage.getItem("infinity_feed_comments");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // --- REACTION POPUP BAR STATE ---
  const [hoveredReactionPostId, setHoveredReactionPostId] = useState(null);
  const reactionTimerRef = useRef(null);

  // --- CHANNEL PROFILE & SUBSCRIPTION MODAL STATE ---
  const [selectedChannelProfile, setSelectedChannelProfile] = useState(null);
  const [showSubListType, setShowSubListType] = useState(null); // 'subscribers' | 'subscriptions'

  // --- LOCAL PERSISTED SUBSCRIPTIONS MAP ---
  const [localSubscriptions, setLocalSubscriptions] = useState(() => {
    try {
      const s = localStorage.getItem(`infinity_subs_${currentUserId}`);
      return s ? JSON.parse(s) : [];
    } catch (e) {
      return [];
    }
  });

  // Check if current user already owns at least one channel
  const myChannel = useMemo(() => {
    return channels.find(
      (c) =>
        c.creatorPhone === currentUserId ||
        c.creatorId === currentUserId ||
        (Array.isArray(c.admins) && c.admins.includes(currentUserId))
    );
  }, [channels, currentUserId]);

  // --- 1. HANDLE MEDIA PICKER ---
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

  // --- 2. CREATE CHANNEL ACTION ---
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
      // Create initial broadcast or channel structure
      await onBroadcastPost(newChannelData, "🎉 Welcome to our official broadcast channel!", null);
    }

    setShowChannelModal(false);
    setChannelName("");
    setChannelBio("");
    if (showToast) showToast(`Channel "${newChannelData.name}" created! You can now publish posts.`);
  };

  // --- 3. SUBMIT NEW FACEBOOK-STYLE POST ---
  const handlePublishPost = async (e) => {
    e.preventDefault();

    // Mandatory channel check
    if (!myChannel) {
      setShowChannelModal(true);
      if (showToast) showToast("You must create a Channel before posting!");
      return;
    }

    if (!postText.trim() && !mediaPreview) {
      if (showToast) showToast("Please write something or attach a photo/video");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onBroadcastPost) {
        await onBroadcastPost(myChannel, postText.trim(), mediaPreview);
      }
      setPostText("");
      setMediaPreview(null);
      if (showToast) showToast("Post published to shared News Feed!");
    } catch (err) {
      if (showToast) showToast("Error publishing post: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. TOGGLE SUBSCRIBE TO CHANNEL ---
  const handleToggleSubscribe = (channelId, channelName = "Channel") => {
    const isSubscribed = localSubscriptions.includes(channelId);
    let updated;
    if (isSubscribed) {
      updated = localSubscriptions.filter((id) => id !== channelId);
      if (showToast) showToast(`Unsubscribed from ${channelName}`);
    } else {
      updated = [...localSubscriptions, channelId];
      if (showToast) showToast(`Subscribed to ${channelName}! 🎉`);
    }
    setLocalSubscriptions(updated);
    try {
      localStorage.setItem(`infinity_subs_${currentUserId}`, JSON.stringify(updated));
    } catch (e) {}
  };

  // --- 5. POST REACTION DISPATCH ---
  const handleSelectReaction = (postId, reactionObj) => {
    if (onReaction) {
      onReaction(postId, reactionObj.emoji);
    } else if (onToggleLike) {
      onToggleLike(postId);
    }
    setHoveredReactionPostId(null);
    if (showToast) showToast(`Reacted ${reactionObj.emoji}`);
  };

  // --- 6. COMMENTS SYSTEM ---
  const handleAddComment = (postId) => {
    const text = (commentInputMap[postId] || "").trim();
    if (!text) return;

    const newComment = {
      id: "comment_" + Date.now(),
      authorName: currentUser?.name || "User",
      authorAvatar: currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160",
      content: text,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const existing = localCommentsMap[postId] || [];
    const updated = [...existing, newComment];
    const newMap = { ...localCommentsMap, [postId]: updated };

    setLocalCommentsMap(newMap);
    setCommentInputMap((prev) => ({ ...prev, [postId]: "" }));
    try {
      localStorage.setItem("infinity_feed_comments", JSON.stringify(newMap));
    } catch (e) {}
  };

  // --- 7. NATIVE SOCIAL SHARE ---
  const handleSharePost = async (post) => {
    const shareData = {
      title: `${post.channelName || "Channel"} on Infinity Chat`,
      text: post.content || "Check out this post on Infinity Chat!",
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}\n${shareData.url}`);
        if (showToast) showToast("Link copied to clipboard!");
      } catch (e) {
        if (onForward) onForward(post);
      }
    }
  };

  return (
    <div
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
        padding: "16px 12px 60px"
      }}
    >
      <div style={{ width: "100%", maxWidth: "620px", display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* --- BANNER: MANDATORY CHANNEL REMINDER IF USER HAS NO CHANNEL --- */}
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

        {/* --- FACEBOOK-STYLE POST CREATION BOX (TOP OF FEED) --- */}
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
              <div style={{ fontSize: "11px", color: myChannel ? THEME.primary || "#22c55e" : THEME.textMuted }}>
                {myChannel ? "Posting as Official Channel" : "Create a channel to broadcast"}
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

            {/* Action Buttons: Photo, Video, Submit */}
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
                {/* Photo Upload */}
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

                {/* Video Upload */}
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

        {/* --- GLOBAL PUBLIC NEWS FEED POSTS --- */}
        {feedPosts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
            <Users size={48} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: "15px", fontWeight: "700", color: THEME.text }}>No posts in the News Feed yet</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              Be the first to create a channel and publish a public broadcast!
            </div>
          </div>
        ) : (
          feedPosts.map((post) => {
            const channelId = post.channelId || post.id;
            const isSubscribed = localSubscriptions.includes(channelId);
            const isLiked = post.likes && post.likes[currentUserId];
            const reactionKeys = Object.values(post.reactions || {});
            const totalReactions = (Object.keys(post.likes || {}).length || 0) + reactionKeys.length;
            const postComments = localCommentsMap[post.id] || [];
            const isCommentsOpen = activeCommentsPostId === post.id;

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
                {/* Post Header: Channel Avatar, Name, Timestamp & Subscribe Button */}
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
                      <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{post.channelName || post.authorName || "Public Channel"}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                      </div>
                    </div>
                  </div>

                  {/* Subscribe / Subscribed Toggle Button */}
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

                {/* Post Content / Caption */}
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

                {/* Custom Responsive HTML5 Video Player or Image Viewer */}
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
                        style={{
                          width: "100%",
                          maxHeight: "380px",
                          borderRadius: "10px",
                          display: "block"
                        }}
                      />
                    ) : (
                      <img
                        src={post.fileUrl}
                        alt=""
                        onClick={() => onLightbox && onLightbox({ url: post.fileUrl, type: post.type, name: post.fileName })}
                        style={{
                          width: "100%",
                          maxHeight: "420px",
                          objectFit: "contain",
                          display: "block",
                          cursor: "pointer"
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Reactions Count & Breakdown Summary */}
                {totalReactions > 0 && (
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
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "14px" }}>❤️ 👍</span>
                      <span>{totalReactions}</span>
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

                {/* --- ACTION BAR: LIKE (MULTI-REACTION), COMMENT, SHARE --- */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-around",
                    paddingTop: "8px",
                    position: "relative"
                  }}
                >
                  {/* Floating Multi-Reaction Bar (Hover or Long-Press) */}
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
                          onClick={() => handleSelectReaction(post.id, rec)}
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
                    onClick={() => handleSharePost(post)}
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

                {/* --- INLINE INTERACTIVE COMMENTS SECTION --- */}
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
                    {/* Add Comment Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img
                        src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
                        alt=""
                        style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                      />
                      <input
                        type="text"
                        placeholder="Write a comment..."
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

                    {/* Comments List */}
                    {postComments.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                        {postComments.map((comm) => (
                          <div key={comm.id} style={{ display: "flex", gap: "8px" }}>
                            <img
                              src={comm.authorAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160"}
                              alt=""
                              style={{ width: "28px", height: "28px", borderRadius: "50%", marginTop: "2px" }}
                            />
                            <div
                              style={{
                                backgroundColor: THEME.header,
                                borderRadius: "12px",
                                padding: "8px 12px",
                                flex: 1
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: "700", fontSize: "12px", color: THEME.text }}>
                                  {comm.authorName}
                                </span>
                                <span style={{ fontSize: "10px", color: THEME.textMuted }}>{comm.createdAt}</span>
                              </div>
                              <div style={{ fontSize: "12px", color: THEME.text, marginTop: "2px" }}>
                                {comm.content}
                              </div>
                            </div>
                          </div>
                        ))}
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

      {/* --- MODAL: CREATE CHANNEL (MANDATORY REQUIREMENT FOR POSTING) --- */}
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

      {/* --- MODAL: CHANNEL PROFILE & SUBSCRIBERS / SUBSCRIPTIONS --- */}
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

            {/* Counts: Subscribers & Subscriptions */}
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
              <div
                onClick={() => setShowSubListType("subscribers")}
                style={{ cursor: "pointer" }}
              >
                <div style={{ fontSize: "18px", fontWeight: "800", color: THEME.primary || "#22c55e" }}>
                  {(selectedChannelProfile.subscribers || []).length || 1}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>Subscribers</div>
              </div>

              <div style={{ width: "1px", backgroundColor: THEME.border }} />

              <div
                onClick={() => setShowSubListType("subscriptions")}
                style={{ cursor: "pointer" }}
              >
                <div style={{ fontSize: "18px", fontWeight: "800", color: THEME.text }}>
                  {(selectedChannelProfile.subscriptions || []).length || 0}
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>Subscriptions</div>
              </div>
            </div>

            {/* Modal Sub-List View for Subscribers/Subscriptions */}
            {showSubListType && (
              <div
                style={{
                  backgroundColor: THEME.header,
                  borderRadius: "8px",
                  padding: "10px",
                  marginBottom: "14px",
                  maxHeight: "140px",
                  overflowY: "auto",
                  textAlign: "left"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: THEME.text }}>
                    {showSubListType === "subscribers" ? "Channel Subscribers" : "Subscribed Channels"}
                  </span>
                  <button onClick={() => setShowSubListType(null)} style={styles.cleanBtn}>
                    <X size={12} color={THEME.textMuted} />
                  </button>
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted }}>
                  {showSubListType === "subscribers"
                    ? `Active followers including ${currentUser?.name || "User"}`
                    : "No public subscriptions listed."}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                handleToggleSubscribe(selectedChannelProfile.id, selectedChannelProfile.name);
              }}
              style={{
                ...styles.primaryBtn,
                backgroundColor: localSubscriptions.includes(selectedChannelProfile.id)
                  ? THEME.card
                  : (THEME.primary || "#22c55e"),
                color: localSubscriptions.includes(selectedChannelProfile.id)
                  ? THEME.text
                  : "#fff",
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
