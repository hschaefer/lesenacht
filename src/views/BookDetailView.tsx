import React, { useState, useEffect } from 'react';
import { plexService } from '../services/plexService';
import { useAuthStore, usePlayerStore } from '../store/useStore';
import { 
  ChevronLeft, 
  Play, 
    Pause,
  Clock, 
  MoreVertical, 
  BookOpen, 
  ListMusic,
  CheckCircle2,
  RotateCcw,
  Info,
  Bookmark,
  Trash2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CoverImage } from '../components/CoverImage';
import { DownloadButton } from '../components/DownloadButton';
import { downloadService } from '../services/downloadService';

export function BookDetailView({ 
  ratingKey, 
  onBack,
  onSelectAuthor
}: { 
  ratingKey: string; 
  onBack: () => void; 
  onSelectAuthor?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const { authToken, selectedServer } = useAuthStore();
  const effectiveToken = selectedServer?.accessToken || authToken;
  const { 
    setCurrentBook, 
    setCurrentTrack, 
    setPlaying, 
    currentBook,
    currentTrack, 
    isPlaying, 
    progressMap, 
    lastTrackByBook,
    resetProgress,
    markAsFinished,
    bookmarks,
    removeBookmark
  } = usePlayerStore();
  const [book, setBook] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [trackChapters, setTrackChapters] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBook = async () => {
      setLoading(true);

      // First, always try to load from offline/downloads (works offline)
      try {
        const offlineBooks = await downloadService.getDownloadedBooks();
        const offlineBook = offlineBooks.find(b => b.ratingKey === ratingKey);
        if (offlineBook && isMounted) {
          // Resolve local cover image path to WebView-usable URL if available
          let thumbUrl = offlineBook.thumb || '';
          if (offlineBook.localThumb) {
            try {
              thumbUrl = await downloadService.getLocalFileUrl(offlineBook.localThumb);
            } catch (e) {
              console.warn('Failed to resolve local thumb URL:', e);
            }
          }

          setBook({
            ratingKey: offlineBook.ratingKey,
            title: offlineBook.title,
            parentTitle: offlineBook.parentTitle,
            parentRatingKey: '',
            thumb: thumbUrl,
            summary: offlineBook.summary || '',
          });
          setTracks(offlineBook.tracks.map(t => ({
            ratingKey: t.ratingKey,
            title: t.title,
            duration: t.duration,
            index: t.index,
            parentTitle: offlineBook.title,
            grandparentTitle: offlineBook.parentTitle,
            Media: [],
          })));
          setLoading(false);
          return; // Book found offline, no need to fetch from server
        }
      } catch (offlineErr) {
        console.error('Failed to load offline book:', offlineErr);
      }

      // Not found offline, try to fetch from server (requires auth)
      if (!effectiveToken || !selectedServer) {
        if (isMounted) {
          setBook(null);
          setLoading(false);
        }
        return;
      }

      const connections = selectedServer?.connections || [];
      const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;

      if (!baseUrl) {
        if (isMounted) {
          setBook(null);
          setLoading(false);
        }
        return;
      }

      try {
        // Fetch tracks
        const metadata = await plexService.getItemDetails(baseUrl, ratingKey, effectiveToken);
        // Fetch album/book metadata specifically for the summary
        const bookMeta = await plexService.getItemMetadata(baseUrl, ratingKey, effectiveToken);

        if (!isMounted) return;

        setTracks(metadata);

        if (bookMeta) {
          setBook({
            ratingKey: ratingKey,
            title: bookMeta.title || 'Unknown Title',
            parentTitle: bookMeta.parentTitle || 'Unknown Author',
            parentRatingKey: bookMeta.parentRatingKey || '',
            thumb: bookMeta.thumb || '',
            summary: bookMeta.summary || ''
          });

          // If there's only one track, fetch its chapters immediately
          if (metadata.length === 1) {
            plexService.getTrackMetadata(baseUrl, metadata[0].ratingKey, effectiveToken)
              .then(trackMeta => {
                if (trackMeta?.Chapter && isMounted) {
                  setTrackChapters({ [metadata[0].ratingKey]: trackMeta.Chapter });
                }
              });
          }
        } else if (metadata && metadata.length > 0) {
          // Fallback to track data if metadata fetch fails
          setBook({
            ratingKey: ratingKey,
            title: metadata[0]?.parentTitle || metadata[0]?.title || 'Unknown Title',
            parentTitle: metadata[0]?.grandparentTitle || 'Unknown Author',
            parentRatingKey: metadata[0]?.grandparentRatingKey || '',
            thumb: metadata[0]?.parentThumb || metadata[0]?.thumb || '',
            summary: metadata[0]?.summary || ''
          });
        } else {
          setBook(null);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch book from server:', err);
        if (isMounted) {
          setBook(null);
          setLoading(false);
        }
      }
    };

    loadBook();

    return () => {
      isMounted = false;
    };
  }, [ratingKey, effectiveToken, selectedServer]);

  const handlePlayTrack = (track: any, startTime = 0) => {
    setCurrentBook(book);
    setCurrentTrack(track);
    if (startTime > 0) {
      usePlayerStore.getState().setCurrentTime(startTime);
    }
    setPlaying(true);
  };

  const handleDownload = () => {
    if (!tracks || tracks.length === 0 || !baseUrl || !effectiveToken) return;
    
    tracks.forEach((track, index) => {
      const partKey = track.Media?.[0]?.Part?.[0]?.key;
      if (partKey) {
        const downloadUrl = plexService.getDownloadUrl(baseUrl, partKey, effectiveToken);
        // Delay slightly between downloads to prevent browser from blocking multiple downloads
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, index * 500);
      }
    });
    setIsMenuOpen(false);
  };

  const handleToggleComplete = () => {
    if (!book || tracks.length === 0) return;
    
    if (isFinished) {
      resetProgress(book.ratingKey);
    } else {
      // Mark as finished: set last track progress to duration
      const lastTrack = tracks[tracks.length - 1];
      markAsFinished(book.ratingKey, lastTrack.ratingKey, lastTrack.duration / 1000);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent"></div>
    </div>
  );

  if (!book) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
      <div className="text-ink-muted mb-4 opacity-20"><BookOpen size={64} /></div>
      <h2 className="text-xl font-bold text-ink mb-2">{t('library.bookNotFound')}</h2>
      <p className="text-ink-dim text-sm mb-6">{t('library.retrieveDetailsError')}</p>
      <button onClick={onBack} className="px-6 py-2 glass rounded-full text-xs font-bold uppercase tracking-widest text-ink-dim">{t('library.goBack')}</button>
    </div>
  );

  const lastTrackKey = lastTrackByBook[book.ratingKey];
  const progressData = lastTrackKey ? progressMap[lastTrackKey] : null;
  const progressPercent = progressData && progressData.duration > 0 
    ? (progressData.time / progressData.duration) * 100 
    : 0;
  const isFinished = progressPercent >= 95;
  const hasProgress = !!progressData && progressData.time > 0;

  const isThisBookLoaded = !!currentBook && currentBook.ratingKey === book.ratingKey;
  const isThisBookPlaying = isThisBookLoaded && isPlaying;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePrimaryAction = () => {
    if (!tracks || tracks.length === 0) return;

    // If this book is already loaded, toggle play/pause without changing track.
    if (isThisBookLoaded) {
      setPlaying(!isPlaying);
      return;
    }

    const lastTrackKeyForBook = lastTrackByBook[book.ratingKey];
    const trackToPlay =
      hasProgress && lastTrackKeyForBook
        ? tracks.find((t: any) => t.ratingKey === lastTrackKeyForBook) || tracks[0]
        : tracks[0];

    // setCurrentTrack() already restores saved time for the chosen track.
    handlePlayTrack(trackToPlay);
  };

  const connections = selectedServer?.connections || [];
  const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
  const thumbUrl = (baseUrl && book?.thumb) ? plexService.getThumbUrl(baseUrl, book.thumb, effectiveToken!, 600, 600) : null;

  return (
    <div className="space-y-6 pb-20 overflow-x-hidden">
      <header className="flex items-center justify-between relative">
        <button onClick={onBack} className="w-10 h-10 glass rounded-full flex items-center justify-center text-ink-dim hover:text-ink transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex gap-2">
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-10 h-10 glass rounded-full flex items-center justify-center transition-colors ${isMenuOpen ? 'text-accent' : 'text-ink-dim hover:text-ink'}`}
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-48 glass rounded-2xl shadow-2xl z-50 p-2"
                >
                  <button 
                    onClick={() => {
                      if (book?.parentRatingKey) onSelectAuthor?.(book.parentRatingKey);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-ink-dim hover:text-ink hover:bg-ink/5 rounded-xl transition-colors"
                  >
                    <Info size={16} /> {t('library.goToAuthor')}
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-ink-dim hover:text-ink hover:bg-ink/5 rounded-xl transition-colors"
                  >
                    <Download size={16} /> {t('library.exportFiles')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row md:items-start md:text-left gap-8 px-4" onClick={() => setIsMenuOpen(false)}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-56 h-56 md:w-64 md:h-64 rounded-[40px] overflow-hidden shadow-2xl book-card flex-shrink-0 mx-auto md:mx-0"
        >
          <CoverImage 
            src={thumbUrl} 
            className="w-full h-full" 
            alt={book.title} 
            size={64}
          />
        </motion.div>
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-ink">{book.title}</h1>
            <button 
              onClick={() => book?.parentRatingKey && onSelectAuthor?.(book.parentRatingKey)}
              className="accent-text font-bold uppercase tracking-widest text-xs mt-1 hover:brightness-125 transition-all"
            >
              {book.parentTitle}
            </button>
          </div>

          {/* Progress Display */}
          {hasProgress && (
            <div className="w-full max-w-xs mx-auto md:mx-0 space-y-2">
              <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest">
                <span className="text-ink-dim dark:text-ink-muted">{t('library.progress')}</span>
                <span className="accent-text">{Math.floor(progressPercent)}%</span>
              </div>
              <div className="w-full progress-track">
                <div 
                  className="h-full accent-bg shadow-[0_0_8px_rgba(234,88,12,0.4)] transition-all duration-700" 
                  style={{ width: `${Math.max(2, progressPercent)}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-ink-dim dark:text-ink-muted flex justify-between">
                <span>{formatTime(progressData?.time || 0)}</span>
                <span>{formatTime(progressData?.duration || 0)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start">
            <button 
              onClick={handlePrimaryAction}
              className="px-8 py-3 accent-bg rounded-full font-bold text-white shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {isThisBookPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
              {isThisBookPlaying
                ? t('library.pause')
                : (hasProgress ? t('library.continue') : t('library.listenNow'))}
            </button>
            
            {(hasProgress || isFinished) && (
              <button
                onClick={handleToggleComplete}
                className={`p-3 rounded-full font-bold transition-all flex items-center gap-2 border ${
                  isFinished
                  ? 'bg-white/5 border-white/10 text-ink-muted hover:text-ink'
                  : 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20'
                }`}
                title={isFinished ? t('library.markAsUnread') : t('library.markAsFinished')}
              >
                {isFinished ? <RotateCcw size={20} /> : <CheckCircle2 size={20} />}
                <span className="text-xs uppercase tracking-widest">{isFinished ? t('library.reset') : t('library.finish')}</span>
              </button>
            )}

            {book && tracks.length > 0 && (
              <DownloadButton book={book} tracks={tracks} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Description / Summary Section */}
          {book.summary && (
            <section className="glass rounded-3xl p-6 space-y-3">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
                <span className="flex items-center gap-2"><Info size={16} /> {t('library.summary')}</span>
              </h3>
              <p className="text-sm text-ink-dim leading-relaxed text-left">
                {book.summary}
              </p>
            </section>
          )}

          {/* Bookmarks Section */}
          {bookmarks.some(b => tracks.some(t => t.ratingKey === b.trackKey)) && (
            <section className="glass rounded-3xl p-6">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-muted mb-4 flex items-center gap-2">
                <Bookmark size={16} /> {t('library.bookmarks')}
              </h3>
              <div className="space-y-2">
                {bookmarks
                  .filter(b => tracks.some(t => t.ratingKey === b.trackKey))
                  .sort((a, b) => b.date - a.date)
                  .map((bookmark) => {
                    const track = tracks.find(t => t.ratingKey === bookmark.trackKey);
                    return (
                      <div 
                        key={`${bookmark.trackKey}-${bookmark.date}`}
                        className="flex items-center justify-between p-3 rounded-xl glass group border border-white/5 hover:border-accent/20 transition-all"
                      >
                        <button 
                          onClick={() => handlePlayTrack(track, bookmark.time)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm font-medium text-ink-dim group-hover:text-ink transition-colors">
                            {bookmark.label || `${t('player.bookmarks')} at ${formatTime(bookmark.time)}`}
                          </p>
                          <p className="text-[10px] text-ink-muted font-mono mt-1 flex items-center gap-2">
                            {track?.title} • {formatTime(bookmark.time)}
                          </p>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBookmark(bookmark.trackKey, bookmark.date);
                          }}
                          className="p-2 text-ink-muted hover:text-red-400 opacity-40 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>

        <section className="glass rounded-3xl p-6 h-fit">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-muted mb-3 flex items-center gap-2">
            <ListMusic size={16} /> {t('library.trackList')}
          </h3>
          <div className="space-y-1">
            {tracks.map((track, i) => {
              const isActive = currentTrack?.ratingKey === track.ratingKey;
              const trackProgress = progressMap[track.ratingKey];
              const trackPercent = trackProgress && trackProgress.duration > 0 
                ? (trackProgress.time / trackProgress.duration) * 100 
                : 0;
              const chapters = trackChapters[track.ratingKey] || [];

              return (
                <div key={track.ratingKey} className="space-y-1">
                  <button
                    onClick={() => handlePlayTrack(track)}
                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-colors text-left group ${isActive ? 'bg-accent/10' : 'hover:bg-ink/5'}`}
                  >
                    <div className="relative">
                      <span className={`text-xs font-mono w-6 text-right block ${isActive ? 'accent-text' : 'text-ink-muted'}`}>
                        {(i + 1).toString().padStart(2, '0')}
                      </span>
                      {trackPercent >= 95 && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-bg shadow-sm" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium truncate ${isActive ? 'accent-text' : 'text-ink group-hover:text-ink shadow-sm shadow-transparent'}`}>
                        {track.title}
                      </h4>
                      <p className="text-[10px] text-ink-muted uppercase font-bold tracking-widest flex items-center gap-1">
                        <Clock size={10} /> {Math.floor(track.duration / 60000)} {t('library.min')}
                        {trackPercent > 0 && trackPercent < 95 && (
                          <span className="ml-2 accent-text font-mono truncate">{Math.floor(trackPercent)}%</span>
                        )}
                        {chapters.length > 0 && (
                          <span className="ml-2 text-ink-muted truncate">• {t('library.chaptersCount', { count: chapters.length })}</span>
                        )}
                      </p>
                    </div>
                    {isActive && isPlaying && (
                      <div className="flex gap-0.5 h-3 items-end">
                        {[1,2,3].map(bar => (
                          <motion.div 
                            key={bar}
                            animate={{ height: ['20%', '100%', '20%'] }}
                            transition={{ repeat: Infinity, duration: 0.5 + bar*0.1 }}
                            className="w-1 accent-bg rounded-full"
                          />
                        ))}
                      </div>
                    )}
                  </button>

                  {/* Internal Chapters if visible */}
                  {chapters.length > 0 && (
                    <div className="pl-12 pr-4 py-2 space-y-1 border-l border-white/5 ml-3">
                      {chapters.map((chapter, idx) => {
                        const startTime = (chapter.startTimeOffset || chapter.start || 0) / 1000;
                        return (
                          <button
                            key={`${track.ratingKey}-ch-${idx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayTrack(track, startTime);
                            }}
                            className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-ink/5 transition-colors text-left group/ch"
                          >
                            <span className="text-[10px] text-ink-muted font-mono truncate mr-2 group-hover/ch:text-ink-dim transition-colors">
                              {chapter.tag || chapter.title}
                            </span>
                            <span className="text-[9px] font-mono text-ink-muted tabular-nums">
                              {formatTime(startTime)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
