"use client";

import { env } from "@/lib/env";
import { api, ApiError } from "@/lib/api";
import { DOCUMENTS_ENDPOINT } from "@/lib/constants";
import { getPersistedAccessToken } from "@/domains/auth/model";
import type { ProblemDetail, UploadedDocument, UploadedDocumentListResponse } from "@/types";

function url(path: string): string {
  return `${env.apiBaseUrl}${path}`;
}

export async function listUploadedDocuments(): Promise<UploadedDocument[]> {
  const response = await api.get<UploadedDocumentListResponse>(`${DOCUMENTS_ENDPOINT}/`);
  return response.items;
}

interface UploadDocumentInput {
  file: File;
  title?: string;
  tags?: string[];
  onProgress?: (percent: number) => void;
}

export async function uploadDocument({
  file,
  title,
  tags = [],
  onProgress,
}: UploadDocumentInput): Promise<UploadedDocument> {
  const accessToken = getPersistedAccessToken();
  if (!accessToken) {
    throw new ApiError(401, {
      type: "https://httpstatuses.com/401",
      title: "Authentication required",
      detail: "Please sign in to upload documents.",
      status: 401,
    });
  }

  const formData = new FormData();
  formData.append("file", file);
  if (title?.trim()) {
    formData.append("title", title.trim());
  }
  if (tags.length > 0) {
    formData.append("tags", tags.join(","));
  }

  return new Promise<UploadedDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url(`${DOCUMENTS_ENDPOINT}/upload`));
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };

    xhr.onerror = () => {
      reject(
        new ApiError(0, {
          type: "about:blank",
          title: "Network error",
          detail: "Unable to upload the document right now.",
          status: 0,
        }),
      );
    };

    xhr.onload = () => {
      const status = xhr.status;
      const raw = xhr.responseText;
      if (status >= 200 && status < 300) {
        resolve(JSON.parse(raw) as UploadedDocument);
        return;
      }

      let problem: ProblemDetail;
      try {
        problem = JSON.parse(raw) as ProblemDetail;
      } catch {
        problem = {
          type: `https://httpstatuses.com/${status}`,
          title: xhr.statusText || "Upload failed",
          detail: raw || "The upload failed.",
          status,
        };
      }
      reject(new ApiError(status, problem));
    };

    xhr.send(formData);
  });
}
