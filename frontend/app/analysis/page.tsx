"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  HeartPulse,
  MapPin,
  Share2,
  Stethoscope,
} from "lucide-react";
import { AnalysisResult, Severity } from "@/types";
import { useLang } from "@/contexts/LanguageContext";

const SEVERITY_CONFIG: Record<
  Severity,
  { labelKey: string; tone: string; bg: string; border: string }
> = {
  low: {
    labelKey: "severity.low",
    tone: "#46745d",
    bg: "var(--green-light)",
    border: "#b8d4c0",
  },
  moderate: {
    labelKey: "severity.moderate",
    tone: "#9a7652",
    bg: "var(--yellow-light)",
    border: "#dec99e",
  },
  high: {
    labelKey: "severity.high",
    tone: "var(--danger)",
    bg: "var(--red-light)",
    border: "#e7b8af",
  },
  critical: {
    labelKey: "severity.critical",
    tone: "var(--danger)",
    bg: "var(--red-light)",
    border: "#e7b8af",
  },
};

type ReportSummary = {
  summary: string;
  redFlags: string[];
  specialist: string;
};

function parseSavedJson<T>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function normalizeReportSummary(
  value: Partial<ReportSummary> | null,
): ReportSummary | null {
  if (!value) return null;
  return {
    summary: value.summary || "Could not read report summary.",
    redFlags: Array.isArray(value.redFlags) ? value.redFlags : [],
    specialist: value.specialist || "General Physician",
  };
}

function localizeEmergencyNumber(value: string) {
  return value.replace(/\b911\b/g, "112");
}

function buildShareText(analysis: AnalysisResult, symptoms: string | null, reportSummary: ReportSummary | null) {
  const lines = [
    "MediRoute AI emergency handoff",
    `Severity: ${analysis.severity}`,
    `Emergency level: ${analysis.emergencyLevel}`,
    `Possible issue: ${analysis.possibleDisease}`,
    `Department: ${analysis.department}`,
    symptoms ? `Symptoms: ${symptoms}` : "",
    analysis.handoffSummary ? `Summary: ${analysis.handoffSummary}` : "",
    reportSummary ? `Report notes: ${reportSummary.summary}` : "",
    "Emergency number in India: 112",
  ].filter(Boolean);
  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AnalysisPage() {
  const { t } = useLang();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(
    null,
  );
  const router = useRouter();
  const symptoms = typeof window !== "undefined" ? localStorage.getItem("lifelineSymptoms") : null;

  useEffect(() => {
    const storedAnalysis = parseSavedJson<AnalysisResult>("lifelineAnalysis");
    const storedReport = normalizeReportSummary(
      parseSavedJson<Partial<ReportSummary>>("lifelineReportAnalysis"),
    );
    setAnalysis(storedAnalysis);
    setReportSummary(storedReport);
  }, []);

  const severity = useMemo(
    () => (analysis ? SEVERITY_CONFIG[analysis.severity] : null),
    [analysis],
  );
  const isSevere =
    analysis?.severity === "high" || analysis?.severity === "critical";

  if (!analysis && !reportSummary) {
    return (
      <section className="clinical-page">
        <div className="site-container">
          <div className="clinical-card-white mx-auto max-w-[560px] text-center">
            <ClipboardCheck
              className="mx-auto mb-4 text-[var(--accent)]"
              size={30}
            />
            <h1 className="text-[24px] font-semibold text-[var(--ink)]">
              {t("analysis.empty.title")}
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-[var(--muted)]">
              {t("analysis.empty.copy")}
            </p>
            <Link href="/symptoms" className="btn btn-primary mt-6">
              {t("analysis.empty.cta")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="clinical-page">
      <div className="site-container">
        <div className="clinical-header">
          <div>
            <span className="clinical-eyebrow">
              <ClipboardCheck size={13} /> {t("analysis.topline")}
            </span>
            <h1 className="clinical-title">
              {t("analysis.title")}
            </h1>
            <p className="clinical-subtitle">
              {t("analysis.copy")}
            </p>
          </div>
          <button
            onClick={() => router.push("/hospitals")}
            className="btn btn-primary"
            id="goto-hospitals-top"
          >
            {t("analysis.findHospitals")} <ArrowRight size={16} />
          </button>
        </div>

        {analysis && severity && (
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1fr]">
            <aside className="clinical-card-white">
              <div className="border-b border-[var(--line)] pb-5">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold"
                  style={{
                    borderColor: severity.border,
                    color: severity.tone,
                    backgroundColor: severity.bg,
                  }}
                >
                  <HeartPulse size={14} /> {t(severity.labelKey)}
                </span>
                <h2 className="mt-4 text-[23px] font-semibold leading-tight text-[var(--ink)]">
                  {analysis.possibleDisease}
                </h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[var(--muted)]">
                  {analysis.explanation}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[#f8f4eb] px-4 py-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {t("analysis.emergency")}
                  </span>
                  <p className="text-right text-[14px] font-semibold text-[var(--ink)]">
                    {analysis.emergencyLevel}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[#f8f4eb] px-4 py-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {t("analysis.department")}
                  </span>
                  <p className="text-right text-[14px] font-semibold text-[var(--ink)]">
                    {analysis.department}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[#f8f4eb] px-4 py-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {t("analysis.confidence")}
                  </span>
                  <p className="text-right text-[14px] font-semibold text-[var(--ink)]">{`${analysis.confidenceScore}%`}</p>
                </div>
              </div>

              {isSevere && (
                <div className="mt-5 rounded-lg border border-[#e7b8af] bg-[var(--red-light)] p-4 text-[13.5px] leading-6 text-[var(--danger)]">
                  <AlertTriangle className="mb-2" size={18} />
                  {t("analysis.highRisk")}
                </div>
              )}
            </aside>

            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="clinical-card-white">
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[var(--ink)]">
                    <Stethoscope size={18} className="text-[var(--accent)]" />{" "}
                    {t("analysis.firstAid")}
                  </h2>
                  <ol className="mt-4 space-y-3">
                    {(Array.isArray(analysis.firstAid)
                      ? analysis.firstAid
                      : []
                    ).map((item, index) => (
                      <li
                        key={item}
                        className="flex gap-3 text-[13.5px] leading-6 text-[var(--muted)]"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--cream)] text-xs font-semibold text-[var(--ink)]">
                          {index + 1}
                        </span>
                        {localizeEmergencyNumber(item)}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="clinical-card-white">
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[var(--ink)]">
                    <ClipboardCheck
                      size={18}
                      className="text-[var(--accent)]"
                    />{" "}
                    {t("analysis.next")}
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {(Array.isArray(analysis.recommendations)
                      ? analysis.recommendations
                      : []
                    ).map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-[13.5px] leading-6 text-[var(--muted)]"
                      >
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                        <span>{localizeEmergencyNumber(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/hospitals")}
                  className="btn btn-primary"
                  id="goto-hospitals"
                >
                  <MapPin size={16} /> {t("analysis.findNearest")}
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="btn btn-outline"
                  id="goto-dashboard"
                >
                  {t("analysis.dashboard")}
                </button>
              </div>
            </div>
          </div>
        )}

        {analysis && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.82fr]">
            <div className="clinical-card-white">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--ink)]">
                <ClipboardCheck size={18} className="text-[var(--accent)]" />
                Follow-up questions
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(analysis.followUpQuestions || []).map((question, index) => (
                  <div key={question} className="border border-[var(--line)] bg-[#f8f4eb] p-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--earth)]">
                      Q{index + 1}
                    </span>
                    <p className="mt-1 text-[13.5px] leading-6 text-[var(--muted)]">{question}</p>
                  </div>
                ))}
              </div>

              <h2 className="mt-6 flex items-center gap-2 text-[17px] font-semibold text-[var(--ink)]">
                <HeartPulse size={18} className="text-[var(--danger)]" />
                Risk timeline
              </h2>
              <div className="mt-4 border-l border-[var(--line-strong)] pl-5">
                {(analysis.riskTimeline || []).map((item, index) => (
                  <div key={item} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center border border-[var(--line-strong)] bg-white text-xs font-semibold text-[var(--ink)]">
                      {index + 1}
                    </span>
                    <p className="text-[13.5px] leading-6 text-[var(--muted)]">{localizeEmergencyNumber(item)}</p>
                  </div>
                ))}
              </div>

              {(analysis.escalationTriggers || []).length > 0 && (
                <div className="mt-6 border border-[#e7b8af] bg-[var(--red-light)] p-4">
                  <p className="text-[13px] font-semibold text-[var(--danger)]">Escalate immediately if any of these appear</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(analysis.escalationTriggers || []).map((trigger) => (
                      <span key={trigger} className="border border-[#e7b8af] bg-white px-3 py-1 text-[12.5px] text-[var(--danger)]">
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="clinical-card-white">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--ink)]">
                <FileText size={18} className="text-[var(--accent)]" />
                Emergency handoff card
              </h2>
              <p className="mt-3 whitespace-pre-line border border-[var(--line)] bg-[#f8f4eb] p-4 text-[13.5px] leading-6 text-[var(--muted)]">
                {analysis.handoffSummary || buildShareText(analysis, symptoms, reportSummary)}
              </p>
              <div className="mt-4 grid gap-2">
                <button
                  className="btn btn-primary justify-center"
                  onClick={async () => {
                    const text = buildShareText(analysis, symptoms, reportSummary);
                    if (navigator.share) {
                      await navigator.share({ title: "MediRoute AI handoff", text });
                    } else {
                      await navigator.clipboard.writeText(text);
                    }
                  }}
                >
                  <Share2 size={16} /> Share handoff
                </button>
                <button
                  className="btn btn-outline justify-center"
                  onClick={() => navigator.clipboard.writeText(buildShareText(analysis, symptoms, reportSummary))}
                >
                  <Copy size={16} /> Copy summary
                </button>
                <button
                  className="btn btn-outline justify-center"
                  onClick={() => downloadTextFile("mediroute-handoff.txt", buildShareText(analysis, symptoms, reportSummary))}
                >
                  <Download size={16} /> Download handoff
                </button>
                <a
                  className="btn btn-outline justify-center"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(buildShareText(analysis, symptoms, reportSummary))}`}
                >
                  Share on WhatsApp
                </a>
              </div>
            </aside>
          </div>
        )}

        {reportSummary && (
          <div className="clinical-card-white mt-6">
            <div className="grid gap-5 lg:grid-cols-[0.35fr_1fr]">
              <div>
                <span className="clinical-eyebrow">
                  <FileText size={13} /> {t("analysis.report.notes")}
                </span>
                <h2 className="mt-3 text-[21px] font-semibold text-[var(--ink)]">
                  {t("analysis.report.title")}
                </h2>
                <p className="mt-2 text-[13px] text-[var(--muted)]">
                  {t("analysis.report.specialist")} {reportSummary.specialist}
                </p>
              </div>
              <div>
                <p className="text-[14px] leading-7 text-[var(--muted)]">
                  {reportSummary.summary}
                </p>
                {reportSummary.redFlags.length > 0 && (
                  <div className="mt-5 border border-[var(--line)] bg-[#f8f4eb] p-4">
                    <p className="mb-3 text-[13px] font-semibold text-[var(--ink)]">
                      {t("analysis.report.points")}
                    </p>
                    <div className="clinical-list">
                      {reportSummary.redFlags.map((flag) => (
                        <div key={flag} className="clinical-list-item">
                          <span className="clinical-list-dot" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
