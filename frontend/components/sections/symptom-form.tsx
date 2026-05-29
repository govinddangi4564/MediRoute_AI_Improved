"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  MessageSquareText,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { analyzeSymptoms } from "@/lib/api";

const languageOptions = [
  { label: "English", helper: "English", value: "en", speech: "en-IN" },
  { label: "Hindi", helper: "हिंदी", value: "hi", speech: "hi-IN" },
  {
    label: "Hindi + English",
    helper: "हिंदी + English",
    value: "hi",
    speech: "hi-IN",
  },
] as const;

const quickPrompts = [
  "Mujhe chest pain ho raha hai",
  "Bukhar and weakness",
  "Breathing problem ho rahi hai",
  "Sir ghoom raha hai / Dizziness",
];

type Lang = (typeof languageOptions)[number]["value"];

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function SymptomForm() {
  const [language, setLanguage] = useState<Lang>("hi");
  const [symptoms, setSymptoms] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoVoiceStarted = useRef(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const committedTextRef = useRef("");

  const speechLang = useMemo(
    () => languageOptions.find((l) => l.value === language)?.speech ?? "hi-IN",
    [language],
  );

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = speechLang;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setListening(true);
      setInputMode("voice");
      setError("");
      committedTextRef.current = symptoms.trim();
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript.trim();
        if (!chunk) continue;
        if (event.results[i].isFinal) {
          finalText += ` ${chunk}`;
        } else {
          interimText += ` ${chunk}`;
        }
      }

      if (finalText.trim()) {
        committedTextRef.current =
          `${committedTextRef.current} ${finalText}`.trim();
      }

      const nextValue = `${committedTextRef.current} ${interimText}`.trim();
      setSymptoms(nextValue);
    };

    recognition.onerror = () =>
      setError("Could not capture voice clearly. Please try again.");
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setSymptoms(committedTextRef.current.trim());
    };
    recognition.start();
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const submitSymptoms = async () => {
    if (!symptoms.trim()) {
      setError("Please describe symptoms first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await analyzeSymptoms({ text: symptoms, language });
      localStorage.removeItem("lifelineReportAnalysis");
      localStorage.setItem("lifelineSymptoms", symptoms);
      localStorage.setItem("lifelineAnalysis", JSON.stringify(result));
      router.push("/analysis");
    } catch {
      setError("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("voice") === "1" && !autoVoiceStarted.current) {
      autoVoiceStarted.current = true;
      startListening();
    }
  }, [searchParams, speechLang]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl bg-white p-5 shadow-lg"
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">
          1. Choose your preferred language
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {languageOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setLanguage(option.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                language === option.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">
          2. Describe symptoms
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            onClick={startListening}
            disabled={listening}
            className={`relative overflow-hidden rounded-lg border-2 px-4 py-3 text-left transition-all ${
              listening
                ? "border-red-500 bg-red-50"
                : inputMode === "voice"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-white hover:bg-slate-100"
            }`}
          >
            {listening && (
              <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
            )}
            <div className="flex items-center gap-3">
              <span
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full ${listening ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
              >
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </span>
              <div>
                <p
                  className={`font-bold ${listening ? "text-red-700" : "text-slate-900"}`}
                >
                  {listening ? "Listening..." : "Use Microphone"}
                </p>
                <p
                  className={`text-sm ${listening ? "text-red-600/80" : "text-slate-500"}`}
                >
                  Speak in any language
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              setInputMode("text");
              textAreaRef.current?.focus();
            }}
            className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
              inputMode === "text"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-white hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <MessageSquareText size={20} />
              </span>
              <div>
                <p className="font-bold text-slate-900">Type Symptoms</p>
                <p className="text-sm text-slate-500">Write in any language</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="mt-4">
        <textarea
          ref={textAreaRef}
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          className="min-h-48 w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-base leading-relaxed outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="Start typing or speaking... e.g., 'Mujhe chest pain ho raha hai' or 'I have a fever and weakness'."
        />
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold text-slate-600">
          Or add quick symptoms:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() =>
                setSymptoms((prev) => (prev ? `${prev}. ${prompt}` : prompt))
              }
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              + {prompt}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="tel:112"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 transition hover:bg-red-100"
          >
            <PhoneCall size={18} />
            Emergency Call 112
          </a>
          <button
            onClick={submitSymptoms}
            disabled={loading || !symptoms.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              "Analyzing..."
            ) : (
              <>
                <Sparkles size={18} />
                Continue to AI Analysis
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          This tool provides guidance only. In a severe emergency, call local
          services immediately.
        </p>
      </div>
    </motion.div>
  );
}
