import React, { useState, useEffect } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { Search, Filter, BookOpen, Clock, ListFilter, Users, ChevronLeft, Info, Library } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const { authToken, selectedServer, selectedLibrary } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('books');
  const [books, setBooks] = useState<any[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<any>(null);
  const [authorBooks, setAuthorBooks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

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
    if (initialAuthorKey && authToken && baseUrl && !selectedAuthor) {
      plexService.getItemMetadata(baseUrl, initialAuthorKey, authToken)
        .then(meta => {
          if (meta) setSelectedAuthor(meta);
        })
        .catch(console.error);
    }
  }, [initialAuthorKey, authToken, baseUrl, selectedAuthor]);

  useEffect(() => {
    if (authToken && baseUrl && selectedLibrary) {
      setLoading(true);
      if (activeTab === 'books') {
        plexService.getLibraryItems(baseUrl, selectedLibrary.key, authToken)
          .then(items => {
            setBooks(items);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      } else {
        plexService.getLibraryArtists(baseUrl, selectedLibrary.key, authToken)
          .then(items => {
            setAuthors(items);
            setLoading(false);
          })
          .catch(err => {
            console.error(err);
            setLoading(false);
          });
      }
    }
  }, [authToken, baseUrl, selectedLibrary, activeTab]);

  useEffect(() => {
    if (selectedAuthor && authToken && baseUrl) {
      setLoading(true);
      plexService.getArtistAlbums(baseUrl, selectedAuthor.ratingKey, authToken)
        .then(items => {
          setAuthorBooks(items);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [selectedAuthor, authToken, baseUrl]);

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
        <div className="w-20 h-20 glass rounded-full flex items-center justify-center text-slate-500 mb-2">
          <Library size={40} />
        </div>
        <h2 className="text-xl font-bold text-ink">Library Setup Required</h2>
        <p className="text-slate-500 text-sm max-w-[250px]">
          {!authToken ? "Please sign in with Plex" : "Please select a server and library"} in the settings to view your collection.
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
            className="w-10 h-10 glass rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink">{selectedAuthor.title}</h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Author Details</p>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-40 h-40 rounded-3xl overflow-hidden bg-slate-800 flex-shrink-0 shadow-xl overflow-hidden relative">
             <img 
              src={plexService.getThumbUrl(baseUrl || '', selectedAuthor.thumb, authToken!, 300, 300) || 'https://via.placeholder.com/300?text=Author'} 
              className="w-full h-full object-cover"
              alt={selectedAuthor.title}
            />
          </div>
          <div className="flex-1 space-y-4">
            {selectedAuthor.summary && (
              <div className="glass rounded-2xl p-4 space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Info size={12} /> Biography / Summary
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed max-h-32 overflow-y-auto pr-2 scrollbar-hide">
                  {selectedAuthor.summary}
                </p>
              </div>
            )}
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm uppercase tracking-widest font-bold text-slate-500 flex items-center gap-2">
            <BookOpen size={16} /> Audiobooks
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="animate-pulse h-20 glass rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid gap-3">
              {authorBooks.map(book => (
                <LibraryItem 
                  key={book.ratingKey} 
                  book={book} 
                  baseUrl={baseUrl || ''} 
                  authToken={authToken!} 
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
          <h1 className="text-3xl font-light tracking-tight text-ink">Library</h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">
            {activeTab === 'books' ? `${books.length} Books` : `${authors.length} Authors`}
          </p>
        </div>
      </header>

      <div className="flex gap-2 p-1 glass rounded-2xl w-fit">
        <button 
          onClick={() => { setActiveTab('books'); setSearchQuery(''); }}
          className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'books' ? 'accent-bg text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Books
        </button>
        <button 
          onClick={() => { setActiveTab('authors'); setSearchQuery(''); }}
          className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'authors' ? 'accent-bg text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Authors
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder={activeTab === 'books' ? "Search books..." : "Search authors..."} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-4 text-ink placeholder:text-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Sort and Filter Controls (Books only) */}
        {activeTab === 'books' && (
          <>
            {/* Sort Controls */}
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setSortBy('title')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${sortBy === 'title' ? 'accent-bg text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                A-Z
              </button>
              <button
                onClick={() => setSortBy('added')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${sortBy === 'added' ? 'accent-bg text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Clock size={12} /> Recent
              </button>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setFilterBy('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterBy === 'all' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterBy('unread')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterBy === 'unread' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilterBy('read')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filterBy === 'read' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Read
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
              className="grid gap-3"
            >
              {activeTab === 'books' ? (
                processedBooks.map(book => (
                  <LibraryItem 
                    key={book.ratingKey} 
                    book={book} 
                    baseUrl={baseUrl || ''} 
                    authToken={authToken!} 
                    onClick={() => onSelectBook(book.ratingKey)}
                    onSelectAuthor={(key) => {
                      const author = authors.find(a => a.ratingKey === key);
                      if (author) setSelectedAuthor(author);
                      else {
                        // If not in authors list (maybe not fetched yet), 
                        // we can fetch it or just set a dummy with key
                        plexService.getItemMetadata(baseUrl || '', key, authToken!)
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
                    authToken={authToken!}
                    onClick={() => setSelectedAuthor(author)}
                  />
                ))
              )}
              
              {(activeTab === 'books' ? processedBooks : filteredAuthors).length === 0 && (activeTab === 'books' || searchQuery) && (
                <div className="text-center py-20 text-slate-500">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nothing found matching your search.</p>
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
  onClick 
}: { 
  author: any; 
  baseUrl: string; 
  authToken: string; 
  onClick: () => void;
  key?: string;
}) {
  const thumbUrl = plexService.getThumbUrl(baseUrl, author.thumb, authToken, 120, 120);
  
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-4 p-2 glass hover:bg-white/5 rounded-2xl transition-all cursor-pointer group"
    >
      <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform border-2 border-white/5">
        <img 
          src={thumbUrl || 'https://via.placeholder.com/120?text=Author'} 
          className="w-full h-full object-cover"
          alt={author.title}
        />
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-sm font-bold text-ink line-clamp-1 break-all">{author.title}</h3>
        <p className="text-[10px] text-slate-700 dark:text-slate-400 uppercase font-bold tracking-widest mt-0.5">
          Author
        </p>
      </div>
    </motion.div>
  );
}

function LibraryItem({ 
  book, 
  baseUrl, 
  authToken, 
  onClick,
  onSelectAuthor
}: { 
  book: any; 
  baseUrl: string; 
  authToken: string; 
  onClick: () => void;
  onSelectAuthor?: (key: string) => void;
  key?: string;
}) {
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
        <img 
          src={thumbUrl || 'https://via.placeholder.com/120?text=N/A'} 
          className="w-full h-full object-cover"
          alt={book.title}
        />
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-sm font-bold text-ink line-clamp-1 break-all">{book.title}</h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (book.parentRatingKey) onSelectAuthor?.(book.parentRatingKey);
          }}
          className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 break-all hover:accent-text transition-colors text-left"
        >
          {book.parentTitle || 'Unknown Author'}
        </button>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-[10px] text-slate-700 dark:text-slate-500 uppercase font-bold tracking-tighter">
            {book.leafCount ? `${book.leafCount} Tracks` : 'Single Track'}
          </span>
          {(isRead || (book.viewCount && book.viewCount > 0)) && (
            <span className="text-[10px] accent-text uppercase font-bold tracking-tighter">Read</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
