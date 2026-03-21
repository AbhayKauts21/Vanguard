import { useState, useCallback, useEffect } from "react";
import { adminApi, SyncStatusResponse, SyncTriggerResponse } from "../api/adminApi";

export function useAdminSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await adminApi.getSyncStatus();
      setSyncStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch sync status");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const triggerFullSync = async (): Promise<SyncTriggerResponse> => {
    setIsTriggering(true);
    try {
      const res = await adminApi.triggerFullSync();
      fetchStatus();
      return res;
    } catch (err: any) {
      throw new Error(err.message || "Full sync failed");
    } finally {
      setIsTriggering(false);
    }
  };

  const triggerPageSync = async (pageId: number): Promise<SyncTriggerResponse> => {
    setIsTriggering(true);
    try {
      const res = await adminApi.triggerPageSync(pageId);
      fetchStatus();
      return res;
    } catch (err: any) {
      throw new Error(err.message || `Sync for page ${pageId} failed`);
    } finally {
      setIsTriggering(false);
    }
  };

  return {
    syncStatus,
    isRefreshing,
    isTriggering,
    error,
    fetchStatus,
    triggerFullSync,
    triggerPageSync,
  };
}
