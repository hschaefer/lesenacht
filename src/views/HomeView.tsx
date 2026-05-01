import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { downloadService, type DownloadedBook } from '../services/downloadService';
import { motion } from 'motion/react';
import { BookOpen, Clock, LogIn, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CoverImage } from '../components/CoverImage';

export function HomeView({
  onSelectBook,
  onSelectAuthor,
  onLogin,
  onShowDownloads
}: {
  onSelectBook: (key: string) => void;
  onSelectAuthor?: (key: string) => void;
  onLogin?: () => void;
  onShowDownloads?: () => void;
}) {
  const { t } = useTranslation();
  const { authToken, selectedServer, selectedLibrary } = useAuthStore();
  const effectiveToken = selectedServer?.accessToken || authToken;
  const { progressMap, lastTrackByBook, isNetworkConnected } = usePlayerStore();
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [downloadedBooks, setDownloadedBooks] = useState<DownloadedBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    downloadService.isNative().then(native => {
      if (native) {
        downloadService.getDownloadedBooks().then(setDownloadedBooks).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (effectiveToken && selectedServer && selectedLibrary) {
      const connections = selectedServer?.connections || [];
      const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
      
      if (!baseUrl) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      plexService.getLibraryItems(baseUrl, selectedLibrary.key, effectiveToken)
        .then(items => {
          setAllBooks(items || []);
          setLoading(false);
        })
        .catch(async (err) => {
          console.error(err);
          try {
            const offline = await downloadService.getDownloadedBooks();
            setDownloadedBooks(offline);
          } catch {}
          setLoading(false);
        });
    } else if (!effectiveToken || !selectedLibrary) {
      setLoading(false);
    }
  }, [effectiveToken, selectedServer, selectedLibrary]);

  const effectiveBooks = useMemo(() => {
    if (allBooks.length > 0) return allBooks;
    return downloadedBooks.map(b => ({
      ratingKey: b.ratingKey,
      title: b.title,
      parentTitle: b.parentTitle,
      thumb: b.thumb,
      addedAt: b.downloadedAt,
      parentRatingKey: undefined as string | undefined,
    }));
  }, [allBooks, downloadedBooks]);

  const continueListening = useMemo(() => {
    // Get books that have local progress
    return effectiveBooks
      .filter(book => {
        const lastTrackKey = lastTrackByBook[book.ratingKey];
        if (!lastTrackKey) return false;
        
        const progress = progressMap[lastTrackKey];
        if (!progress || progress.time <= 0) return false;
        
        const percent = (progress.time / progress.duration) * 100;
        return percent < 95;
      })
      .sort((a, b) => {
        const lastTrackKeyA = lastTrackByBook[a.ratingKey];
        const lastTrackKeyB = lastTrackByBook[b.ratingKey];
        const timeA = progressMap[lastTrackKeyA || '']?.time || 0;
        const timeB = progressMap[lastTrackKeyB || '']?.time || 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [effectiveBooks, progressMap, lastTrackByBook]);

  const recentlyAdded = useMemo(() => {
    return [...effectiveBooks]
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .filter(b => !continueListening.find(cb => cb.ratingKey === b.ratingKey))
      .slice(0, 10);
  }, [effectiveBooks, continueListening]);

  if (!authToken || !selectedLibrary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 px-4">
        <div className="w-24 h-24 glass rounded-[32px] flex items-center justify-center text-accent/80 mb-2 relative overflow-hidden group">
          <BookOpen size={48} className="relative z-10 transition-transform group-hover:scale-110" />
          <div className="absolute inset-0 bg-accent/10 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-ink">{t('home.welcomeTo')}</h2>
          <p className="text-ink-dim text-sm max-w-[280px] mx-auto leading-relaxed">
            {!authToken 
              ? t('home.signInPromptPlex') 
              : t('home.signInPromptSelection')}
          </p>
        </div>
        
        {!authToken ? (
          <button 
            onClick={onLogin}
            className="w-full max-w-[280px] py-4 px-6 accent-bg hover:opacity-90 active:scale-95 text-white rounded-2xl font-bold transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 mt-4"
          >
            <LogIn size={20} />
            {t('settings.auth.loginWithPlex')}
          </button>
        ) : (
          <p className="text-accent text-[10px] uppercase tracking-[0.2em] font-bold mt-4 animate-pulse">
            {t('home.startListening')}
          </p>
        )}
      </div>
    );
  }

  const baseUrl = selectedServer?.connections?.find((c: any) => !c.local)?.uri || selectedServer?.connections?.[0]?.uri;

  const isOffline = !isNetworkConnected && downloadedBooks.length > 0;

  return (
    <div className="space-y-8 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">{t('home.title')}</h1>
          <p className="text-ink-dim text-[10px] mt-1 uppercase tracking-widest font-bold">{t('home.subtitle')}</p>
        </div>
        {isOffline && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold">
            <WifiOff size={13} />
            <span>Offline</span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="space-y-6">
          <div className="animate-pulse h-48 glass rounded-3xl" />
          <div className="animate-pulse h-64 glass rounded-3xl" />
        </div>
      ) : (
        <>
          {continueListening.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
                <Clock size={16} /> {t('home.continue')} <span className="w-1.5 h-1.5 rounded-full accent-bg animate-pulse"></span>
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                {continueListening.map(book => (
                  <BookCard 
                    key={book.ratingKey} 
                    book={book} 
                    baseUrl={baseUrl || ''} 
                    authToken={effectiveToken!} 
                    onClick={() => onSelectBook(book.ratingKey)}
                    onSelectAuthor={onSelectAuthor}
                    large
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim">{t('home.recentlyAdded')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {recentlyAdded.map(book => (
                <BookCard 
                  key={book.ratingKey} 
                  book={book} 
                  baseUrl={baseUrl || ''} 
                  authToken={effectiveToken!} 
                  onClick={() => onSelectBook(book.ratingKey)}
                  onSelectAuthor={onSelectAuthor}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BookCard({ 
  book, 
  baseUrl, 
  authToken, 
  onClick, 
  onSelectAuthor,
  large 
}: { 
  book: any; 
  baseUrl: string; 
  authToken: string; 
  onClick: () => void; 
  onSelectAuthor?: (key: string) => void;
  large?: boolean;
  key?: any;
}) {
  const { progressMap, lastTrackByBook } = usePlayerStore();
  const thumbUrl = plexService.getThumbUrl(baseUrl, book.thumb, authToken, large ? 400 : 300, large ? 400 : 300);

  // Calculate progress percentage
  const lastTrackKey = lastTrackByBook[book.ratingKey];
  const progressData = lastTrackKey ? progressMap[lastTrackKey] : null;
  const progressPercent = progressData && progressData.duration > 0 
    ? (progressData.time / progressData.duration) * 100 
    : 0;

  return (
    <motion.div 
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${large ? 'w-64 flex-shrink-0' : 'w-full'} group cursor-pointer`}
    >
      <div className={`relative aspect-square rounded-2xl overflow-hidden shadow-2xl book-card transition-transform group-hover:scale-[1.02] ${large ? 'ring-offset-2 ring-offset-bg ring-accent/20' : ''}`}>
        <CoverImage 
          src={thumbUrl} 
          alt={book.title}
          className="w-full h-full shadow-lg"
          size={large ? 40 : 32}
        />
        
        {/* Progress bar overlay for in-progress books */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 backdrop-blur-sm">
            <div 
              className="h-full accent-bg transition-all duration-500 ease-out" 
              style={{ width: `${Math.max(2, progressPercent)}%` }}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <BookOpen className="text-white" size={20} />
        </div>
      </div>
      <div className="mt-3 pr-4">
        {/* Audiobook Title is now book.title (Album Name) */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-ink line-clamp-1 break-all flex-1">{book.title}</h3>
          {progressPercent > 0 && (
            <span className="text-[10px] accent-text font-bold whitespace-nowrap ml-1">
              {Math.floor(progressPercent)}%
            </span>
          )}
        </div>
        {/* Author name is book.parentTitle (Artist Name) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (book.parentRatingKey) onSelectAuthor?.(book.parentRatingKey);
          }}
          className="text-xs text-ink-dim line-clamp-1 break-all hover:accent-text transition-colors text-left"
        >
          {book.parentTitle || 'Unknown Author'}
        </button>
      </div>
    </motion.div>
  );
}
