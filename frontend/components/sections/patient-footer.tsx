"use client";

import { useLang } from "@/contexts/LanguageContext";

export function PatientFooter() {
  const { t } = useLang();

  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "24px 0", background: "rgba(250,247,240,0.86)" }}>
      <div className="site-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", fontSize: "13px", color: "var(--muted)" }}>
        <span>MediRoute AI 2026</span>
        <span>{t("common.footer.disclaimer")}</span>
      </div>
    </footer>
  );
}
