// web/src/components/PhoneLoginModal.tsx
// PhoneLoginModal: a self‑contained modal component that handles Firebase Phone authentication.
// It uses the Firebase app initialized in src/firebaseInit.ts.

import { useState, useEffect, useRef } from "react";
import { auth } from "../firebaseInit";
import { RecaptchaVerifier, signInWithPhoneNumber, User } from "firebase/auth";

export default function PhoneLoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (user: User) => void }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+91"); // default country code
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  // Initialise invisible reCAPTCHA only once when the component mounts.
  useEffect(() => {
    if (!recaptchaVerifier.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => {
            // reCAPTCHA solved - we can proceed with sign‑in.
            // The callback is required but we trigger sign‑in manually.
          },
        }
      );
    }
    // Clean up on unmount.
    return () => {
      recaptchaVerifier.current?.clear();
    };
  }, []);

  const sendOtp = async () => {
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number");
      return;
    }
    const fullNumber = `+${digits.startsWith("91") ? "" : "91"}${digits}`;
    setLoading(true);
    try {
      const verifier = recaptchaVerifier.current!;
      await signInWithPhoneNumber(auth, fullNumber, verifier);
      setStep("otp");
    } catch (e: any) {
      setError(e.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    setLoading(true);
    try {
      // ConfirmationResult is stored internally by Firebase after signInWithPhoneNumber.
      // We retrieve it via the verifier's widget.
      const confirmationResult = (recaptchaVerifier.current as any)._confirmationResult;
      if (!confirmationResult) {
        setError("No OTP request pending");
        return;
      }
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      // Force refresh to get a fresh ID token.
      await user.getIdToken(true);
      onLogin(user);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={closeButtonStyle}>✕</button>
        {step === "phone" && (
          <>
            <h2 style={titleStyle}>Sign in with Phone</h2>
            <input
              type="tel"
              placeholder="Phone number (e.g. 9876543210)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
            {error && <p style={errorStyle}>{error}</p>}
            <button onClick={sendOtp} disabled={loading} style={primaryButtonStyle}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </>
        )}
        {step === "otp" && (
          <>
            <h2 style={titleStyle}>Enter OTP</h2>
            <input
              type="text"
              placeholder="6‑digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              style={inputStyle}
            />
            {error && <p style={errorStyle}>{error}</p>}
            <button onClick={verifyOtp} disabled={loading || otp.length !== 6} style={primaryButtonStyle}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
          </>
        )}
        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}

// Basic inline styling that follows the premium aesthetic guidelines.
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(8px)",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1a1a2e, #16213e)",
  borderRadius: "16px",
  padding: "32px",
  width: "320px",
  boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
  position: "relative",
  color: "#fff",
};

const closeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: "18px",
  cursor: "pointer",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "20px",
  fontWeight: 600,
  textAlign: "center",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: "14px",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  background: "linear-gradient(90deg, #ff7e5f, #feb47b)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.2s",
};

const errorStyle: React.CSSProperties = {
  color: "#ff6b6b",
  marginBottom: "8px",
  fontSize: "13px",
};
