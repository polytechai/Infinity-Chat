import React, { useRef } from "react";

export default function OtpInput({ otp, setOtp, onComplete, THEME }) {
  const inputRefs = useRef([]);

  // Auto-advance cursor forward upon typing each digit
  const handleChange = (index, value) => {
    const char = value.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    // If a valid digit was typed, automatically advance to next input box
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto trigger onComplete when all 6 digits are populated
    if (newOtp.every((digit) => digit !== "")) {
      onComplete?.(newOtp.join(""));
    }
  };

  // Backspace handler to automatically step back to previous input box
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Current box is already empty: focus previous box and clear it
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      } else if (otp[index]) {
        // Clear current box
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  // Clipboard paste support for full 6-digit codes
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pasteData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasteData.length; i++) {
      newOtp[i] = pasteData[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasteData.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (newOtp.every((digit) => digit !== "")) {
      onComplete?.(newOtp.join(""));
    }
  };

  return (
    <div
      style={{ display: "flex", gap: "8px", justifyContent: "center", margin: "14px 0" }}
      onPaste={handlePaste}
    >
      {otp.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => (inputRefs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          style={{
            width: "44px",
            height: "48px",
            textAlign: "center",
            fontSize: "18px",
            fontWeight: "bold",
            border: `1.5px solid ${digit ? THEME.primary : THEME.border}`,
            borderRadius: "8px",
            outline: "none",
            backgroundColor: THEME.card,
            color: THEME.text,
            transition: "border-color 0.2s"
          }}
        />
      ))}
    </div>
  );
}
