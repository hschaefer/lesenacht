import React, { useState, useEffect } from 'react';
import { Download, Trash2, Check, X, Loader2 } from 'lucide-react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { downloadService, syncDownloadsToStore } from '../services/downloadService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DownloadButtonProps {
  book: {
    ratingKey: string;
    title: string;
    parentTitle: string;
    thumb?: string;
    summary?: string;
  };
  tracks: any[];
  className?: string;
}

export function DownloadButton({ book, tracks, className }: DownloadButtonProps) {
  const { selectedServer, authToken } = useAuthStore();
  const {
    activeDownloads,
    downloadedTracks,
    setDownloadProgress,
    clearDownloadProgress,
  } = usePlayerStore();

  const [isNative, setIsNative] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const downloadProgress = activeDownloads[book.ratingKey];
  const isDownloading = downloadProgress?.status === 'downloading';

  useEffect(() => {
    downloadService.isNative().then(setIsNative);
  }, []);

  useEffect(() => {
    // Check if all tracks are downloaded
    const allDownloaded = tracks.length > 0 && tracks.every(
      track => downloadedTracks[track.ratingKey]
    );
    setIsDownloaded(allDownloaded);
  }, [tracks, downloadedTracks]);

  const handleDownload = async () => {
    if (!selectedServer || !authToken || isDownloading) return;

    const connections = selectedServer?.connections || [];
    const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
    if (!baseUrl) return;

    const token = selectedServer?.accessToken || authToken;

    setDownloadProgress(book.ratingKey, {
      bookKey: book.ratingKey,
      trackIndex: 0,
      totalTracks: tracks.length,
      progress: 0,
      status: 'downloading',
    });

    try {
      const downloadedBook = await downloadService.downloadBook(
        baseUrl,
        token,
        book,
        tracks,
        (trackIndex, totalTracks, progress) => {
          setDownloadProgress(book.ratingKey, {
            bookKey: book.ratingKey,
            trackIndex,
            totalTracks,
            progress,
            status: 'downloading',
          });
        }
      );

      // Sync Zustand store from Preferences (single source of truth)
      await syncDownloadsToStore();

      setDownloadProgress(book.ratingKey, {
        bookKey: book.ratingKey,
        trackIndex: tracks.length,
        totalTracks: tracks.length,
        progress: 100,
        status: 'completed',
      });

      // Clear after a delay
      setTimeout(() => {
        clearDownloadProgress(book.ratingKey);
      }, 3000);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadProgress(book.ratingKey, {
        bookKey: book.ratingKey,
        trackIndex: 0,
        totalTracks: tracks.length,
        progress: 0,
        status: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }

    try {
      await downloadService.deleteBook(book.ratingKey);
      await syncDownloadsToStore();
      setIsDownloaded(false);
    } catch (error) {
      console.error('Failed to delete download:', error);
    }
    setShowConfirmDelete(false);
  };

  // Don't show on web (non-native)
  if (!isNative) {
    return null;
  }

  const progressPercent = isDownloading
    ? Math.round(((downloadProgress.trackIndex + downloadProgress.progress / 100) / downloadProgress.totalTracks) * 100)
    : 0;

  if (isDownloaded) {
    return (
      <button
        onClick={handleDelete}
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95 border",
          showConfirmDelete
            ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
            : "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20",
          className
        )}
        title={showConfirmDelete ? "Confirm delete" : "Delete download"}
      >
        {showConfirmDelete ? (
          <><Trash2 className="w-4 h-4" /><span>Confirm delete</span></>
        ) : (
          <><Check className="w-4 h-4" /><span>Saved Offline</span></>
        )}
      </button>
    );
  }

  if (isDownloading) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm border bg-white/5 border-white/10 text-ink-dim",
        className
      )}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>{downloadProgress.trackIndex + 1}/{downloadProgress.totalTracks} ({progressPercent}%)</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={!selectedServer || tracks.length === 0}
      className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all hover:scale-105 active:scale-95",
        "border border-white/10 bg-white/5 text-ink-dim hover:text-ink hover:bg-white/10",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        className
      )}
    >
      <Download className="w-4 h-4" />
      <span>Save Offline</span>
    </button>
  );
}
