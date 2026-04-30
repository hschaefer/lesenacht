import React, { useState, useEffect } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { Search, BookOpen, Clock, Users, ChevronLeft, Info, Library as LibraryIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CoverImage } from '../components/CoverImage';

type Tab = 'books' | 'authors';
type SortOption = 'title' | 'added';
type FilterOption = 'all' | 'read' | 'unread';

export function LibraryView({ 
  onSelectBook, 
  initialAuthorKey, 
  onAuthorBack 
}: { 
  onSelectBook: (key: string) => void; 
  initialAuthorKey?: string | null;
  onAuthorBack?: () => void;
}) {
  const { t } = useTranslation();
  const { authToken, selectedServer, selectedLibrary } = useAuthStore();
  const effectiveToken = selectedServer?.accessToken || authToken;
  const [activeTab, setActiveTab] = useState<Tab>('books');
  const [books, setBooks] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<any>(null);
  const [authorBooks, setAuthorBooks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [bookDurations, setBookDurations] = useState<Record<string, number>>({});
  const [authorBookCounts, setAuthorBookCounts] = useState<Record<string, number>>({});

  const { progressMap } = usePlayerStore();

  const connections = selectedServer?.connections || [];
  const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;

  // Sync internal selectedAuthor state with external initialAuthorKey
  useEffect(() => {
    if (initialAuthorKey && authors.length > 0) {
      const author = authors.find(a => a.ratingKey === initialAuthorKey);
      if (author) {
        setSelectedAuthor(author);
      }
    } else if (!initialAuthorKey) {
      setSelectedAuthor(null);
    }
  }, [initialAuthorKey, authors]);

  // If initialAuthorKey is provided but authors aren't loaded yet, 
  // fetch the specific author directly to avoid empty screen
  useEffect(() => {
    if (initialAuthorKey && effectiveToken && baseUrl && !selectedAuthor) {
      plexService.getItemMetadata(baseUrl, initialAuthorKey, effectiveToken)
        .then(meta => {
          if (meta) setSelectedAuthor(meta);
        })
        .catch(console.error);
    }
  }, [initialAuthorKey, effectiveToken, baseUrl, selectedAuthor]);

  useEffect(() => {
    if (effectiveToken && baseUrl && selectedLibrary) {
      setLoading(true);
      if (activeTab === 'books') {
        Promise.all([
          plexService.getLibraryItems(baseUrl, selectedLibrary.key, effectiveToken),
          plexService.getLibraryTracks(baseUrl, selectedLibrary.key, effectiveToken),
        ]).then(([items, tracks]) => {
            setBooks(items);
            const durations: Record<string, number> = {};
            for (const track of tracks) {
              if (track.parentRatingKey && track.duration) {
                durations[track.parentRatingKey] = (durations[track.parentRatingKey] || 0) + track.duration;
              }
            }
            setBookDurations(durations);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      } else {
        Promise.all([
          plexService.getLibraryArtists(baseUrl, selectedLibrary.key, effectiveToken),
          plexService.getLibraryItems(baseUrl, selectedLibrary.key, effectiveToken),
        ]).then(([items, albums]) => {
            setAuthors(items);
            const counts: Record<string, number> = {};
            for (const album of albums) {
              if (album.parentRatingKey) {
                counts[album.parentRatingKey] = (counts[album.parentRatingKey] || 0) + 1;
              }
            }
            setAuthorBookCounts(counts);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      }
    }
  }, [effectiveToken, baseUrl, selectedLibrary, activeTab]);

  useEffect(() => {
    if (selectedAuthor && effectiveToken && baseUrl) {
      setLoading(true);
      plexService.getArtistAlbums(baseUrl, selectedAuthor.ratingKey, effectiveToken)
        .then(items => {
          setAuthorBooks(items);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [selectedAuthor, effectiveToken, baseUrl]);

  const processedBooks = books
    .filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (b.parentTitle && b.parentTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // Filter by read status
      if (filterBy === 'all') return true;
      
      const lastTrackKey = usePlayerStore.getState().lastTrackByBook[b.ratingKey];
      const progress = lastTrackKey ? progressMap[lastTrackKey] : null;
      const isRead = (progress && progress.time >= progress.duration * 0.95) || (b.viewCount && b.viewCount > 0);

      if (filterBy === 'read') return isRead;
      if (filterBy === 'unread') return !isRead;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'added') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      }
      return a.title.localeCompare(b.title);
    });

  const filteredAuthors = authors.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.title.localeCompare(b.title));

  if (!authToken || !selectedLibrary) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="w-20 h-20 glass rounded-full flex items-center justify-center text-ink-muted mb-2">
          <LibraryIcon size={40} />
        </div>
        <h2 className="text-xl font-bold text-ink">{t('library.setupRequired')}</h2>
        <p className="text-ink-dim text-sm max-w-[250px]">
          {!authToken ? t('home.signInPromptPlex') : t('home.signInPromptSelection')} {t('library.viewCollectionPrompt')}
        </p>
      </div>
    );
  }

  if (selectedAuthor) {
    return (
      <div className="space-y-6 pb-20">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => {
              setSelectedAuthor(null);
              onAuthorBack?.();
            }}
            className="w-10 h-10 glass rounded-full flex items-center justify-center text-ink-dim hover:text-ink transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink">{selectedAuthor.title}</h1>
            <p className="text-ink-muted text-[10px] uppercase tracking-widest font-bold">{t('library.authorDetails')}</p>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-40 h-40 rounded-3xl overflow-hidden bg-slate-800 flex-shrink-0 shadow-xl overflow-hidden relative">
             <CoverImage 
              src={plexService.getThumbUrl(baseUrl || '', selectedAuthor.thumb, authToken!, 300, 300)} 
              className="w-full h-full"
              alt={selectedAuthor.title}
              type="author"
              size={48}
            />
          </div>
          <div className="flex-1 space-y-4">
            {selectedAuthor.summary && (
              <div className="glass rounded-2xl p-4 space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
                  <Info size={12} /> {t('library.biography')}
                </h3>
                <p className="text-xs text-ink-dim leading-relaxed max-h-32 overflow-y-auto pr-2 scrollbar-hide">
                  {selectedAuthor.summary}
                </p>
              </div>
            )}
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
            <BookOpen size={16} /> {t('library.audiobooks')}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="animate-pulse h-20 glass rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {authorBooks.map(book => (
                <LibraryItem
                  key={book.ratingKey}
                  book={book}
                  baseUrl={baseUrl || ''}
                  authToken={effectiveToken!}
                  totalDuration={bookDurations[book.ratingKey]}
                  onClick={() => onSelectBook(book.ratingKey)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">{t('library.title')}</h1>
          <p className="text-ink-muted text-[10px] mt-1 uppercase tracking-widest font-bold">
            {activeTab === 'books' 
              ? t('library.booksCount', { count: books.length }) 
              : t('library.authorsCount', { count: authors.length })}
          </p>
        </div>
      </header>

      <div className="flex gap-2 p-1 glass rounded-2xl w-fit">
        <button 
          onClick={() => { setActiveTab('books'); setSearchQuery(''); }}
          className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'books' ? 'accent-bg text-white shadow-lg' : 'text-ink-muted hover:text-ink-dim'}`}
        >
          {t('library.books')}
        </button>
        <button 
          onClick={() => { setActiveTab('authors'); setSearchQuery(''); }}
          className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'authors' ? 'accent-bg text-white shadow-lg' : 'text-ink-muted hover:text-ink-dim'}`}
        >
          {t('library.authors')}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
        <input 
          type="text" 
          placeholder={activeTab === 'books' ? t('library.searchBooks') : t('library.searchAuthors')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full glass rounded-full py-3 pl-12 pr-4 text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Sort and Filter Controls (Books only) */}
        {activeTab === 'books' && (
          <>
            {/* Sort Controls */}
            <div className="flex items-center gap-2 glass p-1 rounded-xl">
              <button
                onClick={() => setSortBy('title')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${sortBy === 'title' ? 'accent-bg text-white shadow-md' : 'text-ink-muted hover:text-ink-dim'}`}
              >
                {t('library.az')}
              </button>
              <button
                onClick={() => setSortBy('added')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${sortBy === 'added' ? 'accent-bg text-white shadow-md' : 'text-ink-muted hover:text-ink-dim'}`}
              >
                <Clock size={12} /> {t('library.recent')}
              </button>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 glass p-1 rounded-xl">
              <button
                onClick={() => setFilterBy('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterBy === 'all' ? 'bg-ink text-bg shadow-md' : 'text-ink-muted hover:text-ink-dim'}`}
              >
                {t('library.all')}
              </button>
              <button
                onClick={() => setFilterBy('unread')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterBy === 'unread' ? 'bg-ink text-bg shadow-md' : 'text-ink-muted hover:text-ink-dim'}`}
              >
                {t('library.unread')}
              </button>
              <button
                onClick={() => setFilterBy('read')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterBy === 'read' ? 'bg-ink text-bg shadow-md' : 'text-ink-muted hover:text-ink-dim'}`}
              >
                {t('library.read')}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-3"
            >
              {[1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-20 glass rounded-2xl" />)}
            </motion.div>
          ) : (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {activeTab === 'books' ? (
                processedBooks.map(book => (
                  <LibraryItem
                    key={book.ratingKey}
                    book={book}
                    baseUrl={baseUrl || ''}
                    authToken={effectiveToken!}
                    totalDuration={bookDurations[book.ratingKey]}
                    onClick={() => onSelectBook(book.ratingKey)}
                    onSelectAuthor={(key) => {
                      const author = authors.find(a => a.ratingKey === key);
                      if (author) setSelectedAuthor(author);
                      else {
                        // If not in authors list (maybe not fetched yet), 
                        // we can fetch it or just set a dummy with key
                        plexService.getItemMetadata(baseUrl || '', key, effectiveToken!)
                          .then(setSelectedAuthor);
                      }
                    }}
                  />
                ))
              ) : (
                filteredAuthors.map(author => (
                  <AuthorItem
                    key={author.ratingKey}
                    author={author}
                    baseUrl={baseUrl || ''}
                    authToken={effectiveToken!}
                    bookCount={authorBookCounts[author.ratingKey]}
                    onClick={() => setSelectedAuthor(author)}
                  />
                ))
              )}
              
              {(activeTab === 'books' ? processedBooks : filteredAuthors).length === 0 && (activeTab === 'books' || searchQuery) && (
                <div className="text-center py-20 text-ink-muted">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                  <p>{t('library.nothingFound')}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AuthorItem({
  author,
  baseUrl,
  authToken,
  bookCount,
  onClick
}: {
  author: any;
  baseUrl: string;
  authToken: string;
  bookCount?: number;
  onClick: () => void;
  key?: any;
}) {
  const { t } = useTranslation();
  const thumbUrl = plexService.getThumbUrl(baseUrl, author.thumb, authToken, 120, 120);
  
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-4 p-2 glass hover:bg-white/5 rounded-2xl transition-all cursor-pointer group"
    >
      <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform border-2 border-white/5">
        <CoverImage 
          src={thumbUrl} 
          className="w-full h-full"
          alt={author.title}
          type="author"
          size={24}
        />
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-sm font-bold text-ink line-clamp-1 break-all">{author.title}</h3>
        <p className="text-[10px] text-ink-muted uppercase font-bold tracking-widest mt-0.5">
          {bookCount ? t('library.booksCount', { count: bookCount }) : t('library.author')}
        </p>
      </div>
    </motion.div>
  );
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function LibraryItem({
  book,
  baseUrl,
  authToken,
  totalDuration,
  onClick,
  onSelectAuthor
}: {
  book: any;
  baseUrl: string;
  authToken: string;
  totalDuration?: number;
  onClick: () => void;
  onSelectAuthor?: (key: string) => void;
  key?: any;
}) {
  const { t } = useTranslation();
  const thumbUrl = plexService.getThumbUrl(baseUrl, book.thumb, authToken, 120, 120);
  const { progressMap, lastTrackByBook } = usePlayerStore();

  const lastTrackKey = lastTrackByBook[book.ratingKey];
  const progress = lastTrackKey ? progressMap[lastTrackKey] : null;
  const isRead = progress && progress.time >= progress.duration * 0.95;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-4 p-2 glass hover:bg-white/5 rounded-2xl transition-all cursor-pointer group"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
        <CoverImage
          src={thumbUrl}
          className="w-full h-full"
          alt={book.title}
          type="book"
          size={24}
        />
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-sm font-bold text-ink line-clamp-1 break-all">{book.title}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (book.parentRatingKey) onSelectAuthor?.(book.parentRatingKey);
          }}
          className="text-xs text-ink-dim line-clamp-1 break-all hover:accent-text transition-colors text-left"
        >
          {book.parentTitle || t('library.author')}
        </button>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-ink-muted uppercase font-bold tracking-tighter">
            {book.leafCount ? t('library.tracks', { count: book.leafCount }) : t('library.singleTrack')}
          </span>
          {totalDuration && totalDuration > 0 && (
            <span className="text-[10px] text-ink-muted uppercase font-bold tracking-tighter flex items-center gap-1">
              <Clock size={9} />
              {formatDuration(totalDuration)}
            </span>
          )}
          {(isRead || (book.viewCount && book.viewCount > 0)) && (
            <span className="text-[10px] accent-text uppercase font-bold tracking-tighter">{t('library.read')}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

