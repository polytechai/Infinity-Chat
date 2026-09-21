import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import {
  X,
  Users,
  Camera,
  Check,
  Search,
  Upload,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { db, styles, normalizePhone } from "../../firebase";

export default function GroupModal({
  currentUser,
  onClose,
  onGroupCreated,
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
  showToast
}) {
  const myUserId =
    currentUser?.uid || currentUser?.id || normalizePhone(currentUser?.phone) || "";

  // Step 1: "members" selection, Step 2: "details" (title, avatar)
  const [step, setStep] = useState("members");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [availableContacts, setAvailableContacts] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  // -------------------------------------------------------------
  // FETCH REGISTERED CONTACTS / USERS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!db) return;
    const usersQuery = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const u = docSnap.data();
          const userId = normalizePhone(u.phone || docSnap.id);
          // Exclude self from selectable list
          if (userId && userId !== myUserId) {
            list.push({
              id: userId,
              name: u.name || userId,
              phone: u.phone || userId,
              avatar:
                u.avatar ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${userId}`
            });
          }
        });
        setAvailableContacts(list);
      },
      (err) => {
        console.warn("Failed to load contacts for group modal:", err);
      }
    );

    return () => unsubscribe();
  }, [myUserId]);

  // -------------------------------------------------------------
  // AVATAR IMAGE UPLOADER & COMPRESSION
  // -------------------------------------------------------------
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setGroupAvatar(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Toggle member selection
  const handleToggleMember = (contactId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  // -------------------------------------------------------------
  // SAVE GROUP CONVERSATION TO FIRESTORE (Point 8)
  // -------------------------------------------------------------
  const handleCreateGroup = async () => {
    const trimmedTitle = groupTitle.trim();
    if (!trimmedTitle) {
      if (showToast) showToast("Please provide a group name");
      return;
    }
    if (selectedMemberIds.length === 0) {
      if (showToast) showToast("Please select at least one member");
      return;
    }

    setIsSubmitting(true);
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const allParticipants = Array.from(new Set([myUserId, ...selectedMemberIds]));

    const fallbackAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${groupId}`;
    const finalAvatar = groupAvatar || fallbackAvatar;

    // Build participant details dictionary
    const participantDetails = {
      [myUserId]: {
        name: currentUser?.name || myUserId,
        avatar: currentUser?.avatar || "",
        role: "admin",
        joinedAt: new Date().toISOString()
      }
    };

    availableContacts.forEach((contact) => {
      if (allParticipants.includes(contact.id)) {
        participantDetails[contact.id] = {
          name: contact.name,
          avatar: contact.avatar,
          role: "member",
          joinedAt: new Date().toISOString()
        };
      }
    });

    const newGroupPayload = {
      id: groupId,
      name: trimmedTitle,
      groupName: trimmedTitle,
      avatar: finalAvatar,
      groupAvatar: finalAvatar,
      isGroup: true,
      createdBy: myUserId,
      creatorPhone: myUserId,
      admins: [myUserId],
      participants: allParticipants,
      participantDetails,
      lastMessage: `Group "${trimmedTitle}" created`,
      lastSenderId: myUserId,
      lastMessageTimestamp: Date.now(),
      unreadCounts: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save group conversation doc in Firestore
      await setDoc(doc(db, "conversations", groupId), newGroupPayload);

      // 2. Initial system announcement message
      await setDoc(doc(db, "rooms", groupId, "messages", `${Date.now()}`), {
        senderId: myUserId,
        senderName: currentUser?.name || myUserId,
        content: `🎉 ${currentUser?.name || "User"} created group "${trimmedTitle}" with ${allParticipants.length} members`,
        type: "system",
        createdAt: new Date().toISOString()
      });

      setIsSubmitting(false);
      if (showToast) showToast(`Group "${trimmedTitle}" created!`);

      if (onGroupCreated) {
        onGroupCreated(newGroupPayload);
      }
      onClose?.();
    } catch (err) {
      console.error("Group creation error:", err);
      setIsSubmitting(false);
      if (showToast) showToast("Failed to create group: " + err.message);
    }
  };

  // Filter contacts by search input
  const filteredContacts = availableContacts.filter((c) => {
    if (!searchContact.trim()) return true;
    const term = searchContact.toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 5500 }}>
      <div
        style={{
          ...styles.modalCard,
          backgroundColor: THEME.sidebar,
          borderColor: THEME.border,
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          maxHeight: "88vh",
          padding: 0,
          overflow: "hidden"
        }}
      >
        {/* --- MODAL HEADER --- */}
        <div
          style={{
            ...styles.modalHeader,
            backgroundColor: THEME.header,
            borderColor: THEME.border,
            padding: "12px 16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color={THEME.primary} />
            <span style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>
              {step === "members" ? "Add Group Members" : "New Group Details"}
            </span>
          </div>
          <button onClick={onClose} style={styles.cleanBtn}>
            <X size={18} color={THEME.textMuted} />
          </button>
        </div>

        {/* --- STEP 1: SELECT GROUP MEMBERS --- */}
        {step === "members" && (
          <div
            style={{
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              flex: 1,
              overflow: "hidden"
            }}
          >
            {/* Search Input */}
            <div
              style={{
                ...styles.searchWrap,
                backgroundColor: THEME.card,
                border: `1px solid ${THEME.border}`,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px"
              }}
            >
              <Search size={15} color={THEME.textMuted} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                style={{
                  ...styles.bareInput,
                  color: THEME.text,
                  fontSize: "13px"
                }}
              />
            </div>

            {/* Selected Chips */}
            {selectedMemberIds.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  overflowX: "auto",
                  paddingBottom: "4px"
                }}
              >
                {selectedMemberIds.map((id) => {
                  const member = availableContacts.find((c) => c.id === id);
                  return (
                    <div
                      key={id}
                      onClick={() => handleToggleMember(id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        backgroundColor: "rgba(34, 197, 94, 0.15)",
                        border: `1px solid ${THEME.primary}`,
                        color: THEME.text,
                        borderRadius: "16px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      <span>{member?.name || id}</span>
                      <X size={12} color={THEME.primary} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contacts Selection List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: `1px solid ${THEME.border}`,
                borderRadius: "8px",
                backgroundColor: THEME.card,
                padding: "4px"
              }}
            >
              {filteredContacts.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 14px",
                    color: THEME.textMuted,
                    fontSize: "12px"
                  }}
                >
                  No contacts found
                </div>
              ) : (
                filteredContacts.map((c) => {
                  const isChecked = selectedMemberIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleToggleMember(c.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: isChecked ? THEME.cardHover : "transparent",
                        cursor: "pointer",
                        transition: "background-color 0.12s ease"
                      }}
                    >
                      <img
                        src={c.avatar}
                        alt=""
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          objectFit: "cover"
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: THEME.text,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {c.name}
                        </div>
                        <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                          {c.phone}
                        </div>
                      </div>

                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          border: `1.5px solid ${
                            isChecked ? THEME.primary : THEME.textMuted
                          }`,
                          backgroundColor: isChecked ? THEME.primary : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {isChecked && <Check size={12} color="#fff" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Next Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={onClose}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: THEME.card,
                  color: THEME.textMuted,
                  padding: "8px 16px"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedMemberIds.length === 0) {
                    if (showToast) showToast("Please select at least 1 member");
                    return;
                  }
                  setStep("details");
                }}
                disabled={selectedMemberIds.length === 0}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  width: "auto",
                  padding: "8px 20px",
                  opacity: selectedMemberIds.length === 0 ? 0.5 : 1
                }}
              >
                Next ({selectedMemberIds.length})
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 2: SET GROUP TITLE & AVATAR --- */}
        {step === "details" && (
          <div
            style={{
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              flex: 1,
              overflowY: "auto"
            }}
          >
            {/* Avatar Picker */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarFile}
                accept="image/*"
                style={{ display: "none" }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "relative",
                  width: "76px",
                  height: "76px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  overflow: "hidden",
                  border: `2px dashed ${THEME.primary}`,
                  backgroundColor: THEME.card,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {groupAvatar ? (
                  <img
                    src={groupAvatar}
                    alt="Group"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: THEME.textMuted }}>
                    <Camera size={24} color={THEME.primary} />
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: "2px 0",
                    display: "flex",
                    justifyContent: "center"
                  }}
                >
                  <Upload size={12} color="#fff" />
                </div>
              </div>

              <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                Tap to upload group icon
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label style={styles.label}>Group Subject / Name</label>
              <input
                type="text"
                placeholder="e.g. Project Alpha, Family..."
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                maxLength={40}
                autoFocus
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: THEME.text,
                  fontSize: "14px"
                }}
              />
            </div>

            {/* Summary details */}
            <div
              style={{
                backgroundColor: THEME.card,
                padding: "12px",
                borderRadius: "8px",
                fontSize: "12px",
                color: THEME.textMuted,
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
            >
              <div>
                <strong>Total Members:</strong> {selectedMemberIds.length + 1} (including you)
              </div>
              <div>
                <strong>Creator & Admin:</strong> {currentUser?.name || myUserId}
              </div>
            </div>

            {/* Navigation & Create */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
              <button
                type="button"
                onClick={() => setStep("members")}
                style={{
                  ...styles.cleanBtn,
                  color: THEME.textMuted,
                  fontSize: "13px"
                }}
              >
                ← Back to members
              </button>

              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isSubmitting || !groupTitle.trim()}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  width: "auto",
                  padding: "8px 24px",
                  opacity: isSubmitting || !groupTitle.trim() ? 0.5 : 1
                }}
              >
                {isSubmitting ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
