"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Keyboard,
  Mic,
  PhoneCall,
  Sparkles,
  Square,
  X,
  Loader2,
} from "lucide-react";
import { analyzeSymptoms } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";

const quickSymptoms = [
  "symptoms.quick.fever",
  "symptoms.quick.chest",
  "symptoms.quick.breath",
  "symptoms.quick.vomit",
  "symptoms.quick.head",
  "symptoms.quick.stomach",
];

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function normalizeTranscript(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function appendTranscript(base: string, chunk: string) {
  const cleanBase = normalizeTranscript(base);
  const cleanChunk = normalizeTranscript(chunk);
  if (!cleanChunk) return cleanBase;
  if (!cleanBase) return cleanChunk;

  const baseWords = cleanBase.split(" ");
  const chunkWords = cleanChunk.split(" ");
  const maxOverlap = Math.min(baseWords.length, chunkWords.length);

  for (let size = maxOverlap; size > 0; size -= 1) {
    const baseEnd = baseWords.slice(-size).join(" ").toLowerCase();
    const chunkStart = chunkWords.slice(0, size).join(" ").toLowerCase();
    if (baseEnd === chunkStart) {
      return [...baseWords, ...chunkWords.slice(size)].join(" ");
    }
  }

  if (cleanBase.toLowerCase().endsWith(cleanChunk.toLowerCase())) {
    return cleanBase;
  }

  return `${cleanBase} ${cleanChunk}`;
}

function SymptomsForm() {
  const { lang, speechLocale, t } = useLang();
  const [symptoms, setSymptoms] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const voiceStarted = useRef(false);
  const recognitionRef = useRef<any>(null);
  const committedTextRef = useRef("");
  const processedResultIndexRef = useRef(0);
  const stoppingRef = useRef(false);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(t("symptoms.error.voiceUnsupported"));
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    stoppingRef.current = false;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = speechLocale;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onstart = () => {
      setListening(true);
      setError("");
      committedTextRef.current = symptoms.trim();
      processedResultIndexRef.current = 0;
    };
    recognition.onresult = (event: any) => {
      const finalChunks: string[] = [];
      let interimText = "";
      const startIndex = Math.max(event.resultIndex, processedResultIndexRef.current);
      for (
        let index = startIndex;
        index < event.results.length;
        index += 1
      ) {
        const transcript = event.results[index][0].transcript.trim();
        if (!transcript) continue;
        if (event.results[index].isFinal) {
          finalChunks.push(transcript);
          processedResultIndexRef.current = index + 1;
        } else {
          interimText = transcript;
        }
      }

      for (const chunk of finalChunks) {
        committedTextRef.current = appendTranscript(committedTextRef.current, chunk);
      }

      setSymptoms(appendTranscript(committedTextRef.current, interimText));
    };
    recognition.onerror = (event: any) => {
      if (stoppingRef.current || event.error === "aborted") return;
      setError(t("symptoms.error.voice"));
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      setSymptoms(committedTextRef.current.trim());
      stoppingRef.current = false;
    };
    recognition.start();
  };

  const stopListening = () => {
    if (!recognitionRef.current) {
      setListening(false);
      return;
    }

    stoppingRef.current = true;
    committedTextRef.current = symptoms.trim();
    recognitionRef.current.stop();
  };

  const submit = async () => {
    if (!symptoms.trim()) {
      setError(t("symptoms.error.empty"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await analyzeSymptoms({
        text: symptoms,
        language: lang,
      });
      localStorage.removeItem("lifelineReportAnalysis");
      localStorage.setItem("lifelineSymptoms", symptoms);
      localStorage.setItem("lifelineAnalysis", JSON.stringify(result));
      router.push("/analysis");
    } catch {
      setError(t("symptoms.error.analyze"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("voice") === "1" && !voiceStarted.current) {
      voiceStarted.current = true;
      window.setTimeout(startListening, 300);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <section className="clinical-page symptoms-focus-page">
      <div className="site-container">
        <div className="symptoms-focus-shell">
          <div className="symptoms-focus-card">
            <div className="symptoms-focus-topline">
              <span>
                <Sparkles size={14} /> {t("symptoms.topline")}
              </span>
              <a href="tel:112">
                <PhoneCall size={15} /> {t("common.call112")}
              </a>
            </div>

            <h1>{t("symptoms.title")}</h1>
            <p className="symptoms-focus-copy">
              {t("symptoms.copy")}
            </p>

            <div className="symptoms-voice-row">
              <button
                type="button"
                onClick={startListening}
                disabled={listening}
                id="mic-btn"
                className={`symptoms-mic-button ${listening ? "is-listening" : ""}`}
                aria-pressed={listening}
              >
                <span className="symptoms-mic-icon">
                  <Mic size={34} />
                </span>
                <span>
                  <strong>{listening ? t("symptoms.mic.listening") : t("symptoms.mic.idle")}</strong>
                  <small>
                    {listening
                      ? t("symptoms.mic.activeHelp")
                      : t("symptoms.mic.help")}
                  </small>
                </span>
                {listening && <em>{t("symptoms.live")}</em>}
                {listening && (
                  <span className="relative flex h-3 w-3 ml-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </button>

              {listening && (
                <button
                  type="button"
                  onClick={stopListening}
                  className="symptoms-stop-button"
                  aria-label="Stop voice input"
                >
                  <Square size={16} fill="currentColor" />
                  {t("common.stop")}
                </button>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label
                className="clinical-field-label symptoms-type-label"
                htmlFor="symptoms-input"
                style={{ marginBottom: 0 }}
              >
                <Keyboard size={15} /> {t("symptoms.type")}
              </label>
              {symptoms.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSymptoms("");
                    setError("");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--danger, #dc3545)",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                  title={t("common.clear")}
                >
                  <X size={14} /> {t("common.clear")}
                </button>
              )}
            </div>
            <textarea
              id="symptoms-input"
              className="input-field symptoms-textarea"
              value={symptoms}
              onChange={(event) => {
                setSymptoms(event.target.value);
                if (error) setError("");
              }}
              rows={7}
              placeholder={t("symptoms.placeholder")}
            />

            <div className="symptoms-prompts">
              {quickSymptoms.map((symptom) => (
                <button
                  key={symptom}
                  className="chip"
                  onClick={() => {
                    setSymptoms((previous) =>
                      previous ? `${previous}. ${t(symptom)}` : t(symptom),
                    );
                    if (error) setError("");
                  }}
                >
                  {t(symptom)}
                </button>
              ))}
            </div>

            {error && (
              <div className="alert alert-danger symptoms-error">{error}</div>
            )}

            <button
              onClick={submit}
              disabled={loading || !symptoms.trim()}
              className="btn btn-primary symptoms-submit"
              id="sym-submit"
              style={{
                opacity: !symptoms.trim() && !loading ? 0.6 : 1,
                cursor:
                  !symptoms.trim() && !loading ? "not-allowed" : "pointer",
              }}
            >
              {loading && (
                <Loader2
                  size={16}
                  className="animate-spin"
                  style={{ marginRight: "8px" }}
                />
              )}
              {loading ? t("symptoms.analyzing") : t("symptoms.submit")}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SymptomsPage() {
  return (
    <Suspense
      fallback={
        <div className="clinical-page site-container text-[var(--muted)]">
          <SymptomsLoading />
        </div>
      }
    >
      <SymptomsForm />
    </Suspense>
  );
}

function SymptomsLoading() {
  const { t } = useLang();
  return <>{t("symptoms.loading")}</>;
}
