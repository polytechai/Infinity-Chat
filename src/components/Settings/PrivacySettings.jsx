import React, { useState, useEffect } from "react";
import {
  Lock,
  Unlock,
  Shield,
  Fingerprint,
  Eye,
  CheckCheck,
  UserX,
  KeyRound,
  X,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  setDoc
} from "firebase/firestore";
import { db, styles, normalizePhone } from "../../firebase";

const VISIBILITY_OPTIONS = [
  { label: "Everyone", value: "everyone" },
  { label: "My Contacts", value: "contacts" },
  { label: "Nobody", value: "nobody" }
];

export default function PrivacySettings({
  currentUser = {},
  onClose,
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

  // -------------------------------------------------------------
  // 1. APP LOCK WITH 4-DIGIT PIN & BIOMETRICS (Point 10)
  // -------------------------------------------------------------
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(() => {
    try {
      return !!localStorage.getItem(`infinity_applock_pin_${myUserId}`);
    } catch (e) {
      return false;
    }
  });
  const [useBiometrics, setUseBiometrics] = useState(() => {
    try {
      return localStorage.getItem(`infinity_applock_biometrics_${myUserId}`) === "true";
    } catch (e) {
      return false;
    }
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirmInput, setPinConfirmInput] = useState("");
  const [pinError, setPinError] = useState("");

  const handleToggleAppLock = () => {
    if (isAppLockEnabled) {
      // Disable App Lock
      localStorage.removeItem(`infinity_applock_pin_${myUserId}`);
      localStorage.removeItem(`infinity_applock_biometrics_${myUserId}`);
      setIsAppLockEnabled(false);
      setUseBiometrics(false);
      if (showToast) showToast("App Lock disabled");
    } else {
      // Open PIN Creation Modal
      setPinInput("");
      setPinConfirmInput("");
      setPinError("");
      setShowPinModal(true);
    }
  };

  const handleSavePin = () => {
    if (pinInput.length < 4) {
      setPinError("PIN must be 4 to 6 digits");
      return;
    }
    if (pinInput !== pinConfirmInput) {
      setPinError("PIN codes do not match");
      return;
    }

    localStorage.setItem(`infinity_applock_pin_${myUserId}`, pinInput);
    setIsAppLockEnabled(true);
    setShowPinModal(false);
    if (showToast) showToast("App Lock enabled with PIN passcode 🔒");
  };

  const handleToggleBiometrics = async () => {
    if (!isAppLockEnabled) {
      if (showToast) showToast("Enable PIN passcode first to activate Biometrics");
      return;
    }

    const next = !useBiometrics;
    if (next) {
      // Test WebAuthn / Biometrics capability
      if (window.PublicKeyCredential) {
        try {
          const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (isAvailable) {
            setUseBiometrics(true);
            localStorage.setItem(`infinity_applock_biometrics_${myUserId}`, "true");
            if (showToast) showToast("Biometric authentication enabled");
          } else {
            if (showToast) showToast("Biometric sensor not available on this device");
          }
        } catch (e) {
          setUseBiometrics(true);
          localStorage.setItem(`infinity_applock_biometrics_${myUserId}`, "true");
          if (showToast) showToast("Biometric authentication enabled");
        }
      } else {
        if (showToast) showToast("Biometrics not supported by this browser");
      }
    } else {
      setUseBiometrics(false);
      localStorage.setItem(`infinity_applock_biometrics_${myUserId}`, "false");
      if (showToast) showToast("Biometrics disabled");
    }
  };

  // -------------------------------------------------------------
  // 2. PRIVATE BLOCKLIST (Point 9)
  // Fetch and display ONLY contacts blocked by currentUser.uid
  // -------------------------------------------------------------
  const [blockedContacts, setBlockedContacts] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  useEffect(() => {
    if (!myUserId || !db) {
      setLoadingBlocks(false);
      return;
    }

    setLoadingBlocks(true);
    const blocksQuery = query(
      collection(db, "blocked_users"),
      where("blockerId", "==", myUserId)
    );

    const unsubscribe = onSnapshot(
      blocksQuery,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            blockedUserId: data.blockedUserId || docSnap.id,
            name: data.name || data.blockedUserName || data.blockedUserId || "Blocked User",
            phone: data.phone || data.blockedPhone || "",
            avatar:
              data.avatar ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${data.blockedUserId || docSnap.id}`,
            blockedAt: data.createdAt
          });
        });
        setBlockedContacts(list);
        setLoadingBlocks(false);
      },
      (err) => {
        console.warn("Blocked contacts query error:", err);
        setLoadingBlocks(false);
      }
    );

    return () => unsubscribe();
  }, [myUserId]);

  const handleUnblock = async (blockItem) => {
    if (!db || !blockItem?.id) return;
    try {
      await deleteDoc(doc(db, "blocked_users", blockItem.id));
      if (showToast) showToast(`Unblocked ${blockItem.name}`);
    } catch (err) {
      console.warn("Error unblocking user:", err);
      if (showToast) showToast("Failed to unblock: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // 3. PRIVACY VISIBILITY CONTROLS (Point 10)
  // Last Seen, Profile Picture, Read Receipts (Blue Ticks)
  // -------------------------------------------------------------
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState(() => {
    return localStorage.getItem(`infinity_privacy_last_seen_${myUserId}`) || "everyone";
  });

  const [profilePhotoPrivacy, setProfilePhotoPrivacy] = useState(() => {
    return localStorage.getItem(`infinity_privacy_photo_${myUserId}`) || "everyone";
  });

  const [readReceipts, setReadReceipts] = useState(() => {
    return localStorage.getItem(`infinity_privacy_read_receipts_${myUserId}`) !== "false";
  });

  const handleUpdateLastSeen = (val) => {
    setLastSeenPrivacy(val);
    localStorage.setItem(`infinity_privacy_last_seen_${myUserId}`, val);
    if (db && myUserId) {
      updateDoc(doc(db, "users", myUserId), { "privacy.lastSeen": val }).catch(() => {});
    }
    if (showToast) showToast("Last seen visibility updated");
  };

  const handleUpdateProfilePhoto = (val) => {
    setProfilePhotoPrivacy(val);
    localStorage.setItem(`infinity_privacy_photo_${myUserId}`, val);
    if (db && myUserId) {
      updateDoc(doc(db, "users", myUserId), { "privacy.profilePhoto": val }).catch(() => {});
    }
    if (showToast) showToast("Profile photo visibility updated");
  };

  const handleToggleReadReceipts = () => {
    const next = !readReceipts;
    setReadReceipts(next);
    localStorage.setItem(`infinity_privacy_read_receipts_${myUserId}`, String(next));
    if (db && myUserId) {
      updateDoc(doc(db, "users", myUserId), { "privacy.readReceipts": next }).catch(() => {});
    }
    if (showToast) showToast(next ? "Read receipts enabled (Blue ticks)" : "Read receipts disabled");
  };

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 5000 }}>
      <div
        style={{
          ...styles.modalCard,
          backgroundColor: THEME.sidebar,
          borderColor: THEME.border,
          maxWidth: "440px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden"
        }}
      >
        {/* --- HEADER --- */}
        <div
          style={{
            ...styles.modalHeader,
            backgroundColor: THEME.header,
            borderColor: THEME.border,
            padding: "14px 16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Shield size={18} color={THEME.primary} />
            <span style={{ fontWeight: "700", fontSize: "16px", color: THEME.text }}>
              Privacy & Security
            </span>
          </div>
          <button onClick={onClose} style={styles.cleanBtn}>
            <X size={18} color={THEME.textMuted} />
          </button>
        </div>

        {/* --- SCROLLABLE SETTINGS BODY --- */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}
        >
          {/* ------------------------------------------------------------- */}
          {/* 1. APP LOCK WITH 4-DIGIT PIN / BIOMETRICS (Point 10) */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                fontSize: "12px",
                fontWeight: "700",
                color: THEME.textMuted,
                textTransform: "uppercase"
              }}
            >
              App Security
            </div>

            {/* App Lock with PIN Toggle */}
            <div
              onClick={handleToggleAppLock}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                cursor: "pointer",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isAppLockEnabled ? (
                  <Lock size={18} color={THEME.accent} />
                ) : (
                  <Unlock size={18} color={THEME.textMuted} />
                )}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                    App Lock
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    {isAppLockEnabled
                      ? "Protected with PIN passcode on launch"
                      : "Require PIN passcode to open Infinity Chat"}
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={isAppLockEnabled}
                readOnly
                style={{ accentColor: THEME.accent }}
              />
            </div>

            {/* Biometric Prompt Toggle */}
            <div
              onClick={handleToggleBiometrics}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                cursor: isAppLockEnabled ? "pointer" : "not-allowed",
                opacity: isAppLockEnabled ? 1 : 0.5
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Fingerprint size={18} color={useBiometrics ? THEME.primary : THEME.textMuted} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                    Unlock with Biometrics
                  </div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                    Use Touch ID / Face recognition
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={useBiometrics}
                readOnly
                disabled={!isAppLockEnabled}
                style={{ accentColor: THEME.primary }}
              />
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 3. PRIVACY CONTROL VISIBILITY TOGGLES (Point 10) */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                fontSize: "12px",
                fontWeight: "700",
                color: THEME.textMuted,
                textTransform: "uppercase"
              }}
            >
              Privacy & Visibility
            </div>

            {/* Last Seen Dropdown */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                  Last Seen & Online
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  Who can see when you were last online
                </div>
              </div>

              <select
                value={lastSeenPrivacy}
                onChange={(e) => handleUpdateLastSeen(e.target.value)}
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.sidebar,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "6px",
                  padding: "6px 8px",
                  color: THEME.text,
                  fontSize: "12px"
                }}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Photo Visibility */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: `1px solid ${THEME.border}`
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                  Profile Photo
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  Who can view your profile picture
                </div>
              </div>

              <select
                value={profilePhotoPrivacy}
                onChange={(e) => handleUpdateProfilePhoto(e.target.value)}
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.sidebar,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "6px",
                  padding: "6px 8px",
                  color: THEME.text,
                  fontSize: "12px"
                }}
              >
                {VISIBILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Read Receipts (Blue Ticks) Toggle */}
            <div
              onClick={handleToggleReadReceipts}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                cursor: "pointer"
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>
                  Read Receipts
                </div>
                <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                  Show blue checkmarks when messages are seen
                </div>
              </div>

              <input
                type="checkbox"
                checked={readReceipts}
                readOnly
                style={{ accentColor: THEME.primary }}
              />
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 2. PRIVATE BLOCKLIST (Point 9) */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              backgroundColor: THEME.card,
              borderRadius: "10px",
              border: `1px solid ${THEME.border}`,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${THEME.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: THEME.textMuted,
                  textTransform: "uppercase"
                }}
              >
                Blocked Contacts
              </span>
              <span style={{ fontSize: "11px", color: THEME.primary, fontWeight: "700" }}>
                {blockedContacts.length}
              </span>
            </div>

            <div style={{ padding: "8px" }}>
              {loadingBlocks ? (
                <div style={{ textAlign: "center", padding: "16px", color: THEME.textMuted, fontSize: "12px" }}>
                  Loading blocklist...
                </div>
              ) : blockedContacts.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 10px",
                    color: THEME.textMuted,
                    fontSize: "12px"
                  }}
                >
                  <UserX size={24} style={{ margin: "0 auto 6px", opacity: 0.6 }} />
                  No blocked contacts. You have not blocked anyone.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {blockedContacts.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        backgroundColor: THEME.sidebar
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <img
                          src={item.avatar}
                          alt=""
                          style={{ width: "34px", height: "34px", borderRadius: "50%" }}
                        />
                        <div style={{ minWidth: 0 }}>
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
                            {item.name}
                          </div>
                          <div style={{ fontSize: "11px", color: THEME.textMuted }}>
                            {item.phone || item.blockedUserId}
                          </div>
                        </div>
                      </div>

                      {/* Instant Unblock Button */}
                      <button
                        onClick={() => handleUnblock(item)}
                        style={{
                          ...styles.pillBtn,
                          backgroundColor: "rgba(239, 68, 68, 0.12)",
                          border: `1px solid ${THEME.danger}`,
                          color: THEME.danger,
                          padding: "4px 10px",
                          fontSize: "11px",
                          cursor: "pointer",
                          borderRadius: "14px"
                        }}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- PIN SETUP MODAL --- */}
      {showPinModal && (
        <div style={{ ...styles.modalOverlay, zIndex: 6000 }}>
          <div
            style={{
              ...styles.modalCard,
              backgroundColor: THEME.sidebar,
              borderColor: THEME.border,
              maxWidth: "320px",
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={16} color={THEME.accent} />
                <span style={{ fontWeight: "700", fontSize: "14px", color: THEME.text }}>
                  Set App Lock PIN
                </span>
              </div>
              <button onClick={() => setShowPinModal(false)} style={styles.cleanBtn}>
                <X size={16} color={THEME.textMuted} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-digit PIN"
                autoFocus
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  textAlign: "center",
                  fontSize: "18px",
                  color: THEME.text,
                  letterSpacing: "4px"
                }}
              />

              <input
                type="password"
                maxLength={6}
                value={pinConfirmInput}
                onChange={(e) => setPinConfirmInput(e.target.value)}
                placeholder="Confirm PIN"
                style={{
                  ...styles.bareInput,
                  backgroundColor: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: "8px",
                  padding: "10px",
                  textAlign: "center",
                  fontSize: "18px",
                  color: THEME.text,
                  letterSpacing: "4px"
                }}
              />

              {pinError && (
                <div style={{ fontSize: "12px", color: THEME.danger, textAlign: "center" }}>
                  {pinError}
                </div>
              )}

              <button
                onClick={handleSavePin}
                style={{
                  ...styles.primaryBtn,
                  backgroundColor: THEME.accent,
                  padding: "10px",
                  marginTop: "4px"
                }}
              >
                Enable App Lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
