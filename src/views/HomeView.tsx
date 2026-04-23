import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { motion } from 'motion/react';
import { BookOpen, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function HomeView({ 
  onSelectBook,
  onSelectAuthor
}: { 
  onSelectBook: (key: string) => void;
  onSelectAuthor?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const { authToken, selectedServer, selectedLibrary } = useAuthStore();
  const { progressMap, lastTrackByBook } = usePlayerStore();
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authToken && selectedServer && selectedLibrary) {
      const connections = selectedServer?.connections || [];
      const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
      
      if (!baseUrl) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      plexService.getLibraryItems(baseUrl, selectedLibrary.key, authToken)
        .then(items => {
          setAllBooks(items || []);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [authToken, selectedServer, selectedLibrary]);

  const continueListening = useMemo(() => {
    // Get books that have local progress
    // We check if the book has a last played track, and if that track has progress > 0
    return allBooks
      .filter(book => {
        const lastTrackKey = lastTrackByBook[book.ratingKey];
        if (!lastTrackKey) return false;
        
        const progress = progressMap[lastTrackKey];
        // If we have progress and it's not finished
        if (!progress || progress.time <= 0) return false;
        
        const percent = (progress.time / progress.duration) * 100;
        return percent < 95; // Only show if less than 95% complete
      })
      .sort((a, b) => {
        const lastTrackKeyA = lastTrackByBook[a.ratingKey];
        const lastTrackKeyB = lastTrackByBook[b.ratingKey];
        const timeA = progressMap[lastTrackKeyA || '']?.time || 0;
        const timeB = progressMap[lastTrackKeyB || '']?.time || 0;
        // Ideally we'd have a 'lastPlayedAt' in progressMap to sort by actual recency
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [allBooks, progressMap, lastTrackByBook]);

  const recentlyAdded = useMemo(() => {
    return [...allBooks]
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .filter(b => !continueListening.find(cb => cb.ratingKey === b.ratingKey))
      .slice(0, 10);
  }, [allBooks, continueListening]);

  if (!authToken || !selectedLibrary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 glass rounded-full flex items-center justify-center text-slate-500 mb-2">
          <BookOpen size={40} />
        </div>
        <h2 className="text-xl font-bold text-ink">{t('home.welcomeTo')}</h2>
        <p className="text-ink-dim text-sm max-w-[250px]">
          {!authToken ? t('home.signInPromptPlex') : t('home.signInPromptSelection')} {t('home.startListening')}
        </p>
      </div>
    );
  }

  const baseUrl = selectedServer?.connections?.find((c: any) => !c.local)?.uri || selectedServer?.connections?.[0]?.uri;

  return (
    <div className="space-y-8 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">{t('home.title')}</h1>
          <p className="text-ink-dim text-[10px] mt-1 uppercase tracking-widest font-bold">{t('home.subtitle')}</p>
        </div>
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
                    authToken={authToken} 
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
            <div className="grid grid-cols-2 gap-4">
              {recentlyAdded.map(book => (
                <BookCard 
                  key={book.ratingKey} 
                  book={book} 
                  baseUrl={baseUrl || ''} 
                  authToken={authToken} 
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
  key?: string;
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
        <img 
          src={thumbUrl || 'https://via.placeholder.com/300?text=No+Cover'} 
          alt={book.title}
          className="w-full h-full object-cover"
          loading="lazy"
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
