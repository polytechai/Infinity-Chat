import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  RotateCw,
  Crop,
  Palette,
  Sparkles,
  Check,
  Undo2,
  Trash2,
  FileText,
  Video,
  Image as ImageIcon,
  Eye,
  Sliders,
  RefreshCw,
  Maximize2
} from "lucide-react";
import { styles } from "../../firebase";

/**
 * MediaPreviewModal
 * Comprehensive media preview and canvas editing modal before sending attachments.
 * Supports:
 * - Preview for Images, Videos, and Documents
 * - Canvas Image Editing: Crop (with aspect ratios), Freehand Brush with color & stroke size, Rotate 90°, Undo
 * - HD Quality toggle (high resolution vs compressed standard)
 * - Caption input and View-Once support
 */
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
  viewOnceMode = false,
  onToggleViewOnce,
  showToast
}) {
  // Support both pendingMedia and media prop name
  const currentMedia = pendingMedia || media;

  if (!currentMedia) return null;

  const fileType = currentMedia.fileType || currentMedia.type || "image";
  const rawUrl = currentMedia.rawDataUrl || currentMedia.fileUrl || currentMedia.url || "";
  const fileName = currentMedia.fileName || currentMedia.name || "Attachment";
  const fileSize = currentMedia.fileSize || currentMedia.size || "";

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const [caption, setCaption] = useState(currentMedia.caption || "");
  const [isHD, setIsHD] = useState(!!currentMedia.isHD);
  const [isViewOnce, setIsViewOnce] = useState(!!viewOnceMode);

  // Image editing states
  const [rotation, setRotation] = useState(0);
  const [isBrushActive, setIsBrushActive] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(6);
  const [isCropping, setIsCropping] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState("free"); // "free" | "1:1" | "4:3" | "16:9"

  // Drawing undo history
  const [drawingHistory, setDrawingHistory] = useState([]);

  // Canvas and interaction refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const baseImageRef = useRef(null);

  // Crop overlay box state (normalized coordinates 0 to 1)
  const [cropBox, setCropBox] = useState({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });

  // Palette colors for brush tool
  const BRUSH_COLORS = [
    "#ffffff",
    "#ef4444",
    "#22c55e",
    "#38bdf8",
    "#facc15",
    "#a855f7",
    "#ec4899",
    "#000000"
  ];

  // -------------------------------------------------------------
  // INITIALIZE IMAGE & CANVAS
  // -------------------------------------------------------------
  useEffect(() => {
    if (fileType !== "image" || !rawUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = rawUrl;
    img.onload = () => {
      baseImageRef.current = img;
      renderBaseCanvas(img, rotation);
    };
  }, [rawUrl, fileType]);

  // Re-render canvas on rotation change (preserving base image)
  const renderBaseCanvas = useCallback(
    (imgObj, rotDeg) => {
      const canvas = canvasRef.current;
      if (!canvas || !imgObj) return;
      const ctx = canvas.getContext("2d");

      const isSideways = rotDeg % 180 !== 0;
      const srcW = isSideways ? imgObj.naturalHeight || imgObj.height : imgObj.naturalWidth || imgObj.width;
      const srcH = isSideways ? imgObj.naturalWidth || imgObj.width : imgObj.naturalHeight || imgObj.height;

      // Fit within max dimensions for smooth interactive preview
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
      canvas.width = Math.round(srcW * scale);
      canvas.height = Math.round(srcH * scale);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotDeg * Math.PI) / 180);
      const drawW = isSideways ? canvas.height : canvas.width;
      const drawH = isSideways ? canvas.width : canvas.height;
      ctx.drawImage(imgObj, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Record canvas state
      saveCanvasState();
    },
    []
  );

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL();
      setDrawingHistory((prev) => [...prev.slice(-15), dataUrl]);
    } catch (e) {
      // ignore
    }
  };

  // Rotate image by 90 degrees
  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    if (baseImageRef.current) {
      renderBaseCanvas(baseImageRef.current, nextRot);
    }
  };

  // Undo last brush stroke
  const handleUndo = () => {
    if (drawingHistory.length <= 1) return;
    const previous = drawingHistory[drawingHistory.length - 2];
    const canvas = canvasRef.current;
    if (!canvas || !previous) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = previous;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setDrawingHistory((prev) => prev.slice(0, -1));
    };
  };

  // -------------------------------------------------------------
  // BRUSH TOOL HANDLERS
  // -------------------------------------------------------------
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (!isBrushActive || isCropping || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !isBrushActive || isCropping || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    saveCanvasState();
  };

  // -------------------------------------------------------------
  // CROP TOOL LOGIC
  // -------------------------------------------------------------
  const handleToggleCrop = () => {
    if (!isCropping) {
      setIsBrushActive(false);
      setIsCropping(true);
      setCropBox({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    } else {
      setIsCropping(false);
    }
  };

  const handleApplyAspectRatio = (ratioKey) => {
    setCropAspectRatio(ratioKey);
    let ratio = null;
    if (ratioKey === "1:1") ratio = 1;
    else if (ratioKey === "4:3") ratio = 4 / 3;
    else if (ratioKey === "16:9") ratio = 16 / 9;

    if (!ratio) {
      setCropBox({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      return;
    }

    // Adjust crop box to ratio based on canvas aspect ratio
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasAspect = canvas.width / canvas.height;

    let w = 0.8;
    let h = (w * canvasAspect) / ratio;
    if (h > 0.8) {
      h = 0.8;
      w = (h * ratio) / canvasAspect;
    }

    setCropBox({
      x: Math.max(0.05, (1 - w) / 2),
      y: Math.max(0.05, (1 - h) / 2),
      width: Math.min(0.9, w),
      height: Math.min(0.9, h)
    });
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cropX = Math.max(0, Math.floor(cropBox.x * canvas.width));
    const cropY = Math.max(0, Math.floor(cropBox.y * canvas.height));
    const cropW = Math.min(canvas.width - cropX, Math.floor(cropBox.width * canvas.width));
    const cropH = Math.min(canvas.height - cropY, Math.floor(cropBox.height * canvas.height));

    if (cropW <= 10 || cropH <= 10) {
      if (showToast) showToast("Crop selection too small");
      return;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext("2d");

    tempCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const croppedDataUrl = tempCanvas.toDataURL();
    const croppedImg = new Image();
    croppedImg.crossOrigin = "anonymous";
    croppedImg.src = croppedDataUrl;
    croppedImg.onload = () => {
      baseImageRef.current = croppedImg;
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(croppedImg, 0, 0);
      setIsCropping(false);
      setDrawingHistory([croppedDataUrl]);
      if (showToast) showToast("Image cropped successfully");
    };
  };

  // -------------------------------------------------------------
  // SEND FINAL MEDIA HANDLER
  // -------------------------------------------------------------
  const handleSend = () => {
    let finalUrl = rawUrl;

    if (fileType === "image" && canvasRef.current) {
      // Export with HD quality (0.98) or Standard compression (0.75)
      finalUrl = canvasRef.current.toDataURL(
        "image/jpeg",
        isHD ? 0.98 : 0.75
      );
    }

    const payload = {
      ...currentMedia,
      type: fileType,
      fileUrl: finalUrl,
      rawDataUrl: finalUrl,
      fileName: fileName,
      fileSize: fileSize,
      caption: caption.trim(),
      content: caption.trim() || (fileType === "image" ? "Photo" : fileType === "video" ? "Video" : fileName),
      isHD: !!isHD,
      isViewOnce: !!isViewOnce
    };

    if (onSend) {
      onSend(payload);
    } else if (onSendMedia) {
      onSendMedia(payload);
    }

    if (showToast) {
      showToast(`${isHD ? "HD " : ""}${fileType === "image" ? "Photo" : fileType === "video" ? "Video" : "Document"} sent!`);
    }

    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        ...styles.modalOverlay,
        zIndex: 5000,
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: THEME.sidebar,
          border: `1px solid ${THEME.border}`,
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9)",
          color: THEME.text
        }}
      >
        {/* --- HEADER: TITLE, HD TOGGLE & TOOLS --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            backgroundColor: THEME.header,
            borderBottom: `1px solid ${THEME.border}`
          }}
        >
          {/* Left: Close & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...styles.cleanBtn,
                color: THEME.textMuted,
                padding: "6px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Cancel"
            >
              <X size={20} />
            </button>
            <span style={{ fontWeight: "700", fontSize: "15px", color: THEME.text }}>
              {fileType === "image"
                ? "Edit Photo"
                : fileType === "video"
                ? "Preview Video"
                : "Document Preview"}
            </span>
          </div>

          {/* Right: Controls (HD Toggle & Editing Tools) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* HD Quality Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !isHD;
                setIsHD(next);
                if (showToast) {
                  showToast(next ? "HD Quality enabled (High Resolution)" : "Standard Quality (Optimized)");
                }
              }}
              style={{
                backgroundColor: isHD ? THEME.primary : THEME.card,
                color: isHD ? "#fff" : THEME.textMuted,
                border: `1px solid ${isHD ? THEME.primary : THEME.border}`,
                borderRadius: "14px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              title="Toggle High Definition (HD) Quality"
            >
              <Sparkles size={13} color={isHD ? "#fff" : THEME.primary} />
              <span>{isHD ? "HD ON" : "Standard"}</span>
            </button>

            {/* Editing Tools (Only for images) */}
            {fileType === "image" && (
              <>
                {/* Crop Tool Button */}
                <button
                  type="button"
                  onClick={handleToggleCrop}
                  style={{
                    ...styles.cleanBtn,
                    color: isCropping ? "#fff" : THEME.text,
                    padding: "7px",
                    backgroundColor: isCropping ? THEME.primary : THEME.card,
                    borderRadius: "8px",
                    border: `1px solid ${isCropping ? THEME.primary : THEME.border}`
                  }}
                  title="Crop Image"
                >
                  <Crop size={16} />
                </button>

                {/* Rotate 90° Button */}
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={isCropping}
                  style={{
                    ...styles.cleanBtn,
                    color: THEME.text,
                    padding: "7px",
                    backgroundColor: THEME.card,
                    borderRadius: "8px",
                    border: `1px solid ${THEME.border}`,
                    opacity: isCropping ? 0.4 : 1
                  }}
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw size={16} />
                </button>

                {/* Brush Tool Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isCropping) setIsCropping(false);
                    setIsBrushActive(!isBrushActive);
                  }}
                  style={{
                    ...styles.cleanBtn,
                    color: isBrushActive ? "#fff" : THEME.text,
                    padding: "7px",
                    backgroundColor: isBrushActive ? THEME.primary : THEME.card,
                    borderRadius: "8px",
                    border: `1px solid ${isBrushActive ? THEME.primary : THEME.border}`
                  }}
                  title="Draw / Brush Tool"
                >
                  <Palette size={16} />
                </button>

                {/* Undo Button */}
                {drawingHistory.length > 1 && !isCropping && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    style={{
                      ...styles.cleanBtn,
                      color: THEME.text,
                      padding: "7px",
                      backgroundColor: THEME.card,
                      borderRadius: "8px",
                      border: `1px solid ${THEME.border}`
                    }}
                    title="Undo Stroke"
                  >
                    <Undo2 size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* --- SECONDARY TOOLBAR (Brush Controls OR Crop Controls) --- */}
        {fileType === "image" && isBrushActive && !isCropping && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              backgroundColor: THEME.card,
              borderBottom: `1px solid ${THEME.border}`,
              gap: "12px"
            }}
          >
            {/* Color Palette */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflowX: "auto" }}>
              {BRUSH_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setBrushColor(col)}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    backgroundColor: col,
                    border: brushColor === col ? "2.5px solid #fff" : "1px solid rgba(0,0,0,0.5)",
                    cursor: "pointer",
                    transform: brushColor === col ? "scale(1.2)" : "scale(1)",
                    transition: "transform 0.15s ease",
                    flexShrink: 0
                  }}
                  title={col}
                />
              ))}
            </div>

            {/* Brush Size Slider */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <span style={{ fontSize: "11px", color: THEME.textMuted, fontWeight: "600" }}>Size:</span>
              <input
                type="range"
                min="2"
                max="24"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                style={{ width: "75px", accentColor: THEME.primary, cursor: "pointer" }}
              />
            </div>
          </div>
        )}

        {fileType === "image" && isCropping && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              backgroundColor: THEME.card,
              borderBottom: `1px solid ${THEME.border}`,
              flexWrap: "wrap",
              gap: "8px"
            }}
          >
            {/* Aspect Ratios */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {["free", "1:1", "4:3", "16:9"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleApplyAspectRatio(r)}
                  style={{
                    ...styles.cleanBtn,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: cropAspectRatio === r ? THEME.primary : THEME.header,
                    color: cropAspectRatio === r ? "#fff" : THEME.textMuted,
                    border: `1px solid ${cropAspectRatio === r ? THEME.primary : THEME.border}`
                  }}
                >
                  {r === "free" ? "Free" : r}
                </button>
              ))}
            </div>

            {/* Crop Confirm / Cancel */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setIsCropping(false)}
                style={{
                  ...styles.cleanBtn,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  color: THEME.textMuted,
                  backgroundColor: THEME.header
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={applyCrop}
                style={{
                  ...styles.cleanBtn,
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#fff",
                  backgroundColor: THEME.primary,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Check size={13} />
                <span>Apply Crop</span>
              </button>
            </div>
          </div>
        )}

        {/* --- MAIN DISPLAY CANVAS / MEDIA VIEWER --- */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            backgroundColor: "#050B0E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "260px",
            maxHeight: "420px",
            overflow: "hidden",
            padding: "12px",
            userSelect: "none"
          }}
        >
          {fileType === "image" ? (
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", maxHeight: "100%" }}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "390px",
                  borderRadius: "8px",
                  cursor: isBrushActive ? "crosshair" : "default",
                  touchAction: "none"
                }}
              />

              {/* Crop Box Overlay when Crop Mode is active */}
              {isCropping && (
                <div
                  style={{
                    position: "absolute",
                    top: `${cropBox.y * 100}%`,
                    left: `${cropBox.x * 100}%`,
                    width: `${cropBox.width * 100}%`,
                    height: `${cropBox.height * 100}%`,
                    border: "2px dashed #38bdf8",
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                    pointerEvents: "none",
                    borderRadius: "4px"
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-24px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "rgba(0,0,0,0.75)",
                      color: "#38bdf8",
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    Crop Area ({cropAspectRatio})
                  </div>
                </div>
              )}
            </div>
          ) : fileType === "video" ? (
            <video
              src={rawUrl}
              controls
              style={{
                maxWidth: "100%",
                maxHeight: "390px",
                borderRadius: "10px",
                backgroundColor: "#000"
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                padding: "36px 20px",
                textAlign: "center"
              }}
            >
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "16px",
                  backgroundColor: "rgba(0, 168, 132, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: THEME.accent
                }}
              >
                <FileText size={36} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: THEME.text,
                    maxWidth: "320px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {fileName}
                </div>
                <div style={{ fontSize: "12px", color: THEME.textMuted, marginTop: "4px" }}>
                  {fileSize || "Document"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- FOOTER: CAPTION INPUT, VIEW ONCE & SEND BUTTON --- */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: THEME.sidebar,
            borderTop: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          {/* View Once Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !isViewOnce;
              setIsViewOnce(next);
              if (onToggleViewOnce) onToggleViewOnce(next);
              if (showToast) {
                showToast(next ? "View Once enabled" : "View Once disabled");
              }
            }}
            style={{
              ...styles.cleanBtn,
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: isViewOnce ? "rgba(34, 197, 94, 0.2)" : THEME.card,
              color: isViewOnce ? THEME.primary : THEME.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${isViewOnce ? THEME.primary : THEME.border}`,
              flexShrink: 0
            }}
            title={isViewOnce ? "View Once Enabled" : "Enable View Once"}
          >
            <Eye size={18} />
          </button>

          {/* Caption Input */}
          <div
            style={{
              flex: 1,
              backgroundColor: THEME.card,
              borderRadius: "24px",
              border: `1px solid ${THEME.border}`,
              display: "flex",
              alignItems: "center",
              padding: "0 14px"
            }}
          >
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{
                ...styles.bareInput,
                color: THEME.text,
                fontSize: "14px",
                padding: "10px 0",
                width: "100%"
              }}
            />
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              backgroundColor: THEME.primary,
              color: "#fff",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(34, 197, 94, 0.4)",
              transition: "transform 0.15s ease"
            }}
            title="Send Media"
          >
            <Send size={18} style={{ marginLeft: "2px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
