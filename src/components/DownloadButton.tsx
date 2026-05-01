import React, { useState, useEffect } from 'react';
import { Download, Trash2, Check, X, Loader2 } from 'lucide-react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { downloadService } from '../services/downloadService';
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
    addDownloadedTrack,
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

      // Add all tracks to downloaded tracks
      for (const track of downloadedBook.tracks) {
        addDownloadedTrack(track.ratingKey, {
          ratingKey: track.ratingKey,
          localPath: track.localPath,
          downloadedAt: track.downloadedAt,
        });
      }

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
      const trackKeys = tracks.map(t => t.ratingKey);
      await downloadService.deleteBook(book.ratingKey);
      usePlayerStore.getState().removeDownloadedBook(book.ratingKey, trackKeys);
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
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm">
          <Check className="w-4 h-4" />
          <span>Downloaded</span>
        </div>
        <button
          onClick={handleDelete}
          className={cn(
            "p-2 rounded-lg transition-colors",
            showConfirmDelete
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "hover:bg-zinc-100 text-zinc-500 dark:hover:bg-zinc-800 dark:text-zinc-400"
          )}
          title={showConfirmDelete ? "Confirm delete" : "Delete download"}
        >
          {showConfirmDelete ? (
            <X className="w-4 h-4" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  if (isDownloading) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            Downloading {downloadProgress.trackIndex + 1}/{downloadProgress.totalTracks} ({progressPercent}%)
          </span>
        </div>
        <button
          onClick={() => {
            // Cancel not implemented - would need AbortController
            clearDownloadProgress(book.ratingKey);
          }}
          className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 dark:hover:bg-zinc-800 dark:text-zinc-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={!selectedServer || tracks.length === 0}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <Download className="w-4 h-4" />
      <span>Download for offline</span>
    </button>
  );
}
