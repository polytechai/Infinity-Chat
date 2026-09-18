import React, { useState } from "react";
import {
  Radio,
  ArrowLeft,
  ShieldCheck,
  Share2,
  Download,
  FileText,
  Paperclip,
  X,
  Send,
  Users
} from "lucide-react";
import { normalizePhone, styles } from "../firebase";

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
  const [createChannelModal, setCreateChannelModal] = useState(false);
  const [manageAdminsModal, setManageAdminsModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelAvatar, setNewChannelAvatar] = useState("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160");
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastFile, setBroadcastFile] = useState(null);
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const myNorm = normalizePhone(currentUser?.phone);

  const handleCreateChannelSubmit = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      await onPromoteAdmin?.("create", {
        name: newChannelName.trim(),
        desc: newChannelDesc.trim(),
        avatar: newChannelAvatar.trim() || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160"
      });
      setNewChannelName("");
      setNewChannelDesc("");
      setCreateChannelModal(false);
      showToast?.("Channel created successfully!");
    } catch (err) {
      showToast?.("Error creating channel: " + err.message);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastText.trim() && !broadcastFile) return;
    setIsBroadcasting(true);
    try {
      await onBroadcastPost(activeChannel, broadcastText, broadcastFile);
      setBroadcastText("");
      setBroadcastFile(null);
      showToast?.("Broadcast sent to channel!");
    } catch (err) {
      showToast?.("Failed to broadcast: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleAddAdminSubmit = async () => {
    if (!newAdminPhone.trim()) return;
    try {
      await onPromoteAdmin?.("promote", { phone: newAdminPhone.trim() });
      setNewAdminPhone("");
      showToast?.("Member promoted to admin!");
    } catch (err) {
      showToast?.("Error: " + err.message);
    }
  };

  // --- ACTIVE CHANNEL CONVERSATION / BROADCAST VIEW ---
  if (activeChannel) {
    const isSubbed = (activeChannel.subscribers || []).includes(myNorm);
    const isCreator = activeChannel.creatorPhone === myNorm;
    const isAdmin = isCreator || (activeChannel.admins || []).includes(myNorm);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", backgroundColor: THEME.bg }}>
        {/* Channel Header */}
        <div style={{ ...styles.headerBar, backgroundColor: THEME.header, borderColor: THEME.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                setActiveChannel(null);
                setMobileView?.("list");
              }}
              style={styles.cleanBtn}
            >
              <ArrowLeft size={18} color={THEME.text} />
            </button>
            <img
              src={activeChannel.avatar || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160"}
              alt=""
              style={styles.roundAvatar}
            />
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", color: THEME.text }}>
                <span>{activeChannel.name}</span>
                <span style={{ fontSize: "10px", backgroundColor: THEME.secondary, color: "#fff", padding: "1px 6px", borderRadius: "8px" }}>
                  Channel
                </span>
              </div>
              <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                {(activeChannel.subscribers || []).length} subscriber{(activeChannel.subscribers || []).length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {isCreator && (
              <button
                onClick={() => setManageAdminsModal(true)}
                style={{ ...styles.pillBtn, backgroundColor: THEME.card, borderColor: THEME.border, color: THEME.primary }}
                title="Manage Admins"
              >
                <ShieldCheck size={14} />
                <span>Admins</span>
              </button>
            )}
            <button
              onClick={(e) => onToggleSubscribe?.(activeChannel, e)}
              style={{
                ...styles.pillBtn,
                backgroundColor: isSubbed ? THEME.card : THEME.primary,
                color: isSubbed ? THEME.textMuted : "#fff"
              }}
            >
              {isSubbed ? "Subscribed" : "Subscribe"}
            </button>
          </div>
        </div>

        {/* Channel Posts Timeline */}
        <div style={styles.messagesViewport}>
          {channelPosts.length === 0 ? (
            <div style={{ textAlign: "center", color: THEME.textMuted, margin: "auto" }}>
              <Radio size={40} color={THEME.secondary} style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "15px", fontWeight: "700", color: THEME.text }}>{activeChannel.name}</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>{activeChannel.desc}</div>
              <div style={{ fontSize: "11px", marginTop: "8px", color: THEME.textMuted }}>No updates broadcasted yet.</div>
            </div>
          ) : (
            channelPosts.map((post) => {
              const hasLiked = !!post.likes?.[myNorm];
              const likeCount = Object.keys(post.likes || {}).length;

              return (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: THEME.card,
                    borderRadius: "10px",
                    padding: "12px 14px",
                    border: `1px solid ${THEME.border}`,
                    width: "100%",
                    maxWidth: "600px",
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: "700", fontSize: "13px", color: THEME.text }}>{post.authorName || activeChannel.name}</span>
                      <span style={{ fontSize: "9px", backgroundColor: THEME.primary, color: "#fff", padding: "1px 4px", borderRadius: "4px" }}>Admin</span>
                    </div>
                    <span style={{ fontSize: "10px", color: THEME.textMuted }}>
                      {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {post.content && (
                    <div style={{ fontSize: "13px", lineHeight: "1.5", color: THEME.text, whiteSpace: "pre-wrap" }}>
                      {post.content}
                    </div>
                  )}

                  {post.type === "image" && post.fileUrl && (
                    <div
                      onClick={() => onLightbox?.({ url: post.fileUrl, type: "image", name: post.fileName || "Photo" })}
                      style={{ borderRadius: "8px", overflow: "hidden", cursor: "zoom-in", maxHeight: "300px" }}
                    >
                      <img src={post.fileUrl} alt="" style={{ width: "100%", maxHeight: "300px", objectFit: "contain", backgroundColor: "#000" }} />
                    </div>
                  )}

                  {post.type === "video" && post.fileUrl && (
                    <div style={{ borderRadius: "8px", overflow: "hidden", maxHeight: "300px" }}>
                      <video src={post.fileUrl} controls style={{ width: "100%", borderRadius: "8px" }} />
                    </div>
                  )}

                  {(post.type === "file" || post.type === "pdf") && post.fileUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", backgroundColor: "rgba(0,0,0,0.15)" }}>
                      <FileText size={18} color={THEME.secondary} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: "12px", color: THEME.text }}>{post.fileName || "Document"}</div>
                      <a href={post.fileUrl} download={post.fileName || "download"} style={{ ...styles.cleanBtn, color: THEME.primary }}>
                        <Download size={16} />
                      </a>
                    </div>
                  )}

                  {/* Post footer & actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${THEME.border}`, paddingTop: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={() => onToggleLike?.(post.id)}
                        style={{ ...styles.cleanBtn, color: hasLiked ? THEME.danger : THEME.textMuted, fontSize: "12px", gap: "4px" }}
                      >
                        <span>{hasLiked ? "❤️" : "🤍"}</span>
                        <span>{likeCount > 0 ? likeCount : ""}</span>
                      </button>
                      {["🔥", "👍", "👏"].map((emo) => (
                        <button key={emo} onClick={() => onReaction?.(post.id, emo)} style={{ ...styles.cleanBtn, fontSize: "13px" }}>
                          {emo}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => onForward?.(post)} style={{ ...styles.cleanBtn, color: THEME.textMuted }} title="Forward">
                      <Share2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Broadcaster bar or Read-only banner */}
        {isAdmin ? (
          <div style={{ ...styles.inputBar, backgroundColor: THEME.card, borderColor: THEME.border }}>
            <input
              type="file"
              id="channel-attachment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const isImg = file.type.startsWith("image/");
                const isVid = file.type.startsWith("video/");
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setBroadcastFile({
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
            <button onClick={() => document.getElementById("channel-attachment")?.click()} style={styles.cleanBtn} title="Attach photo, video or doc">
              <Paperclip size={18} color={broadcastFile ? THEME.primary : THEME.textMuted} />
            </button>
            {broadcastFile && (
              <div style={{ fontSize: "11px", color: THEME.accent, display: "flex", alignItems: "center", gap: "4px" }}>
                <span>📎 {broadcastFile.fileName}</span>
                <X size={13} style={{ cursor: "pointer" }} onClick={() => setBroadcastFile(null)} />
              </div>
            )}
            <div style={{ ...styles.inputWrap, flex: 1, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <input
                type="text"
                placeholder="Broadcast an update to all subscribers..."
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendBroadcast(); }}
                style={{ ...styles.bareInput, color: THEME.text }}
              />
            </div>
            <button disabled={isBroadcasting} onClick={handleSendBroadcast} style={{ ...styles.circleBtn, backgroundColor: THEME.primary }}>
              <Send size={15} color="#fff" />
            </button>
          </div>
        ) : (
          <div style={{ padding: "12px 16px", backgroundColor: THEME.card, borderTop: `1px solid ${THEME.border}`, textAlign: "center", fontSize: "12px", color: THEME.textMuted }}>
            📢 Broadcast-only channel. Only Channel Admins can post updates.
          </div>
        )}

        {/* --- MANAGE ADMINS MODAL --- */}
        {manageAdminsModal && isCreator && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
              <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
                <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>Manage Channel Admins</div>
                <button onClick={() => setManageAdminsModal(false)} style={styles.cleanBtn}><X size={18} color={THEME.text} /></button>
              </div>
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: THEME.textMuted, marginBottom: "8px" }}>Current Admins</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: THEME.card, borderRadius: "8px", marginBottom: "6px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>{activeChannel.creatorPhone}</div>
                      <div style={{ fontSize: "10px", color: THEME.accent }}>Owner & Creator</div>
                    </div>
                    <span style={{ fontSize: "11px", color: THEME.textMuted }}>Owner</span>
                  </div>
                  {(activeChannel.admins || []).map((adminPhone) => (
                    <div key={adminPhone} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: THEME.card, borderRadius: "8px", marginBottom: "6px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>{adminPhone}</div>
                        <div style={{ fontSize: "10px", color: THEME.secondary }}>Broadcaster Admin</div>
                      </div>
                      <button
                        onClick={() => onDemoteAdmin?.(activeChannel.id, adminPhone)}
                        style={{ ...styles.cleanBtn, color: THEME.danger, fontSize: "11px", fontWeight: "600" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: "12px" }}>
                  <label style={styles.label}>Promote Member by BD Mobile Number</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="tel"
                      placeholder="017XXXXXXXX"
                      value={newAdminPhone}
                      onChange={(e) => setNewAdminPhone(e.target.value)}
                      style={{ ...styles.bareInput, flex: 1, backgroundColor: THEME.card, padding: "8px 12px", borderRadius: "8px", border: `1px solid ${THEME.border}`, color: THEME.text }}
                    />
                    <button
                      onClick={handleAddAdminSubmit}
                      style={{ ...styles.pillBtn, backgroundColor: THEME.primary, color: "#fff", padding: "8px 14px" }}
                    >
                      Promote
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- PUBLIC CHANNELS DIRECTORY ---
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: THEME.text }}>Public Channels</div>
          <div style={{ fontSize: "11px", color: THEME.textMuted }}>Discover & follow public broadcasts</div>
        </div>
        <button
          onClick={() => setCreateChannelModal(true)}
          style={{ ...styles.pillBtn, backgroundColor: THEME.primary, color: "#fff", padding: "6px 14px" }}
        >
          + New Channel
        </button>
      </div>

      {channels.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: THEME.textMuted }}>
          <Users size={36} style={{ marginBottom: "8px" }} />
          <div>No public channels found. Create the first one!</div>
        </div>
      ) : (
        channels.map((ch) => {
          const isSubbed = (ch.subscribers || []).includes(myNorm);
          const isCreator = ch.creatorPhone === myNorm;
          const isAdmin = isCreator || (ch.admins || []).includes(myNorm);

          return (
            <div
              key={ch.id}
              style={{
                backgroundColor: THEME.card,
                borderRadius: "10px",
                border: `1px solid ${THEME.border}`,
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <img
                src={ch.avatar || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160"}
                alt=""
                style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{ch.name}</span>
                  {isAdmin && (
                    <span style={{ fontSize: "10px", backgroundColor: THEME.accent, color: "#fff", padding: "1px 5px", borderRadius: "6px" }}>
                      {isCreator ? "Creator" : "Admin"}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ch.desc || "Public channel"}
                </div>
                <div style={{ fontSize: "11px", color: THEME.primary, marginTop: "2px" }}>
                  {(ch.subscribers || []).length} subscriber{(ch.subscribers || []).length === 1 ? "" : "s"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <button
                  onClick={(e) => onToggleSubscribe?.(ch, e)}
                  style={{
                    ...styles.pillBtn,
                    backgroundColor: isSubbed ? THEME.cardHover : THEME.primary,
                    borderColor: isSubbed ? THEME.border : "transparent",
                    color: isSubbed ? THEME.textMuted : "#fff"
                  }}
                >
                  {isSubbed ? "Following" : "Follow"}
                </button>
                <button
                  onClick={() => {
                    setActiveChannel(ch);
                    setMobileView?.("chat");
                  }}
                  style={{
                    ...styles.pillBtn,
                    backgroundColor: THEME.secondary,
                    color: "#fff"
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* --- CREATE PUBLIC CHANNEL MODAL --- */}
      {createChannelModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>Create Public Channel</div>
              <button onClick={() => setCreateChannelModal(false)} style={styles.cleanBtn}>
                <X size={18} color={THEME.text} />
              </button>
            </div>
            <form onSubmit={handleCreateChannelSubmit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={styles.label}>Channel Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bangladesh Tech News"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  style={{ ...styles.bareInput, backgroundColor: THEME.card, padding: "10px", borderRadius: "8px", border: `1px solid ${THEME.border}`, color: THEME.text }}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>Description</label>
                <textarea
                  placeholder="What is this channel about?"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  rows={3}
                  style={{ ...styles.bareInput, backgroundColor: THEME.card, padding: "10px", borderRadius: "8px", border: `1px solid ${THEME.border}`, color: THEME.text, resize: "none" }}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>Avatar Icon URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newChannelAvatar}
                  onChange={(e) => setNewChannelAvatar(e.target.value)}
                  style={{ ...styles.bareInput, backgroundColor: THEME.card, padding: "10px", borderRadius: "8px", border: `1px solid ${THEME.border}`, color: THEME.text }}
                />
              </div>
              <button type="submit" style={{ ...styles.primaryBtn, backgroundColor: THEME.primary, marginTop: "6px" }}>
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
