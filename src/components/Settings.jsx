import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import {
  X,
  User,
  Shield,
  Bell,
  FileText,
  Database,
  Globe,
  Share2,
  Volume2,
  RefreshCw,
  Moon,
  LogOut,
  Radio,
  Lock,
  Unlock,
  KeyRound,
  Fingerprint,
  UserX,
  Eye,
  EyeOff,
  Check,
  Trash2,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { normalizePhone, styles } from "../firebase";

export default function Settings({
  currentUser,
  setCurrentUser,
  lang,
  setLang,
  darkMode,
  setDarkMode,
  notificationsEnabled,
  setNotificationsEnabled,
  soundEnabled,
  setSoundEnabled,
  ghostMode,
  setGhostMode,
  selectedRingtone,
  setSelectedRingtone,
  THEME,
  t,
  onClose,
  onOpenChannels,
  onLogout,
  showToast,
  db
}) {
  const [settingsTab, setSettingsTab] = useState("main");
  const avatarUploadRef = useRef(null);

  // Authenticated user identifier for strict private scope
  const myUserId =
    currentUser?.uid || currentUser?.id || normalizePhone(currentUser?.phone) || "";

  // -------------------------------------------------------------
  // 1. PRIVATE BLOCKED CONTACTS LIST (Point 9)
  // Strictly isolate blocklist per currentUser.uid / myUserId
  // -------------------------------------------------------------
  const [blockedList, setBlockedList] = useState([]);
  const [blockedUsersDetails, setBlockedUsersDetails] = useState({});
  const [loadingBlockedDetails, setLoadingBlockedDetails] = useState(false);

  const loadBlockedContacts = () => {
    try {
      // Primary private store scoped to user's UID/phone
      const rawUserBlocked = localStorage.getItem(`infinity_blocked_contacts_${myUserId}`);
      let blk = [];
      if (rawUserBlocked) {
        blk = JSON.parse(rawUserBlocked);
      } else {
        // Fallback backward compatibility check
        const legacy = localStorage.getItem("infinity_blocked_contacts");
        if (legacy) {
          blk = JSON.parse(legacy);
          // Migrate to private storage
          localStorage.setItem(`infinity_blocked_contacts_${myUserId}`, JSON.stringify(blk));
        }
      }
      setBlockedList(Array.isArray(blk) ? blk : []);
    } catch (e) {
      setBlockedList([]);
    }
  };

  useEffect(() => {
    loadBlockedContacts();
  }, [myUserId]);

  // Fetch profiles of blocked users
  useEffect(() => {
    if (!blockedList.length || !db) return;
    let isMounted = true;
    setLoadingBlockedDetails(true);

    const fetchProfiles = async () => {
      const details = {};
      for (const targetId of blockedList) {
        try {
          const norm = normalizePhone(targetId);
          const docSnap = await getDoc(doc(db, "users", norm));
          if (docSnap.exists()) {
            details[targetId] = { id: targetId, ...docSnap.data() };
          } else {
            details[targetId] = { id: targetId, name: targetId, phone: targetId };
          }
        } catch (err) {
          details[targetId] = { id: targetId, name: targetId, phone: targetId };
        }
      }
      if (isMounted) {
        setBlockedUsersDetails(details);
        setLoadingBlockedDetails(false);
      }
    };

    fetchProfiles();
    return () => {
      isMounted = false;
    };
  }, [blockedList, db]);

  const handleUnblockContact = (targetId) => {
    try {
      const nextList = blockedList.filter((id) => id !== targetId);
      localStorage.setItem(
        `infinity_blocked_contacts_${myUserId}`,
        JSON.stringify(nextList)
      );
      // Synchronize legacy key as well
      localStorage.setItem("infinity_blocked_contacts", JSON.stringify(nextList));
      setBlockedList(nextList);

      const targetName =
        blockedUsersDetails[targetId]?.name || targetId;
      showToast?.(`Unblocked ${targetName}`);
    } catch (e) {
      console.error("Unblock error:", e);
    }
  };

  // -------------------------------------------------------------
  // 2. APP LOCK (PIN & Web Biometrics) (Point 10)
  // -------------------------------------------------------------
  const [appLockEnabled, setAppLockEnabled] = useState(() => {
    return localStorage.getItem(`infinity_applock_enabled_${myUserId}`) === "true";
  });
  const [appLockType, setAppLockType] = useState(() => {
    return localStorage.getItem(`infinity_applock_type_${myUserId}`) || "pin"; // 'pin' | 'biometric'
  });
  const [showAppLockPinModal, setShowAppLockPinModal] = useState(false);
  const [appLockPinInput, setAppLockPinInput] = useState("");
  const [appLockPinConfirm, setAppLockPinConfirm] = useState("");
  const [appLockPinError, setAppLockPinError] = useState("");

  const handleToggleAppLock = async () => {
    if (appLockEnabled) {
      // Disable
      localStorage.setItem(`infinity_applock_enabled_${myUserId}`, "false");
      setAppLockEnabled(false);
      showToast?.("App Lock disabled 🔓");
    } else {
      // Open PIN Setup modal
      setAppLockPinInput("");
      setAppLockPinConfirm("");
      setAppLockPinError("");
      setShowAppLockPinModal(true);
    }
  };

  const handleSaveAppLockPin = () => {
    if (appLockPinInput.length < 4 || !/^\d+$/.test(appLockPinInput)) {
      setAppLockPinError("PIN must be at least 4 numeric digits");
      return;
    }
    if (appLockPinInput !== appLockPinConfirm) {
      setAppLockPinError("PINs do not match");
      return;
    }

    localStorage.setItem(`infinity_applock_pin_${myUserId}`, appLockPinInput);
    localStorage.setItem(`infinity_applock_enabled_${myUserId}`, "true");
    localStorage.setItem(`infinity_applock_type_${myUserId}`, appLockType);
    setAppLockEnabled(true);
    setShowAppLockPinModal(false);
    showToast?.("App Lock configured and enabled 🔒");
  };

  const handleEnableBiometric = async () => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      try {
        const isAvailable =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (isAvailable) {
          localStorage.setItem(`infinity_applock_type_${myUserId}`, "biometric");
          setAppLockType("biometric");
          showToast?.("Biometric WebAuthn authentication selected");
        } else {
          showToast?.("Platform biometric sensor not available on this device");
        }
      } catch (err) {
        showToast?.("Biometric verification not supported or cancelled");
      }
    } else {
      showToast?.("Web Biometric credentials not supported in this browser");
    }
  };

  // -------------------------------------------------------------
  // 3. CHAT LOCK MANAGER (Point 10)
  // -------------------------------------------------------------
  const [lockedChatsList, setLockedChatsList] = useState(() => {
    const list = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("infinity_chatlock_pin_")) {
          const peerId = key.replace("infinity_chatlock_pin_", "");
          list.push(peerId);
        }
      }
    } catch (e) {}
    return list;
  });

  const handleRemoveChatLock = (peerId) => {
    try {
      localStorage.removeItem(`infinity_chatlock_pin_${peerId}`);
      setLockedChatsList((prev) => prev.filter((id) => id !== peerId));
      showToast?.(`Unlocked chat for ${peerId}`);
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------------------------------------------------
  // 4. PRIVACY CONTROLS (Last Seen, Profile Pic, Read Receipts)
  // -------------------------------------------------------------
  const [lastSeenVisibility, setLastSeenVisibility] = useState(() => {
    return localStorage.getItem(`infinity_privacy_last_seen_${myUserId}`) || "everyone"; // 'everyone' | 'contacts' | 'nobody'
  });
  const [profilePicVisibility, setProfilePicVisibility] = useState(() => {
    return localStorage.getItem(`infinity_privacy_profile_pic_${myUserId}`) || "everyone"; // 'everyone' | 'contacts' | 'nobody'
  });
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(() => {
    const s = localStorage.getItem(`infinity_privacy_read_receipts_${myUserId}`);
    return s === null ? true : s === "true";
  });

  const handleUpdateLastSeen = async (val) => {
    setLastSeenVisibility(val);
    localStorage.setItem(`infinity_privacy_last_seen_${myUserId}`, val);
    try {
      const myNorm = normalizePhone(currentUser.phone);
      if (myNorm && db) {
        await updateDoc(doc(db, "users", myNorm), { "privacy.lastSeen": val });
      }
    } catch (err) {
      console.warn("Firestore privacy update error:", err);
    }
    showToast?.(`Last Seen set to ${val}`);
  };

  const handleUpdateProfilePic = async (val) => {
    setProfilePicVisibility(val);
    localStorage.setItem(`infinity_privacy_profile_pic_${myUserId}`, val);
    try {
      const myNorm = normalizePhone(currentUser.phone);
      if (myNorm && db) {
        await updateDoc(doc(db, "users", myNorm), { "privacy.profilePic": val });
      }
    } catch (err) {
      console.warn("Firestore privacy update error:", err);
    }
    showToast?.(`Profile Photo visibility set to ${val}`);
  };

  const handleToggleReadReceipts = async () => {
    const next = !readReceiptsEnabled;
    setReadReceiptsEnabled(next);
    localStorage.setItem(`infinity_privacy_read_receipts_${myUserId}`, String(next));
    try {
      const myNorm = normalizePhone(currentUser.phone);
      if (myNorm && db) {
        await updateDoc(doc(db, "users", myNorm), { "privacy.readReceipts": next });
      }
    } catch (err) {
      console.warn("Firestore privacy update error:", err);
    }
    showToast?.(`Read Receipts turned ${next ? "ON" : "OFF"}`);
  };

  // Avatar Compressor to Base64
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 240;
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
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

        try {
          const myNorm = normalizePhone(currentUser.phone);
          await updateDoc(doc(db, "users", myNorm), { avatar: compressedBase64 });
          const updated = { ...currentUser, avatar: compressedBase64 };
          setCurrentUser(updated);
          localStorage.setItem("infinity_chat_user", JSON.stringify(updated));
          showToast?.("Profile photo updated!");
        } catch (err) {
          showToast?.("Failed to update avatar: " + err.message);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border }}>
        {/* Header */}
        <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {settingsTab !== "main" && (
              <button
                onClick={() => {
                  if (settingsTab === "blocked_contacts" || settingsTab === "app_lock" || settingsTab === "chat_locks") {
                    setSettingsTab("privacy");
                  } else {
                    setSettingsTab("main");
                  }
                }}
                style={styles.cleanBtn}
              >
                <span style={{ fontSize: "18px", cursor: "pointer", color: THEME.primary }}>←</span>
              </button>
            )}
            <h3 style={{ margin: 0, fontSize: "16px", color: THEME.text }}>
              {settingsTab === "main"
                ? t.settings
                : settingsTab === "privacy"
                ? t.privacySettings
                : settingsTab === "blocked_contacts"
                ? "Blocked Contacts"
                : settingsTab === "app_lock"
                ? "App Lock & Security"
                : settingsTab === "chat_locks"
                ? "Locked Chats"
                : settingsTab.toUpperCase()}
            </h3>
          </div>
          <button onClick={onClose} style={styles.cleanBtn}>
            <X size={18} color={THEME.text} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "14px", overflowY: "auto", maxHeight: "76vh" }}>
          {/* Main Menu */}
          {settingsTab === "main" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {/* Profile Card */}
              <div
                onClick={() => setSettingsTab("profile")}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card, marginBottom: "4px" }}
              >
                <img src={currentUser.avatar} alt="" style={styles.roundAvatar} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>{currentUser.name}</div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>{currentUser.phone}</div>
                </div>
                <User size={16} color={THEME.textMuted} />
              </div>

              {/* Channels Shortcut */}
              <div
                onClick={() => {
                  onClose?.();
                  onOpenChannels?.();
                }}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
              >
                <Radio size={16} color={THEME.secondary} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.channels}</span>
              </div>

              {/* Privacy & Security */}
              <div onClick={() => setSettingsTab("privacy")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Shield size={16} color={THEME.primary} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.privacySettings}</span>
                <ChevronRight size={16} color={THEME.textMuted} />
              </div>

              {/* Notifications */}
              <div onClick={() => setSettingsTab("notifications")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Bell size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.notifications}</span>
                <ChevronRight size={16} color={THEME.textMuted} />
              </div>

              {/* Bilingual Privacy Policy & Terms */}
              <div onClick={() => setSettingsTab("policy")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <FileText size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.privacyPolicy}</span>
                <ChevronRight size={16} color={THEME.textMuted} />
              </div>

              {/* Data & Storage */}
              <div onClick={() => setSettingsTab("storage")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Database size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.dataStorage}</span>
                <ChevronRight size={16} color={THEME.textMuted} />
              </div>

              {/* Language Switcher */}
              <div onClick={() => setSettingsTab("language")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Globe size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.language}</span>
                <span style={{ fontSize: "11px", color: THEME.primary, fontWeight: "600" }}>{lang === "bn" ? "বাংলা" : "English"}</span>
              </div>

              {/* Ringtones */}
              <div onClick={() => setSettingsTab("ringtones")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Volume2 size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.ringtones}</span>
                <ChevronRight size={16} color={THEME.textMuted} />
              </div>

              {/* Dark Mode Toggle */}
              <div
                onClick={() => {
                  const next = !darkMode;
                  setDarkMode(next);
                  localStorage.setItem("infinity_theme", next ? "dark" : "light");
                }}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
              >
                <Moon size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.theme}</span>
                <span style={{ fontSize: "11px", color: THEME.primary, fontWeight: "600" }}>{darkMode ? "Dark" : "Light"}</span>
              </div>

              {/* Check App Updates */}
              <div
                onClick={() => showToast?.("Infinity Chat is running latest v2.4.0")}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
              >
                <RefreshCw size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.updateCheck}</span>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>v2.4.0</span>
              </div>

              {/* Log Out */}
              <div onClick={onLogout} style={{ ...styles.settingsItem, backgroundColor: THEME.card, marginTop: "6px" }}>
                <LogOut size={16} color={THEME.danger} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.danger, fontWeight: "600" }}>{t.logOut}</span>
              </div>
            </div>
          )}

          {/* Sub-page: Profile Management */}
          {settingsTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ textAlign: "center" }}>
                <input type="file" ref={avatarUploadRef} onChange={handleAvatarFile} accept="image/*" style={{ display: "none" }} />
                <img src={currentUser.avatar} alt="" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover" }} />
                <button
                  onClick={() => avatarUploadRef.current?.click()}
                  style={{ ...styles.primaryBtn, backgroundColor: THEME.primary, marginTop: "10px", width: "auto", margin: "10px auto 0" }}
                >
                  Change Profile Photo
                </button>
              </div>
              <div>
                <label style={styles.label}>Display Name</label>
                <input
                  type="text"
                  defaultValue={currentUser.name}
                  onBlur={async (e) => {
                    const val = e.target.value.trim();
                    if (val && val !== currentUser.name) {
                      const myNorm = normalizePhone(currentUser.phone);
                      await updateDoc(doc(db, "users", myNorm), { name: val });
                      const u = { ...currentUser, name: val };
                      setCurrentUser(u);
                      localStorage.setItem("infinity_chat_user", JSON.stringify(u));
                      showToast?.("Name updated!");
                    }
                  }}
                  style={{ ...styles.bareInput, backgroundColor: THEME.card, padding: "10px", borderRadius: "8px", color: THEME.text, border: `1px solid ${THEME.border}` }}
                />
              </div>
              <div>
                <label style={styles.label}>Mobile Number</label>
                <input
                  type="text"
                  readOnly
                  value={currentUser.phone}
                  style={{ ...styles.bareInput, backgroundColor: THEME.card, padding: "10px", borderRadius: "8px", color: THEME.textMuted, border: `1px solid ${THEME.border}` }}
                />
              </div>
            </div>
          )}

          {/* Sub-page: Privacy & Security */}
          {settingsTab === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* SECTION: SECURITY & LOCKS */}
              <div style={{ fontSize: "11px", fontWeight: "700", color: THEME.primary, textTransform: "uppercase" }}>
                Security & Passcode
              </div>

              {/* App Lock Item */}
              <div
                onClick={() => setSettingsTab("app_lock")}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card, borderRadius: "8px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <Lock size={18} color={appLockEnabled ? THEME.primary : THEME.textMuted} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>App Lock</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                      {appLockEnabled
                        ? `Protected via ${appLockType === "biometric" ? "Web Biometrics" : "PIN Passcode"}`
                        : "Unlock app immediately without PIN"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: appLockEnabled ? THEME.primary : THEME.textMuted }}>
                    {appLockEnabled ? "ON" : "OFF"}
                  </span>
                  <ChevronRight size={15} color={THEME.textMuted} />
                </div>
              </div>

              {/* Chat Lock Item */}
              <div
                onClick={() => setSettingsTab("chat_locks")}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card, borderRadius: "8px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <KeyRound size={18} color={THEME.accent} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Chat Lock Manager</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                      {lockedChatsList.length} chat{lockedChatsList.length === 1 ? "" : "s"} protected with PIN
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: THEME.textMuted }}>Manage</span>
                  <ChevronRight size={15} color={THEME.textMuted} />
                </div>
              </div>

              {/* SECTION: WHO CAN SEE MY INFO */}
              <div style={{ fontSize: "11px", fontWeight: "700", color: THEME.primary, textTransform: "uppercase", marginTop: "4px" }}>
                Who Can See My Info
              </div>

              {/* Last Seen Visibility */}
              <div style={{ backgroundColor: THEME.card, padding: "12px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Last Seen & Online</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>Who can see when you were last active</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  {["everyone", "contacts", "nobody"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleUpdateLastSeen(opt)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "capitalize",
                        cursor: "pointer",
                        border: `1px solid ${lastSeenVisibility === opt ? THEME.primary : THEME.border}`,
                        backgroundColor: lastSeenVisibility === opt ? THEME.primary : "transparent",
                        color: lastSeenVisibility === opt ? "#fff" : THEME.text
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Profile Photo Visibility */}
              <div style={{ backgroundColor: THEME.card, padding: "12px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Profile Photo</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>Who can view your profile picture</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  {["everyone", "contacts", "nobody"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleUpdateProfilePic(opt)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "capitalize",
                        cursor: "pointer",
                        border: `1px solid ${profilePicVisibility === opt ? THEME.primary : THEME.border}`,
                        backgroundColor: profilePicVisibility === opt ? THEME.primary : "transparent",
                        color: profilePicVisibility === opt ? "#fff" : THEME.text
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read Receipts */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Read Receipts (Blue Ticks)</div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>If turned off, you won't send or see read receipts</div>
                </div>
                <button
                  onClick={handleToggleReadReceipts}
                  style={{ ...styles.pillBtn, backgroundColor: readReceiptsEnabled ? THEME.primary : THEME.border, color: "#fff" }}
                >
                  {readReceiptsEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {/* Ghost Mode Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Ghost Mode (Stealth)</div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>Completely conceal presence without leaving traces</div>
                </div>
                <button
                  onClick={() => setGhostMode(!ghostMode)}
                  style={{ ...styles.pillBtn, backgroundColor: ghostMode ? THEME.primary : THEME.border, color: "#fff" }}
                >
                  {ghostMode ? "ON" : "OFF"}
                </button>
              </div>

              {/* SECTION: CONTACTS PRIVACY */}
              <div style={{ fontSize: "11px", fontWeight: "700", color: THEME.primary, textTransform: "uppercase", marginTop: "4px" }}>
                Blocked Contacts
              </div>

              {/* Blocked Contacts Entry Point */}
              <div
                onClick={() => setSettingsTab("blocked_contacts")}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card, borderRadius: "8px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <UserX size={18} color={THEME.danger} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Blocked Contacts</div>
                    <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                      {blockedList.length} contact{blockedList.length === 1 ? "" : "s"} blocked by your account
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: THEME.textMuted }}>{blockedList.length}</span>
                  <ChevronRight size={15} color={THEME.textMuted} />
                </div>
              </div>
            </div>
          )}

          {/* Sub-page: PRIVATE BLOCKED CONTACTS LIST (Point 9) */}
          {settingsTab === "blocked_contacts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ padding: "8px 10px", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", border: `1px solid rgba(239, 68, 68, 0.3)`, display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} color={THEME.danger} />
                <span style={{ fontSize: "12px", color: THEME.text }}>
                  Private blocklist for <strong>{currentUser.name}</strong>. Blocked contacts cannot message or call you.
                </span>
              </div>

              {blockedList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: THEME.textMuted, fontSize: "13px" }}>
                  <UserX size={36} color={THEME.border} style={{ margin: "0 auto 10px" }} />
                  <div>No blocked contacts</div>
                  <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>
                    When you block a contact from their profile, they will appear here.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {blockedList.map((targetId) => {
                    const info = blockedUsersDetails[targetId] || {};
                    const displayName = info.name || targetId;
                    const displayPhone = info.phone || targetId;
                    const avatarUrl =
                      info.avatar ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${targetId}`;

                    return (
                      <div
                        key={targetId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          backgroundColor: THEME.card,
                          borderRadius: "10px",
                          border: `1px solid ${THEME.border}`
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <img
                            src={avatarUrl}
                            alt=""
                            style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {displayName}
                            </div>
                            <div style={{ fontSize: "11px", color: THEME.textMuted }}>{displayPhone}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnblockContact(targetId)}
                          style={{
                            ...styles.pillBtn,
                            backgroundColor: "rgba(34, 197, 94, 0.15)",
                            color: THEME.primary,
                            border: `1px solid ${THEME.primary}`,
                            padding: "6px 12px",
                            fontSize: "12px",
                            cursor: "pointer",
                            fontWeight: "600"
                          }}
                        >
                          Unblock
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-page: APP LOCK MANAGER (Point 10) */}
          {settingsTab === "app_lock" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: THEME.text }}>Enable App Lock</div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>Require passcode authentication whenever app opens</div>
                </div>
                <button
                  onClick={handleToggleAppLock}
                  style={{ ...styles.pillBtn, backgroundColor: appLockEnabled ? THEME.primary : THEME.border, color: "#fff" }}
                >
                  {appLockEnabled ? "ENABLED" : "DISABLED"}
                </button>
              </div>

              {appLockEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: THEME.textMuted, textTransform: "uppercase" }}>
                    Authentication Method
                  </div>

                  <div
                    onClick={() => {
                      localStorage.setItem(`infinity_applock_type_${myUserId}`, "pin");
                      setAppLockType("pin");
                      showToast?.("App Lock set to PIN Passcode");
                    }}
                    style={{
                      ...styles.settingsItem,
                      backgroundColor: appLockType === "pin" ? THEME.cardHover : THEME.card,
                      border: appLockType === "pin" ? `1px solid ${THEME.primary}` : "1px solid transparent",
                      borderRadius: "8px"
                    }}
                  >
                    <KeyRound size={18} color={appLockType === "pin" ? THEME.primary : THEME.textMuted} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>PIN Passcode</div>
                      <div style={{ fontSize: "11px", color: THEME.textMuted }}>Enter 4-digit code to open application</div>
                    </div>
                    {appLockType === "pin" && <Check size={16} color={THEME.primary} />}
                  </div>

                  <div
                    onClick={handleEnableBiometric}
                    style={{
                      ...styles.settingsItem,
                      backgroundColor: appLockType === "biometric" ? THEME.cardHover : THEME.card,
                      border: appLockType === "biometric" ? `1px solid ${THEME.primary}` : "1px solid transparent",
                      borderRadius: "8px"
                    }}
                  >
                    <Fingerprint size={18} color={appLockType === "biometric" ? THEME.primary : THEME.textMuted} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Web Biometric / Fingerprint</div>
                      <div style={{ fontSize: "11px", color: THEME.textMuted }}>Device hardware WebAuthn biometric sensor</div>
                    </div>
                    {appLockType === "biometric" && <Check size={16} color={THEME.primary} />}
                  </div>

                  <button
                    onClick={() => {
                      setAppLockPinInput("");
                      setAppLockPinConfirm("");
                      setAppLockPinError("");
                      setShowAppLockPinModal(true);
                    }}
                    style={{
                      ...styles.pillBtn,
                      backgroundColor: THEME.card,
                      border: `1px solid ${THEME.border}`,
                      color: THEME.text,
                      padding: "10px",
                      marginTop: "6px"
                    }}
                  >
                    Change App Lock PIN
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sub-page: CHAT LOCK MANAGER (Point 10) */}
          {settingsTab === "chat_locks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ padding: "8px 10px", backgroundColor: "rgba(0, 168, 132, 0.1)", borderRadius: "8px", border: `1px solid rgba(0, 168, 132, 0.3)` }}>
                <span style={{ fontSize: "12px", color: THEME.text }}>
                  Chats locked with an individual PIN. Tapping them requires PIN verification to read and send messages.
                </span>
              </div>

              {lockedChatsList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: THEME.textMuted, fontSize: "13px" }}>
                  <Lock size={36} color={THEME.border} style={{ margin: "0 auto 10px" }} />
                  <div>No locked chats</div>
                  <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>
                    To lock a chat, open the contact's profile in the chat header and choose "Lock Chat with PIN".
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {lockedChatsList.map((peerId) => (
                    <div
                      key={peerId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        backgroundColor: THEME.card,
                        borderRadius: "10px",
                        border: `1px solid ${THEME.border}`
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <KeyRound size={18} color={THEME.accent} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>{peerId}</div>
                          <div style={{ fontSize: "11px", color: THEME.textMuted }}>PIN Protected Chat</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveChatLock(peerId)}
                        style={{
                          ...styles.pillBtn,
                          backgroundColor: "rgba(239, 68, 68, 0.15)",
                          color: THEME.danger,
                          border: `1px solid rgba(239, 68, 68, 0.3)`,
                          padding: "6px 12px",
                          fontSize: "12px"
                        }}
                      >
                        Remove Lock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-page: Notifications */}
          {settingsTab === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <span style={{ fontSize: "13px", color: THEME.text }}>Push Notifications</span>
                <button
                  onClick={() => {
                    const next = !notificationsEnabled;
                    setNotificationsEnabled(next);
                    localStorage.setItem("infinity_notif", String(next));
                  }}
                  style={{ ...styles.pillBtn, backgroundColor: notificationsEnabled ? THEME.primary : THEME.border, color: "#fff" }}
                >
                  {notificationsEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <span style={{ fontSize: "13px", color: THEME.text }}>In-App Sounds</span>
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    localStorage.setItem("infinity_sound", String(next));
                  }}
                  style={{ ...styles.pillBtn, backgroundColor: soundEnabled ? THEME.primary : THEME.border, color: "#fff" }}
                >
                  {soundEnabled ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          )}

          {/* Sub-page: Bilingual Privacy Policy & Terms */}
          {settingsTab === "policy" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h4 style={{ margin: 0, color: THEME.text }}>{t.privacyPolicy}</h4>
                <button
                  onClick={() => {
                    const next = lang === "bn" ? "en" : "bn";
                    setLang(next);
                    localStorage.setItem("infinity_lang", next);
                  }}
                  style={{ ...styles.pillBtn, backgroundColor: THEME.card, color: THEME.primary, border: `1px solid ${THEME.border}` }}
                >
                  {lang === "bn" ? "English" : "বাংলা"}
                </button>
              </div>
              <p style={{ fontSize: "13px", lineHeight: "1.6", color: THEME.textMuted, backgroundColor: THEME.card, padding: "12px", borderRadius: "8px" }}>
                {t.termsText}
              </p>
            </div>
          )}

          {/* Sub-page: Data & Storage */}
          {settingsTab === "storage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <div style={{ fontWeight: "600", fontSize: "13px", color: THEME.text }}>Temporary App Cache</div>
                <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "2px" }}>Cached media and documents</div>
                <button
                  onClick={() => showToast?.("Cache cleared successfully!")}
                  style={{ ...styles.pillBtn, backgroundColor: THEME.primary, color: "#fff", marginTop: "8px" }}
                >
                  {t.clearCache}
                </button>
              </div>
            </div>
          )}

          {/* Sub-page: Language */}
          {settingsTab === "language" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { code: "bn", label: "বাংলা (Bengali)" },
                { code: "en", label: "English" }
              ].map((item) => (
                <div
                  key={item.code}
                  onClick={() => {
                    setLang(item.code);
                    localStorage.setItem("infinity_lang", item.code);
                    showToast?.(`Language set to ${item.label}`);
                  }}
                  style={{
                    ...styles.settingsItem,
                    backgroundColor: lang === item.code ? THEME.cardHover : THEME.card,
                    border: lang === item.code ? `1px solid ${THEME.primary}` : "1px solid transparent"
                  }}
                >
                  <Globe size={16} color={lang === item.code ? THEME.primary : THEME.textMuted} />
                  <span style={{ fontSize: "13px", color: THEME.text }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sub-page: Ringtones */}
          {settingsTab === "ringtones" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {["classic", "marimba", "chime"].map((tune) => (
                <div
                  key={tune}
                  onClick={() => {
                    setSelectedRingtone(tune);
                    showToast?.(`Ringtone set to ${tune.toUpperCase()}`);
                  }}
                  style={{
                    ...styles.settingsItem,
                    backgroundColor: selectedRingtone === tune ? THEME.cardHover : THEME.card,
                    border: selectedRingtone === tune ? `1px solid ${THEME.primary}` : "1px solid transparent"
                  }}
                >
                  <Volume2 size={16} color={selectedRingtone === tune ? THEME.primary : THEME.textMuted} />
                  <span style={{ fontSize: "13px", textTransform: "capitalize", color: THEME.text }}>{tune} Tune</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- APP LOCK PIN SETUP MODAL --- */}
      {showAppLockPinModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div style={{ ...styles.modalCard, backgroundColor: THEME.sidebar, borderColor: THEME.border, maxWidth: "340px" }}>
            <div style={{ ...styles.modalHeader, backgroundColor: THEME.header, borderColor: THEME.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Lock size={16} color={THEME.primary} />
                <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>Set App Lock PIN</span>
              </div>
              <button onClick={() => setShowAppLockPinModal(false)} style={styles.cleanBtn}>
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: THEME.textMuted, display: "block", marginBottom: "4px" }}>
                  Enter 4-digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={appLockPinInput}
                  onChange={(e) => setAppLockPinInput(e.target.value)}
                  placeholder="••••"
                  style={{
                    ...styles.bareInput,
                    backgroundColor: THEME.card,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: "8px",
                    padding: "10px",
                    textAlign: "center",
                    fontSize: "20px",
                    letterSpacing: "6px",
                    color: THEME.text
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", color: THEME.textMuted, display: "block", marginBottom: "4px" }}>
                  Confirm PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={appLockPinConfirm}
                  onChange={(e) => setAppLockPinConfirm(e.target.value)}
                  placeholder="••••"
                  style={{
                    ...styles.bareInput,
                    backgroundColor: THEME.card,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: "8px",
                    padding: "10px",
                    textAlign: "center",
                    fontSize: "20px",
                    letterSpacing: "6px",
                    color: THEME.text
                  }}
                />
              </div>

              {appLockPinError && (
                <div style={{ fontSize: "12px", color: THEME.danger, textAlign: "center" }}>
                  {appLockPinError}
                </div>
              )}

              <button
                onClick={handleSaveAppLockPin}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.primary,
                  marginTop: "6px",
                  padding: "10px"
                }}
              >
                Save & Enable App Lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
