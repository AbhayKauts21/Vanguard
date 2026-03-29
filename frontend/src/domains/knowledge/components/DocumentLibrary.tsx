"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell, TopBar } from "@/components/layout";
import { useAuthStore } from "@/domains/auth/model";
import { listUploadedDocuments, uploadDocument } from "@/domains/knowledge/api/documents-api";
import { Link } from "@/i18n/navigation";
import type { UploadedDocument } from "@/types";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentLibrary() {
  const t = useTranslations("documents");
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const hasPendingDocuments = useMemo(
    () => documents.some((document) => document.status === "pending" || document.status === "processing"),
    [documents],
  );

  async function loadDocuments() {
    if (!isAuthenticated) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const items = await listUploadedDocuments();
      setDocuments(items);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!hasPendingDocuments) return;
    const timer = window.setInterval(() => {
      void loadDocuments();
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPendingDocuments]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const uploaded = await uploadDocument({
        file: selectedFile,
        title,
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        onProgress: setUploadProgress,
      });
      setDocuments((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
      setTitle("");
      setTags("");
      setSelectedFile(null);
      setUploadProgress(100);
      void loadDocuments();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("uploadError"));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AppShell>
      <TopBar />
      <main className="relative z-10 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <section className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">
                {t("eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-light text-white md:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void loadDocuments()}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                {t("refresh")}
              </button>
              <Link
                href="/"
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/15"
              >
                {t("backToChat")}
              </Link>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="rounded-[2rem] border border-white/10 bg-black/35 p-8 text-white/70 backdrop-blur-xl">
              <h2 className="text-xl font-medium text-white">{t("unauthTitle")}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                {t("unauthBody")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
              <section className="rounded-[2rem] border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
                <div className="mb-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                    {t("uploadEyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-medium text-white">{t("uploadTitle")}</h2>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">
                      {t("fileLabel")}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.md,.markdown"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300/15 file:px-3 file:py-2 file:text-sm file:text-cyan-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">
                      {t("titleLabel")}
                    </span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={t("titlePlaceholder")}
                      className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">
                      {t("tagsLabel")}
                    </span>
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder={t("tagsPlaceholder")}
                      className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25"
                    />
                    <span className="mt-2 block text-xs text-white/35">{t("tagsHint")}</span>
                  </label>

                  {isUploading ? (
                    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/8 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-cyan-100/80">
                        <span>{t("uploading")}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-300 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {uploadError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">
                      {uploadError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    className="w-full rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/35 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isUploading ? t("uploading") : t("uploadButton")}
                  </button>
                </form>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      {t("libraryEyebrow")}
                    </p>
                    <h2 className="mt-2 text-xl font-medium text-white">{t("libraryTitle")}</h2>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                    {documents.length} {t("documentsCount")}
                  </span>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`doc-skeleton-${index}`}
                        className="h-24 animate-pulse rounded-3xl border border-white/8 bg-white/[0.03]"
                      />
                    ))}
                  </div>
                ) : documents.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center text-white/45">
                    {t("empty")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((document) => (
                      <article
                        key={document.id}
                        className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-medium text-white">
                                {document.title || document.file_name}
                              </h3>
                              <StatusPill status={document.status} />
                            </div>
                            <p className="mt-1 text-sm text-white/45">{document.file_name}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/35">
                              <span>{t("createdAt", { value: formatTimestamp(document.created_at) })}</span>
                              <span>{formatFileSize(document.file_size)}</span>
                              <span>{document.content_type}</span>
                            </div>
                            {document.tags.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {document.tags.map((tag) => (
                                  <span
                                    key={`${document.id}-${tag}`}
                                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {document.error_detail ? (
                              <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100/85">
                                {document.error_detail}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 gap-3">
                            <a
                              href={document.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.08]"
                            >
                              {t("open")}
                            </a>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function StatusPill({ status }: { status: UploadedDocument["status"] }) {
  const t = useTranslations("documents");
  const styles = {
    pending: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    processing: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    ready: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    failed: "border-red-400/20 bg-red-500/10 text-red-100",
  } as const;

  return (
    <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${styles[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}
