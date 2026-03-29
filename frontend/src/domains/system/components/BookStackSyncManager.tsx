"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { BookStackTreeBook, BookStackTreeChapter, BookStackTreePage } from "../api/bookstackApi";
import { useBookStackSyncManager, collectBookPageIds, collectChapterPageIds } from "../hooks/useBookStackSyncManager";
import { useTranslations } from "next-intl";

function TreeCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-white/20 bg-black/40 text-cyan-300"
    />
  );
}

function PageNode({
  page,
  checked,
  onToggle,
}: {
  page: BookStackTreePage;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.08]">
      <TreeCheckbox checked={checked} indeterminate={false} onChange={onToggle} />
      <span className="material-symbols-outlined text-[18px] text-white/35">description</span>
      <span className="truncate">{page.name}</span>
    </label>
  );
}

function ChapterNode({
  chapter,
  selectedPageIds,
  expanded,
  onToggleExpanded,
  onToggleChapter,
  onTogglePage,
}: {
  chapter: BookStackTreeChapter;
  selectedPageIds: Set<number>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleChapter: () => void;
  onTogglePage: (pageId: number) => void;
}) {
  const t = useTranslations("system");
  const chapterPageIds = collectChapterPageIds(chapter);
  const selectedCount = chapterPageIds.filter((pageId) => selectedPageIds.has(pageId)).length;
  const checked = chapterPageIds.length > 0 && selectedCount === chapterPageIds.length;
  const indeterminate = selectedCount > 0 && !checked;

  return (
    <div className="rounded-3xl border border-white/6 bg-black/35 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition hover:bg-white/[0.08]"
        >
          <span className="material-symbols-outlined text-[18px]">
            {expanded ? "expand_more" : "chevron_right"}
          </span>
        </button>
        <TreeCheckbox checked={checked} indeterminate={indeterminate} onChange={onToggleChapter} />
        <span className="material-symbols-outlined text-[18px] text-amber-300/70">folder_open</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{chapter.name}</div>
          <div className="text-xs text-white/35">{t("pagesCount", { count: chapter.pages.length })}</div>
        </div>
      </div>
      {expanded && (
        <div className="grid gap-2 border-t border-white/6 px-4 py-3">
          {chapter.pages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-white/35">
              {t("noPagesInChapter")}
            </div>
          ) : (
            chapter.pages.map((page) => (
              <PageNode
                key={page.page_id}
                page={page}
                checked={selectedPageIds.has(page.page_id)}
                onToggle={() => onTogglePage(page.page_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BookNode({
  book,
  selectedPageIds,
  expanded,
  expandedChapters,
  onToggleExpanded,
  onToggleChapterExpanded,
  onToggleBook,
  onToggleChapter,
  onTogglePage,
}: {
  book: BookStackTreeBook;
  selectedPageIds: Set<number>;
  expanded: boolean;
  expandedChapters: Set<number>;
  onToggleExpanded: () => void;
  onToggleChapterExpanded: (chapterId: number) => void;
  onToggleBook: () => void;
  onToggleChapter: (chapter: BookStackTreeChapter) => void;
  onTogglePage: (pageId: number) => void;
}) {
  const t = useTranslations("system");
  const bookPageIds = collectBookPageIds(book);
  const selectedCount = bookPageIds.filter((pageId) => selectedPageIds.has(pageId)).length;
  const checked = bookPageIds.length > 0 && selectedCount === bookPageIds.length;
  const indeterminate = selectedCount > 0 && !checked;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.05]">
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition hover:bg-white/[0.08]"
        >
          <span className="material-symbols-outlined text-[18px]">
            {expanded ? "expand_more" : "chevron_right"}
          </span>
        </button>
        <TreeCheckbox checked={checked} indeterminate={indeterminate} onChange={onToggleBook} />
        <span className="material-symbols-outlined text-[20px] text-cyan-300/80">menu_book</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-white/90">
            {book.name}
          </div>
          <div className="text-xs text-white/35">
            {t("bookStats", { chapters: book.chapters.length, pages: bookPageIds.length })}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-3 border-t border-white/6 px-4 py-4">
          {book.pages.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                {t("directPages")}
              </div>
              {book.pages.map((page) => (
                <PageNode
                  key={page.page_id}
                  page={page}
                  checked={selectedPageIds.has(page.page_id)}
                  onToggle={() => onTogglePage(page.page_id)}
                />
              ))}
            </div>
          )}

          {book.chapters.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                {t("chapters")}
              </div>
              {book.chapters.map((chapter) => (
                <ChapterNode
                  key={chapter.chapter_id}
                  chapter={chapter}
                  selectedPageIds={selectedPageIds}
                  expanded={expandedChapters.has(chapter.chapter_id)}
                  onToggleExpanded={() => onToggleChapterExpanded(chapter.chapter_id)}
                  onToggleChapter={() => onToggleChapter(chapter)}
                  onTogglePage={onTogglePage}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BookStackSyncManager() {
  const t = useTranslations("system");
  const {
    books,
    sourceKey,
    selectedPageIds,
    selectedPageCount,
    allPageCount,
    isLoading,
    isSaving,
    isSyncing,
    error,
    notice,
    dirty,
    toggleBook,
    toggleChapter,
    togglePage,
    resetSelection,
    saveSelection,
    syncNow,
  } = useBookStackSyncManager();
  const [expandedBooks, setExpandedBooks] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const visibleExpandedBooks = expandedBooks.size > 0
    ? expandedBooks
    : new Set(books.slice(0, 3).map((book) => book.book_id));

  const totals = useMemo(() => {
    return books.reduce(
      (acc, book) => {
        acc.books += 1;
        acc.chapters += book.chapters.length;
        acc.pages += book.pages.length + book.chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0);
        return acc;
      },
      { books: 0, chapters: 0, pages: 0 },
    );
  }, [books]);

  const toggleBookExpanded = (bookId: number) => {
    setExpandedBooks((current) => {
      const next = new Set(current);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const toggleChapterExpanded = (chapterId: number) => {
    setExpandedChapters((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">{t("syncManagerTitle")}</h1>
          <p className="text-white/50">
            {t("syncManagerSubtitle")}
          </p>
        </div>
        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100">
          {t("sourceLabel", { key: sourceKey })}
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || notice}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <section className="flex-1 min-w-0 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-white/90">{t("hierarchy")}</h2>
              <p className="text-sm text-white/45 truncate">{t("hierarchyDesc")}</p>
            </div>
            <div className="shrink-0 text-right text-xs uppercase tracking-[0.18em] text-white/35">
              {t("selectionRatio", { selected: selectedPageCount, total: allPageCount })} <span className="hidden sm:inline">{t("pagesSelected")}</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/40">
              {t("loadingTree")}
            </div>
          ) : books.length === 0 ? (
            <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-white/40">
              {t("noBooksFound")}
            </div>
          ) : (
            <div className="grid gap-4">
              {books.map((book) => (
                <BookNode
                  key={book.book_id}
                  book={book}
                  selectedPageIds={selectedPageIds}
                  expanded={visibleExpandedBooks.has(book.book_id)}
                  expandedChapters={expandedChapters}
                  onToggleExpanded={() => toggleBookExpanded(book.book_id)}
                  onToggleChapterExpanded={toggleChapterExpanded}
                  onToggleBook={() => toggleBook(book)}
                  onToggleChapter={toggleChapter}
                  onTogglePage={togglePage}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="w-full lg:w-[320px] shrink-0 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-xl lg:sticky lg:top-8">
          <div className="mb-6">
            <h2 className="text-lg font-medium text-white/90">{t("syncControls")}</h2>
            <p className="text-sm text-white/45">
              {t("syncControlsDesc")}
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
              <div className="text-xs uppercase tracking-[0.18em] text-white/35">{t("totalBooks")}</div>
              <div className="mt-2 text-3xl font-light text-white">{totals.books}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
              <div className="text-xs uppercase tracking-[0.18em] text-white/35">{t("totalChapters")}</div>
              <div className="mt-2 text-3xl font-light text-white">{totals.chapters}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
              <div className="text-xs uppercase tracking-[0.18em] text-white/35">{t("totalPages")}</div>
              <div className="mt-2 text-3xl font-light text-white">{selectedPageCount}</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void saveSelection()}
              disabled={isLoading || isSaving || !dirty}
              className="w-full rounded-3xl bg-cyan-400/15 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? t("savingSelection") : t("saveSelection")}
            </button>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={isLoading || isSyncing}
              className="w-full rounded-3xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSyncing ? t("syncingNow") : t("syncNow")}
            </button>
            <button
              type="button"
              onClick={resetSelection}
              disabled={isLoading}
              className="w-full rounded-3xl border border-white/10 bg-transparent px-4 py-3 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("resetSelection")}
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">{t("selectionSemantics")}</div>
            <ul className="space-y-2">
              <li>{t("semanticsBook")}</li>
              <li>{t("semanticsChapter")}</li>
              <li>{t("semanticsPage")}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
