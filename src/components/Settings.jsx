import React, { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import {
  X,
  User,
  Shield,
  Bell,
  FileText,
  Database,
  Globe,
  Volume2,
  RefreshCw,
  Moon,
  LogOut,
  Radio,
  UserCheck
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

  // Client-side Avatar Compressor using HTML5 Canvas (max 240px, 70% quality JPEG)
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
              <button onClick={() => setSettingsTab("main")} style={styles.cleanBtn}>
                <span style={{ fontSize: "16px", cursor: "pointer", color: THEME.primary }}>←</span>
              </button>
            )}
            <h3 style={{ margin: 0, fontSize: "16px", color: THEME.text }}>
              {settingsTab === "main" ? t.settings : settingsTab.toUpperCase()}
            </h3>
          </div>
          <button onClick={onClose} style={styles.cleanBtn}>
            <X size={18} color={THEME.text} />
          </button>
        </div>

        {/* Settings Body */}
        <div style={{ padding: "14px", overflowY: "auto", maxHeight: "76vh" }}>
          {/* Main Menu */}
          {settingsTab === "main" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {/* Profile Tile */}
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

              {/* Channels Navigation Shortcut */}
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
                <Shield size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.privacySettings}</span>
              </div>

              {/* Push & Sound Notifications */}
              <div onClick={() => setSettingsTab("notifications")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Bell size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.notifications}</span>
              </div>

              {/* Bilingual Privacy Policy & Terms */}
              <div onClick={() => setSettingsTab("policy")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <FileText size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.privacyPolicy}</span>
              </div>

              {/* Local Storage & Cache */}
              <div onClick={() => setSettingsTab("storage")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Database size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.dataStorage}</span>
              </div>

              {/* Language Switcher */}
              <div onClick={() => setSettingsTab("language")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Globe size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.language}</span>
                <span style={{ fontSize: "11px", color: THEME.primary, fontWeight: "600" }}>{lang === "bn" ? "বাংলা" : "English"}</span>
              </div>

              {/* Ringtones & Tones */}
              <div onClick={() => setSettingsTab("ringtones")} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <Volume2 size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.ringtones}</span>
              </div>

              {/* Dark / Light Theme Toggle */}
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

              {/* Version & Update Check */}
              <div
                onClick={() => showToast?.("Infinity Chat is running latest v2.4.0")}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card }}
              >
                <RefreshCw size={16} color={THEME.textMuted} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.text }}>{t.updateCheck}</span>
                <span style={{ fontSize: "11px", color: THEME.textMuted }}>v2.4.0</span>
              </div>

              {/* Switch Account */}
              <div
                onClick={() => {
                  if (window.confirm("Switch account? You will be returned to the mobile login screen.")) {
                    onLogout();
                  }
                }}
                style={{ ...styles.settingsItem, backgroundColor: THEME.card, marginTop: "4px" }}
              >
                <UserCheck size={16} color={THEME.secondary} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.secondary, fontWeight: "600" }}>{t.switchAccount}</span>
              </div>

              {/* Log Out */}
              <div onClick={onLogout} style={{ ...styles.settingsItem, backgroundColor: THEME.card }}>
                <LogOut size={16} color={THEME.danger} />
                <span style={{ flex: 1, fontSize: "13px", color: THEME.danger, fontWeight: "600" }}>{t.logOut}</span>
              </div>
            </div>
          )}

          {/* Sub-page: Profile */}
          {settingsTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ textAlign: "center" }}>
                <input type="file" ref={avatarUploadRef} onChange={handleAvatarFile} accept="image/*" style={{ display: "none" }} />
                <img src={currentUser.avatar} alt="" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", margin: "0 auto", border: `2px solid ${THEME.primary}` }} />
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

          {/* Sub-page: Privacy & Ghost Mode */}
          {settingsTab === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: THEME.text }}>Ghost Mode (Hide Online Status)</div>
                  <div style={{ fontSize: "11px", color: THEME.textMuted }}>Don't display your active presence to contacts</div>
                </div>
                <button
                  onClick={() => setGhostMode(!ghostMode)}
                  style={{ ...styles.pillBtn, backgroundColor: ghostMode ? THEME.primary : THEME.border, color: "#fff" }}
                >
                  {ghostMode ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          )}

          {/* Sub-page: Notifications */}
          {settingsTab === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: THEME.card, borderRadius: "8px" }}>
                <span style={{ fontSize: "13px", color: THEME.text }}>In-App Sound FX</span>
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
                  {lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
                </button>
              </div>
              <div style={{ fontSize: "13px", lineHeight: "1.6", color: THEME.textMuted, backgroundColor: THEME.card, padding: "14px", borderRadius: "8px", border: `1px solid ${THEME.border}` }}>
                {t.termsText}
              </div>
            </div>
          )}

          {/* Sub-page: Data & Storage */}
          {settingsTab === "storage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ padding: "14px", backgroundColor: THEME.card, borderRadius: "8px", border: `1px solid ${THEME.border}` }}>
                <div style={{ fontWeight: "600", fontSize: "13px", color: THEME.text }}>Local Cache & Temporary Storage</div>
                <div style={{ fontSize: "11px", color: THEME.textMuted, marginTop: "2px" }}>Cached images, voice notes, and media previews</div>
                <button
                  onClick={() => showToast?.("Local cache cleared successfully!")}
                  style={{ ...styles.pillBtn, backgroundColor: THEME.primary, color: "#fff", marginTop: "10px" }}
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
    </div>
  );
}
