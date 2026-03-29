import { api } from "@/lib/api/client";

export interface BookStackTreePage {
  page_id: number;
  name: string;
}

export interface BookStackTreeChapter {
  chapter_id: number;
  name: string;
  pages: BookStackTreePage[];
}

export interface BookStackTreeBook {
  book_id: number;
  name: string;
  pages: BookStackTreePage[];
  chapters: BookStackTreeChapter[];
}

export interface BookStackTreeResponse {
  items: BookStackTreeBook[];
}

export interface BookStackSyncConfigResponse {
  source_key: string;
  selection_mode: "all" | "custom";
  enabled_book_ids: number[];
  enabled_chapter_ids: number[];
  enabled_page_ids: number[];
}

export interface BookStackSyncConfigRequest {
  enabled_book_ids: number[];
  enabled_chapter_ids: number[];
  enabled_page_ids: number[];
}

export const bookstackApi = {
  getTree: () => api.get<BookStackTreeResponse>("/api/v1/bookstack/tree"),

  getSyncConfig: () =>
    api.get<BookStackSyncConfigResponse>("/api/v1/bookstack/sync-config"),

  saveSyncConfig: (body: BookStackSyncConfigRequest) =>
    api.post<BookStackSyncConfigResponse>("/api/v1/bookstack/sync-config", body),
};
