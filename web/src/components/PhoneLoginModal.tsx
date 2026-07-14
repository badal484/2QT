// src/components/PhoneLoginModal.tsx
import React, { useState, useEffect } from "react";
import { auth } from "../firebase"; // web firebase init
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

interface PhoneLoginModalProps {
  /**
   * Callback invoked after successful authentication.
   * Receives the Firebase ID token string.
   */
  onSuccess: (idToken: string) => void;
  /** Optional callback when the modal should be closed */
  onClose?: () => void;
}

export const PhoneLoginModal: React.FC<PhoneLoginModalProps> = ({ onSuccess, onClose }) => {
  const [phone, setPhone] = useState<string>("+91");
  const [otp, setOtp] = useState<string>("");
  const [step, setStep] = useState<"enterPhone" | "enterOtp">("enterPhone");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize invisible reCAPTCHA on first render
  useEffect(() => {
    // Only render once when we need it
    if (!window.recaptchaVerifier) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – firebase attaches to window
      window.recaptchaVerifier = new RecaptchaVerifier("recaptcha-container", {
        size: "invisible",
        callback: (response: any) => {
          // reCAPTCHA solved – we can proceed with sign‑in.
        },
      }, auth);
    }
  }, []);

  const startPhoneVerification = async () => {
    setError(null);
    try {
      // @ts-ignore – we stored verifier on window
      const verifier = window.recaptchaVerifier as RecaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phone, verifier);
      setConfirmation(result);
      setStep("enterOtp");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to send OTP");
    }
  };

  const verifyOtp = async () => {
    if (!confirmation) return;
    try {
      const cred = await confirmation.confirm(otp);
      const idToken = await cred.user.getIdToken();
      onSuccess(idToken);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Invalid OTP");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-4">Phone Sign‑In</h2>
        {step === "enterPhone" && (
          <>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              className="w-full border rounded px-3 py-2 mb-4"
            />
            <button
              onClick={startPhoneVerification}
              className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
            >
              Send OTP
            </button>
          </>
        )}
        {step === "enterOtp" && (
          <>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP"
              className="w-full border rounded px-3 py-2 mb-4"
            />
            <button
              onClick={verifyOtp}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
              Verify OTP
            </button>
          </>
        )}
        {error && <p className="text-red-600 mt-2">{error}</p>}
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 text-gray-500 hover:underline"
          >
            Cancel
          </button>
        )}
        {/* Container required for the invisible reCAPTCHA */}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
};

export default PhoneLoginModal;
