import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  Crop,
  Paintbrush,
  Check,
  Undo2,
  Sliders,
  Sparkles,
  Video,
  Image as ImageIcon,
  RotateCw,
  Trash2
} from "lucide-react";
import { styles } from "../../firebase";

const BRUSH_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#ffffff", "#000000"];
const STROKE_SIZES = [3, 6, 12];

export default function MediaPreviewModal({
  pendingMedia,
  media,
  onClose,
  onSend,
  onSendMedia,
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
  const currentMedia = pendingMedia || media;
  if (!currentMedia) return null;

  const fileType = currentMedia.fileType || currentMedia.type || "image";
  const rawUrl = currentMedia.rawDataUrl || currentMedia.fileUrl || currentMedia.url || "";
  const isImage = fileType === "image" || fileType.startsWith("image/");
  const isVideo = fileType === "video" || fileType.startsWith("video/");

  // State Management
  const [caption, setCaption] = useState(currentMedia.caption || "");
  const [isHD, setIsHD] = useState(false); // HD Toggle switch: Standard vs High Definition
  const [activeTool, setActiveTool] = useState(null); // null | "crop" | "brush"

  // Brush drawing states
  const [brushColor, setBrushColor] = useState("#22c55e");
  const [brushSize, setBrushSize] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);

  // Crop box selection state (relative percentages)
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropDragStart, setCropDragStart] = useState({ x: 0, y: 0 });

  // Canvas Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const baseImageRef = useRef(null);

  // Initialize and load image onto canvas
  useEffect(() => {
    if (!isImage || !rawUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      baseImageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Save initial state to history
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    };
    img.src = rawUrl;
  }, [isImage, rawUrl]);

  // -------------------------------------------------------------
  // BRUSH DRAWING HANDLERS
  // -------------------------------------------------------------
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDraw = (e) => {
    if (activeTool !== "brush") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawing(true);
  };

  const drawMove = (e) => {
    if (!isDrawing || activeTool !== "brush") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing || activeTool !== "brush") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.closePath();
    setIsDrawing(false);

    // Push new snapshot to history
    setHistory((prev) => [
      ...prev,
      ctx.getImageData(0, 0, canvas.width, canvas.height)
    ]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const newHistory = history.slice(0, -1);
    const lastState = newHistory[newHistory.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setHistory(newHistory);
  };

  // -------------------------------------------------------------
  // CANVAS CROP HANDLERS
  // -------------------------------------------------------------
  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const cropX = Math.round((cropBox.x / 100) * canvas.width);
    const cropY = Math.round((cropBox.y / 100) * canvas.height);
    const cropW = Math.round((cropBox.width / 100) * canvas.width);
    const cropH = Math.round((cropBox.height / 100) * canvas.height);

    if (cropW <= 0 || cropH <= 0) return;

    const croppedImageData = ctx.getImageData(cropX, cropY, cropW, cropH);
    canvas.width = cropW;
    canvas.height = cropH;
    ctx.putImageData(croppedImageData, 0, 0);

    setHistory([croppedImageData]);
    setActiveTool(null);
    setCropBox({ x: 10, y: 10, width: 80, height: 80 });

    if (showToast) showToast("Image cropped");
  };

  // -------------------------------------------------------------
  // SEND FINAL MEDIA WITH HD QUALITY & CAPTION
  // -------------------------------------------------------------
  const handleSendFinal = () => {
    let finalUrl = rawUrl;

    if (isImage && canvasRef.current) {
      // Standard compression (0.7) vs HD full quality (0.95)
      const quality = isHD ? 0.95 : 0.72;
      finalUrl = canvasRef.current.toDataURL("image/jpeg", quality);
    }

    const payload = {
      ...currentMedia,
      fileUrl: finalUrl,
      rawDataUrl: finalUrl,
      caption: caption.trim(),
      isHD,
      type: fileType
    };

    if (onSendMedia) {
      onSendMedia(payload);
    } else if (onSend) {
      onSend(payload);
    }

    onClose?.();
  };

  return (
    <div
      style={{
        ...styles.modalOverlay,
        zIndex: 9000,
        backgroundColor: "rgba(5, 10, 14, 0.96)",
        padding: 0
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative"
        }}
      >
        {/* --- TOP TOOLBAR --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            backgroundColor: "rgba(17, 27, 33, 0.8)",
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${THEME.border}`,
            zIndex: 20
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{ ...styles.cleanBtn, color: THEME.text, padding: "6px" }}
            title="Cancel"
          >
            <X size={22} />
          </button>

          {/* EDIT TOOLS (Only for images) */}
          {isImage && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* HD TOGGLE SWITCH */}
              <button
                onClick={() => {
                  const next = !isHD;
                  setIsHD(next);
                  if (showToast) showToast(next ? "HD Quality enabled" : "Standard Quality");
                }}
                style={{
                  ...styles.pillBtn,
                  backgroundColor: isHD ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.1)",
                  border: `1.5px solid ${isHD ? THEME.primary : THEME.textMuted}`,
                  color: isHD ? THEME.primary : THEME.textMuted,
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
                title="Toggle High Definition Quality"
              >
                <span>HD</span>
                {isHD && <Check size={12} />}
              </button>

              {/* Crop Tool Button */}
              <button
                onClick={() => setActiveTool(activeTool === "crop" ? null : "crop")}
                style={{
                  ...styles.cleanBtn,
                  color: activeTool === "crop" ? THEME.primary : THEME.text,
                  backgroundColor: activeTool === "crop" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                  padding: "6px",
                  borderRadius: "50%"
                }}
                title="Crop Image"
              >
                <Crop size={20} />
              </button>

              {/* Brush Tool Button */}
              <button
                onClick={() => setActiveTool(activeTool === "brush" ? null : "brush")}
                style={{
                  ...styles.cleanBtn,
                  color: activeTool === "brush" ? THEME.primary : THEME.text,
                  backgroundColor: activeTool === "brush" ? "rgba(34, 197, 94, 0.15)" : "transparent",
                  padding: "6px",
                  borderRadius: "50%"
                }}
                title="Drawing Brush"
              >
                <Paintbrush size={20} />
              </button>

              {/* Undo Button */}
              {history.length > 1 && (
                <button
                  onClick={handleUndo}
                  style={{ ...styles.cleanBtn, color: THEME.text, padding: "6px" }}
                  title="Undo Last Action"
                >
                  <Undo2 size={20} />
                </button>
              )}
            </div>
          )}

          <div style={{ width: "22px" }} />
        </div>

        {/* --- BRUSH COLOR & SIZE SUB-BAR --- */}
        {activeTool === "brush" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              padding: "8px 14px",
              backgroundColor: "rgba(32, 44, 51, 0.95)",
              borderBottom: `1px solid ${THEME.border}`,
              zIndex: 15
            }}
          >
            {/* Color Palette */}
            <div style={{ display: "flex", gap: "8px" }}>
              {BRUSH_COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => setBrushColor(c)}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    backgroundColor: c,
                    border: brushColor === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    transform: brushColor === c ? "scale(1.2)" : "scale(1)",
                    transition: "transform 0.1s ease"
                  }}
                />
              ))}
            </div>

            <div style={{ width: "1px", height: "18px", backgroundColor: THEME.border }} />

            {/* Stroke Thickness */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {STROKE_SIZES.map((size) => (
                <div
                  key={size}
                  onClick={() => setBrushSize(size)}
                  style={{
                    width: `${size + 14}px`,
                    height: `${size + 14}px`,
                    borderRadius: "50%",
                    backgroundColor: brushSize === size ? THEME.primary : "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  <div
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: "50%",
                      backgroundColor: "#fff"
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- CROP CONTROLS SUB-BAR --- */}
        {activeTool === "crop" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "14px",
              padding: "8px 14px",
              backgroundColor: "rgba(32, 44, 51, 0.95)",
              borderBottom: `1px solid ${THEME.border}`,
              zIndex: 15
            }}
          >
            <span style={{ fontSize: "12px", color: THEME.textMuted }}>
              Adjust crop area and confirm:
            </span>
            <button
              onClick={applyCrop}
              style={{
                ...styles.pillBtn,
                backgroundColor: THEME.primary,
                color: "#fff",
                padding: "4px 14px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px"
              }}
            >
              <Check size={14} />
              <span>Apply Crop</span>
            </button>
          </div>
        )}

        {/* --- MAIN PREVIEW & CANVAS WORKSPACE --- */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "16px",
            userSelect: "none",
            touchAction: activeTool === "brush" ? "none" : "auto"
          }}
        >
          {isVideo ? (
            /* HTML5 VIDEO PREVIEW */
            <video
              src={rawUrl}
              controls
              playsInline
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                borderRadius: "12px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.6)"
              }}
            />
          ) : isImage ? (
            /* INTERACTIVE CANVAS FOR IMAGE EDITING */
            <div style={{ position: "relative", display: "inline-block" }}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={drawMove}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={drawMove}
                onTouchEnd={stopDraw}
                style={{
                  maxWidth: "100%",
                  maxHeight: "72vh",
                  objectFit: "contain",
                  borderRadius: "8px",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                  cursor: activeTool === "brush" ? "crosshair" : "default"
                }}
              />

              {/* CROP OVERLAY BOUNDING BOX */}
              {activeTool === "crop" && (
                <div
                  style={{
                    position: "absolute",
                    top: `${cropBox.y}%`,
                    left: `${cropBox.x}%`,
                    width: `${cropBox.width}%`,
                    height: `${cropBox.height}%`,
                    border: `2px dashed ${THEME.primary}`,
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                    pointerEvents: "none"
                  }}
                />
              )}
            </div>
          ) : (
            /* DOCUMENT / FILE PREVIEW */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                color: THEME.text
              }}
            >
              <ImageIcon size={64} color={THEME.primary} />
              <div style={{ fontSize: "14px", fontWeight: "600" }}>
                {currentMedia.fileName || "Selected Attachment"}
              </div>
            </div>
          )}
        </div>

        {/* --- BOTTOM CAPTION INPUT & SEND BUTTON --- */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "rgba(17, 27, 33, 0.9)",
            backdropFilter: "blur(10px)",
            borderTop: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 20
          }}
        >
          {/* Caption Input Box */}
          <div
            style={{
              flex: 1,
              backgroundColor: THEME.card,
              borderRadius: "24px",
              padding: "8px 16px",
              border: `1px solid ${THEME.border}`,
              display: "flex",
              alignItems: "center"
            }}
          >
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendFinal();
              }}
              style={{
                ...styles.bareInput,
                color: THEME.text,
                fontSize: "14px",
                width: "100%"
              }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendFinal}
            style={{
              ...styles.primaryBtn,
              backgroundColor: THEME.primary,
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(34, 197, 94, 0.4)",
              flexShrink: 0
            }}
            title="Send"
          >
            <Send size={20} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
