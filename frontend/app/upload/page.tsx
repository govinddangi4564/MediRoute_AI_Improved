"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileImage, FileText, UploadCloud, X } from "lucide-react";
import { analyzeReports } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function FileIcon({ type }: { type: string }) {
  const Icon = type.startsWith("image/") ? FileImage : FileText;
  return (
    <span className="report-file-icon">
      <Icon size={19} />
    </span>
  );
}

export default function UploadPage() {
  const { lang, t } = useLang();
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const router = useRouter();

  const previews = useMemo(
    () => files.map((file) => ({ name: file.name, type: file.type, size: `${(file.size / 1024 / 1024).toFixed(1)} MB` })),
    [files]
  );

  const onFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles(Array.from(fileList).slice(0, 6));
    setError("");
  };

  const submit = async () => {
    if (!files.length) {
      setError(t("upload.error.nofile"));
      return;
    }

    setLoading(true);
    setError("");
    setProgress(0);
    try {
      const payload = [];
      for (let index = 0; index < files.length; index += 1) {
        const base64 = await toBase64(files[index]);
        payload.push({ name: files[index].name, type: files[index].type, base64 });
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }
      const result = await analyzeReports({ files: payload, language: lang });
      localStorage.removeItem("lifelineAnalysis");
      localStorage.removeItem("lifelineSymptoms");
      localStorage.setItem("lifelineReportAnalysis", JSON.stringify(result));
      router.push("/analysis");
    } catch {
      setError(t("upload.error.fail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="clinical-page reports-focus-page">
      <div className="site-container">
        <div className="reports-focus-shell">
          <div className="reports-focus-card">
            <div className="reports-focus-topline">
              <span><FileText size={14} /> {t("upload.topline")}</span>
              <span>{t("upload.types")}</span>
            </div>

            <h1>{t("upload.title")}</h1>
            <p className="reports-focus-copy">
              {t("upload.copy")}
            </p>

            <label
              htmlFor="file-input"
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragActive(false);
                onFiles(event.dataTransfer.files);
              }}
              className={`reports-dropzone ${dragActive ? "is-active" : ""}`}
            >
              <span className="reports-upload-icon">
                <UploadCloud size={32} />
              </span>
              <strong>{t("upload.choose")}</strong>
              <small>{t("upload.limit")}</small>
              <input id="file-input" type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(event) => onFiles(event.target.files)} />
            </label>

            {previews.length > 0 && (
              <div className="reports-file-list">
                {previews.map((file) => (
                  <div key={file.name} className="reports-file-row">
                    <FileIcon type={file.type} />
                    <div>
                      <p>{file.name}</p>
                      <span>{file.size}</span>
                    </div>
                    <button
                      onClick={() => setFiles((previous) => previous.filter((item) => item.name !== file.name))}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {loading && (
              <div className="reports-progress">
                <div>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p>{t("upload.progress")} {progress}%</p>
              </div>
            )}

            {error && <div className="alert alert-danger reports-error">{error}</div>}

            <button onClick={submit} disabled={loading} className="btn btn-primary reports-submit" id="upload-submit">
              {loading ? t("upload.analyzing") : t("upload.submit")}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
