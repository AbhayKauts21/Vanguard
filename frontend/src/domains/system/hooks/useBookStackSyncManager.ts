import { useCallback, useEffect, useMemo, useState } from "react";

import { adminApi } from "../api/adminApi";
import {
  bookstackApi,
  type BookStackTreeBook,
  type BookStackTreeChapter,
  type BookStackSyncConfigResponse,
} from "../api/bookstackApi";

function collectChapterPageIds(chapter: BookStackTreeChapter): number[] {
  return chapter.pages.map((page) => page.page_id);
}

function collectBookPageIds(book: BookStackTreeBook): number[] {
  return [
    ...book.pages.map((page) => page.page_id),
    ...book.chapters.flatMap((chapter) => collectChapterPageIds(chapter)),
  ];
}

function expandSelection(config: BookStackSyncConfigResponse, books: BookStackTreeBook[]): Set<number> {
  const selected = new Set<number>();
  if (config.selection_mode === "all") {
    books.flatMap((book) => collectBookPageIds(book)).forEach((pageId) => selected.add(pageId));
    return selected;
  }

  const enabledBooks = new Set(config.enabled_book_ids);
  const enabledChapters = new Set(config.enabled_chapter_ids);
  const enabledPages = new Set(config.enabled_page_ids);

  books.forEach((book) => {
    if (enabledBooks.has(book.book_id)) {
      collectBookPageIds(book).forEach((pageId) => selected.add(pageId));
      return;
    }

    book.pages.forEach((page) => {
      if (enabledPages.has(page.page_id)) {
        selected.add(page.page_id);
      }
    });

    book.chapters.forEach((chapter) => {
      if (enabledChapters.has(chapter.chapter_id)) {
        collectChapterPageIds(chapter).forEach((pageId) => selected.add(pageId));
        return;
      }

      chapter.pages.forEach((page) => {
        if (enabledPages.has(page.page_id)) {
          selected.add(page.page_id);
        }
      });
    });
  });

  return selected;
}

function compressSelection(books: BookStackTreeBook[], selectedPageIds: Set<number>) {
  const enabledBookIds = new Set<number>();
  const enabledChapterIds = new Set<number>();
  const enabledPageIds = new Set<number>();

  books.forEach((book) => {
    const bookPageIds = collectBookPageIds(book);
    const isWholeBookSelected = bookPageIds.length > 0 && bookPageIds.every((pageId) => selectedPageIds.has(pageId));
    if (isWholeBookSelected) {
      enabledBookIds.add(book.book_id);
      return;
    }

    book.pages.forEach((page) => {
      if (selectedPageIds.has(page.page_id)) {
        enabledPageIds.add(page.page_id);
      }
    });

    book.chapters.forEach((chapter) => {
      const chapterPageIds = collectChapterPageIds(chapter);
      const isWholeChapterSelected =
        chapterPageIds.length > 0 && chapterPageIds.every((pageId) => selectedPageIds.has(pageId));

      if (isWholeChapterSelected) {
        enabledChapterIds.add(chapter.chapter_id);
        return;
      }

      chapter.pages.forEach((page) => {
        if (selectedPageIds.has(page.page_id)) {
          enabledPageIds.add(page.page_id);
        }
      });
    });
  });

  return {
    enabled_book_ids: [...enabledBookIds].sort((a, b) => a - b),
    enabled_chapter_ids: [...enabledChapterIds].sort((a, b) => a - b),
    enabled_page_ids: [...enabledPageIds].sort((a, b) => a - b),
  };
}

export function useBookStackSyncManager() {
  const [books, setBooks] = useState<BookStackTreeBook[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set());
  const [savedPageIds, setSavedPageIds] = useState<Set<number>>(new Set());
  const [sourceKey, setSourceKey] = useState("bookstack_default");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tree, config] = await Promise.all([
        bookstackApi.getTree(),
        bookstackApi.getSyncConfig(),
      ]);
      const selected = expandSelection(config, tree.items);
      setBooks(tree.items);
      setSelectedPageIds(selected);
      setSavedPageIds(new Set(selected));
      setSourceKey(config.source_key);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load BookStack sync data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allPageCount = useMemo(
    () => books.reduce((count, book) => count + collectBookPageIds(book).length, 0),
    [books],
  );

  const selectedPageCount = selectedPageIds.size;
  const dirty = useMemo(() => {
    if (selectedPageIds.size !== savedPageIds.size) {
      return true;
    }
    for (const pageId of selectedPageIds) {
      if (!savedPageIds.has(pageId)) {
        return true;
      }
    }
    return false;
  }, [savedPageIds, selectedPageIds]);

  const setPageSelection = useCallback((pageIds: number[], checked: boolean) => {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      pageIds.forEach((pageId) => {
        if (checked) {
          next.add(pageId);
        } else {
          next.delete(pageId);
        }
      });
      return next;
    });
  }, []);

  const toggleBook = useCallback((book: BookStackTreeBook) => {
    const bookPageIds = collectBookPageIds(book);
    const shouldSelect = bookPageIds.some((pageId) => !selectedPageIds.has(pageId));
    setPageSelection(bookPageIds, shouldSelect);
  }, [selectedPageIds, setPageSelection]);

  const toggleChapter = useCallback((chapter: BookStackTreeChapter) => {
    const chapterPageIds = collectChapterPageIds(chapter);
    const shouldSelect = chapterPageIds.some((pageId) => !selectedPageIds.has(pageId));
    setPageSelection(chapterPageIds, shouldSelect);
  }, [selectedPageIds, setPageSelection]);

  const togglePage = useCallback((pageId: number) => {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedPageIds(new Set(savedPageIds));
    setNotice("Selection reset to the last saved state.");
  }, [savedPageIds]);

  const saveSelection = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload = compressSelection(books, selectedPageIds);
      const response = await bookstackApi.saveSyncConfig(payload);
      const savedSelection = expandSelection(response, books);
      setSavedPageIds(new Set(savedSelection));
      setSelectedPageIds(new Set(savedSelection));
      setSourceKey(response.source_key);
      setNotice("Sync scope saved successfully.");
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save sync scope";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [books, selectedPageIds]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await adminApi.triggerFullSync();
      setNotice(`Sync finished with status: ${result.status}`);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to trigger sync";
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
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
    load,
    toggleBook,
    toggleChapter,
    togglePage,
    resetSelection,
    saveSelection,
    syncNow,
  };
}

export { collectBookPageIds, collectChapterPageIds };
