"use client";

import { useRef, useEffect, ClipboardEvent, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  accentColor?: string; // tailwind border colour class e.g. "border-sky-500"
  length?: number;
}

export function OtpBoxInput({
  value,
  onChange,
  onComplete,
  accentColor = "border-white/60",
  length = 6,
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Web OTP API — intercepts incoming SMS on Android Chrome automatically
  useEffect(() => {
    if (!("OTPCredential" in window)) return;
    const ac = new AbortController();
    (navigator.credentials as any)
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((cred: any) => {
        if (cred?.code) {
          const digits = cred.code.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(length, " ").split("");
    arr[i] = digit || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (digit && i < length - 1) focus(i + 1);
    if (next.replace(/ /g, "").length === length) onComplete?.(next.trim());
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (value[i] && value[i] !== " ") {
        const arr = value.padEnd(length, " ").split("");
        arr[i] = " ";
        onChange(arr.join("").trimEnd());
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(digits);
    focus(Math.min(digits.length, length - 1));
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i]?.trim() || ""}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className={`w-11 h-13 text-center text-xl font-black text-white bg-white/5 border-2 rounded-xl outline-none transition-all
            ${value[i]?.trim() ? accentColor : "border-white/10"}
            focus:${accentColor} focus:bg-white/8`}
          style={{ height: "52px" }}
        />
      ))}
    </div>
  );
}
