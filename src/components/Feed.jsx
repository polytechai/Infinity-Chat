import React, { useState } from "react";
import {
  Radio,
  Share2,
  Download,
  FileText,
  Paperclip,
  X,
  Send
} from "lucide-react";
import { normalizePhone, styles } from "../firebase";

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
  const [createPostModal, setCreatePostModal] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [postText, setPostText] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myNorm = normalizePhone(currentUser?.phone);

  // Filter channels where the current user is Creator or Admin
  const adminChannels = channels.filter(
    (c) => c.creatorPhone === myNorm || c.admins?.includes(myNorm)
  );

  const handleCreatePost = async () => {
    const targetChannel = channels.find(
      (c) => c.id === (selectedChannelId || adminChannels[0]?.id)
    );
    if (!targetChannel) {
      showToast?.("Please select or create an admin channel first!");
      return;
    }
    if (!postText.trim() && !postFile) {
      showToast?.("Please enter a message or attach a file.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onBroadcastPost(targetChannel, postText, postFile);
      setPostText("");
      setPostFile(null);
      setCreatePostModal(false);
      showToast?.("Post published to channel and social feed!");
    } catch (err) {
      showToast?.("Failed to publish post: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {/* Feed Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 2px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: THEME.text }}>Social Stream</div>
          <div style={{ fontSize: "11px", color: THEME.textMuted }}>Updates from creators & public channels</div>
        </div>
        {adminChannels.length > 0 && (
          <button
            onClick={() => setCreatePostModal(true)}
            style={{ ...styles.pillBtn, backgroundColor: THEME.primary, color: "#fff", padding: "6px 14px" }}
          >
            + Post Update
          </button>
        )}
      </div>

      {/* Posts Stream */}
      {feedPosts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 16px", color: THEME.textMuted }}>
          <Radio size={40} color={THEME.textMuted} style={{ marginBottom: "10px" }} />
          <div style={{ fontWeight: "600", fontSize: "15px" }}>No Broadcast Posts Yet</div>
          <div style={{ fontSize: "12px", marginTop: "6px", maxWidth: "280px", margin: "6px auto 0" }}>
            Subscribe to channels in the Channels tab or create your own channel to see updates here!
          </div>
        </div>
      ) : (
        feedPosts.map((post) => {
          const hasLiked = !!post.likes?.[myNorm];
          const likeCount = Object.keys(post.likes || {}).length;
          const reactionList = Object.entries(post.reactions || {});

          return (
            <div
              key={post.id}
              style={{
                backgroundColor: THEME.card,
                borderRadius: "12px",
                border: `1px solid ${THEME.border}`,
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
              }}
            >
              {/* Channel Header Info */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  onClick={() => onOpenChannel?.(post.channelId)}
                  style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                >
                  <img
                    src={post.channelAvatar || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160"}
                    alt=""
                    style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", color: THEME.text }}>
                      <span>{post.channelName}</span>
                      <span style={{ fontSize: "10px", backgroundColor: THEME.primary, color: "#fff", padding: "1px 6px", borderRadius: "6px" }}>
                        Admin
                      </span>
                    </div>
                    <div style={{ fontSize: "10px", color: THEME.textMuted }}>
                      {new Date(post.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onForward?.(post)}
                  style={{ ...styles.cleanBtn, color: THEME.textMuted, padding: "6px" }}
                  title="Forward Post"
                >
                  <Share2 size={16} />
                </button>
              </div>

              {/* Post Text Content */}
              {post.content && (
                <div style={{ fontSize: "13px", lineHeight: "1.5", color: THEME.text, whiteSpace: "pre-wrap" }}>
                  {post.content}
                </div>
              )}

              {/* Photo Media preview with Lightbox viewer */}
              {post.type === "image" && post.fileUrl && (
                <div
                  onClick={() => onLightbox?.({ url: post.fileUrl, type: "image", name: post.fileName || "Photo" })}
                  style={{ borderRadius: "8px", overflow: "hidden", cursor: "zoom-in", maxHeight: "300px", backgroundColor: "#000" }}
                >
                  <img src={post.fileUrl} alt="media" style={{ width: "100%", maxHeight: "300px", objectFit: "contain" }} />
                </div>
              )}

              {/* Video Player */}
              {post.type === "video" && post.fileUrl && (
                <div style={{ borderRadius: "8px", overflow: "hidden", maxHeight: "300px" }}>
                  <video src={post.fileUrl} controls style={{ width: "100%", borderRadius: "8px" }} />
                </div>
              )}

              {/* Document / File attachment with Direct Download */}
              {(post.type === "file" || post.type === "pdf") && post.fileUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "rgba(0,0,0,0.15)" }}>
                  <FileText size={22} color={THEME.secondary} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: THEME.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {post.fileName || "Attached Document"}
                    </div>
                    <div style={{ fontSize: "10px", color: THEME.textMuted }}>{post.fileSize || "File"}</div>
                  </div>
                  <a href={post.fileUrl} download={post.fileName || "file_download"} style={{ ...styles.cleanBtn, color: THEME.primary, padding: "6px" }} title="Download file">
                    <Download size={18} />
                  </a>
                </div>
              )}

              {/* Reaction Badges List */}
              {reactionList.length > 0 && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                  {reactionList.slice(0, 6).map(([phone, emo]) => (
                    <span key={phone} style={{ fontSize: "11px", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: "8px", padding: "2px 6px" }}>
                      {emo}
                    </span>
                  ))}
                  {reactionList.length > 6 && (
                    <span style={{ fontSize: "10px", color: THEME.textMuted }}>+{reactionList.length - 6}</span>
                  )}
                </div>
              )}

              {/* Action Toolbar: Heart Like, Reactions & Save */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${THEME.border}`, paddingTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button
                    onClick={() => onToggleLike?.(post.id)}
                    style={{
                      ...styles.cleanBtn,
                      color: hasLiked ? THEME.danger : THEME.textMuted,
                      fontWeight: hasLiked ? "700" : "500",
                      fontSize: "12px",
                      gap: "4px"
                    }}
                  >
                    <span>{hasLiked ? "❤️" : "🤍"}</span>
                    <span>{likeCount > 0 ? likeCount : "Like"}</span>
                  </button>

                  <div style={{ display: "flex", gap: "6px" }}>
                    {["🔥", "👍", "😂", "👏"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => onReaction?.(post.id, emoji)}
                        style={{ ...styles.cleanBtn, fontSize: "14px", padding: "2px", opacity: 0.85 }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {post.fileUrl && (
                  <a
                    href={post.fileUrl}
                    download={post.fileName || "media_download"}
                    style={{ ...styles.cleanBtn, color: THEME.primary, fontSize: "12px", gap: "4px" }}
                    title="Download Media"
                  >
                    <Download size={14} />
                    <span>Save</span>
                  </a>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* --- CREATE POST MODAL --- */}
      {createPostModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>Post to Social Feed & Channel</div>
              <button onClick={() => setCreatePostModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={styles.label}>Select Broadcasting Channel</label>
                <select
                  value={selectedChannelId || adminChannels[0]?.id || ""}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: THEME.card,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: THEME.text,
                    fontSize: "13px"
                  }}
                >
                  {adminChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Broadcast Message</label>
                <textarea
                  rows={4}
                  placeholder="Share news, updates, announcements with your subscribers..."
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: THEME.card,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: "8px",
                    padding: "10px",
                    color: THEME.text,
                    resize: "none",
                    fontSize: "13px"
                  }}
                />
              </div>

              {/* File / Media Attachment */}
              <div>
                <input
                  type="file"
                  id="feed-file-picker"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isImg = file.type.startsWith("image/");
                    const isVid = file.type.startsWith("video/");
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setPostFile({
                        type: isImg ? "image" : isVid ? "video" : "file",
                        fileUrl: ev.target.result,
                        fileName: file.name,
                        fileSize: `${(file.size / 1024).toFixed(1)} KB`
                      });
                      showToast?.(`Attached: ${file.name}`);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("feed-file-picker")?.click()}
                  style={{ ...styles.pillBtn, backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.text }}
                >
                  <Paperclip size={14} />
                  <span>Attach Photo, Video or Document</span>
                </button>
                {postFile && (
                  <div style={{ marginTop: "6px", fontSize: "12px", color: THEME.accent, display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>📎 {postFile.fileName} ({postFile.fileSize})</span>
                    <X size={14} style={{ cursor: "pointer" }} onClick={() => setPostFile(null)} />
                  </div>
                )}
              </div>

              <button
                disabled={isSubmitting}
                onClick={handleCreatePost}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  marginTop: "6px",
                  opacity: isSubmitting ? 0.6 : 1
                }}
              >
                <Send size={15} />
                <span>{isSubmitting ? "Publishing..." : "Publish Update"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
