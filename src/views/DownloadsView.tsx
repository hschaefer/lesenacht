import React, { useState, useEffect, useCallback } from 'react';
import { usePlayerStore } from '../store/useStore';
import { downloadService, type DownloadedBook } from '../services/downloadService';
import { 
  Trash2, 
  Headphones, 
  ArrowLeft,
  WifiOff,
  Clock,
  FileAudio,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CoverImage } from '../components/CoverImage';

interface DownloadsViewProps {
  onBack: () => void;
  onSelectBook: (ratingKey: string) => void;
}

export function DownloadsView({ onBack, onSelectBook }: DownloadsViewProps) {
  const { t } = useTranslation();
  const { downloadedTracks, removeDownloadedBook } = usePlayerStore();
  const [books, setBooks] = useState<DownloadedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    downloadService.isNative().then(setIsNative);
  }, []);

  const loadDownloads = useCallback(async () => {
    try {
      const downloadedBooks = await downloadService.getDownloadedBooks();
      setBooks(downloadedBooks);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads, downloadedTracks]);

  const handleDelete = async (book: DownloadedBook) => {
    if (deleteConfirm !== book.ratingKey) {
      setDeleteConfirm(book.ratingKey);
      // Auto-clear after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      const trackKeys = book.tracks.map(t => t.ratingKey);
      await downloadService.deleteBook(book.ratingKey);
      removeDownloadedBook(book.ratingKey, trackKeys);
      setBooks(prev => prev.filter(b => b.ratingKey !== book.ratingKey));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete book:', error);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Calculate total storage used
  const totalSize = books.reduce((sum, book) => sum + (book.totalSize || 0), 0);

  if (!isNative) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">Downloads Not Available</h2>
        <p className="text-ink-dim text-sm mb-6 max-w-xs">
          Offline downloads are only available in the Android app.
        </p>
        <button 
          onClick={onBack}
          className="px-6 py-2 glass rounded-full text-xs font-bold uppercase tracking-widest text-ink-dim"
        >
          {t('library.goBack')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 glass rounded-full flex items-center justify-center text-ink-dim hover:text-ink transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink">{t('downloads.title', 'Offline Library')}</h1>
            <p className="text-sm text-ink-dim">
              {books.length} {books.length === 1 ? 'book' : 'books'} • {formatSize(totalSize)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm">
          <WifiOff size={16} />
          <span className="font-medium">Offline Mode</span>
        </div>
      </header>

      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[40vh] text-center p-8">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <Headphones className="w-8 h-8 text-zinc-400" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">{t('downloads.empty', 'No Downloads')}</h2>
          <p className="text-ink-dim text-sm mb-6 max-w-xs">
            {t('downloads.emptyDesc', 'Download audiobooks to listen offline. Go to a book and tap the download button.')}
          </p>
          <button 
            onClick={onBack}
            className="px-6 py-2 accent-bg rounded-full text-xs font-bold uppercase tracking-widest text-white"
          >
            {t('library.browseBooks')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {books.map((book) => (
              <motion.div
                key={book.ratingKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="glass rounded-2xl p-4 flex items-center gap-4 group"
              >
                <button 
                  onClick={() => onSelectBook(book.ratingKey)}
                  className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                >
                  <CoverImage 
                    src={book.thumb} 
                    className="w-full h-full"
                    alt={book.title}
                    size={64}
                  />
                </button>

                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectBook(book.ratingKey)}
                >
                  <h3 className="font-bold text-ink truncate">{book.title}</h3>
                  <p className="text-sm text-ink-dim truncate">{book.parentTitle}</p>
                  <div className="flex items-center gap-3 text-xs text-ink-muted mt-1">
                    <span className="flex items-center gap-1">
                      <FileAudio size={12} />
                      {book.tracks.length} tracks
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDuration(book.tracks.reduce((sum, t) => sum + (t.duration || 0), 0))}
                    </span>
                    {book.totalSize && (
                      <span>{formatSize(book.totalSize)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-muted mt-1">
                    Downloaded {formatTime(book.downloadedAt)}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(book)}
                  className={`p-3 rounded-xl transition-all ${
                    deleteConfirm === book.ratingKey
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'text-ink-dim hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                  }`}
                  title={deleteConfirm === book.ratingKey ? 'Confirm delete' : 'Delete download'}
                >
                  <Trash2 size={20} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
