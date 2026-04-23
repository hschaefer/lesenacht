import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Settings2, 
  Bookmark, 
  MoreVertical,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  List,
  RotateCcw,
  RotateCw,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Moon,
  Library,
  Trash2,
  BookOpen
} from 'lucide-react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { useTranslation } from 'react-i18next';

export function NowPlayingView({ 
  onClose,
  onNavigateBook,
  onNavigateAuthor
}: { 
  onClose: () => void;
  onNavigateBook?: (key: string) => void;
  onNavigateAuthor?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const { 
    currentBook, 
    currentTrack, 
    isPlaying, 
    setPlaying, 
    currentTime, 
    duration, 
    setCurrentTime,
    playbackSpeed,
    setPlaybackSpeed,
    volume,
    setVolume,
    addBookmark,
    sleepTimerEnd,
    setSleepTimer,
    bookmarks,
    removeBookmark
  } = usePlayerStore();
  const { authToken, selectedServer } = useAuthStore();
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isChapterMenuOpen, setIsChapterMenuOpen] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [showBookmarkFeedback, setShowBookmarkFeedback] = useState(false);
  const [chapters, setChapters] = useState<any[]>([]);

  useEffect(() => {
    if (currentTrack && authToken && selectedServer) {
      const connections = selectedServer?.connections || [];
      const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
      
      if (!baseUrl) return;

      plexService.getTrackMetadata(baseUrl, currentTrack.ratingKey, authToken)
        .then(metadata => {
          if (metadata && metadata.Chapter) {
            setChapters(metadata.Chapter);
          } else {
            setChapters([]);
          }
        })
        .catch(err => {
          console.error("Failed to fetch chapters:", err);
          setChapters([]);
        });
    }
  }, [currentTrack?.ratingKey, authToken, selectedServer]);

  if (!currentBook || !currentTrack || !selectedServer) return null;

  const connections = selectedServer?.connections || [];
  const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
  
  if (!baseUrl) return null;

  const thumbUrl = plexService.getThumbUrl(baseUrl, currentBook.thumb, authToken!, 800, 800);
  
  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / duration) * 100;
  const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const sleepOptions = [15, 30, 45, 60, null];

  const currentChapter = chapters.length > 0 
    ? [...chapters].reverse().find(c => {
        const start = c.startTimeOffset || c.start || 0;
        return (start / 1000) <= currentTime;
      }) 
    : null;

  const handleNextChapter = () => {
    if (chapters.length === 0) return;
    const currentIdx = currentChapter ? chapters.findIndex(c => c.index === currentChapter.index) : -1;
    if (currentIdx < chapters.length - 1) {
      const next = chapters[currentIdx + 1];
      setCurrentTime((next.startTimeOffset || next.start || 0) / 1000);
    }
  };

  const handlePrevChapter = () => {
    if (chapters.length === 0) return;
    const currentIdx = currentChapter ? chapters.findIndex(c => c.index === currentChapter.index) : -1;
    // If we're more than 3 seconds into the chapter, restart it, otherwise go to previous
    const chapterStart = currentChapter ? (currentChapter.startTimeOffset || currentChapter.start || 0) / 1000 : 0;
    
    if (currentTime - chapterStart > 3) {
      setCurrentTime(chapterStart);
    } else if (currentIdx > 0) {
      const prev = chapters[currentIdx - 1];
      setCurrentTime((prev.startTimeOffset || prev.start || 0) / 1000);
    }
  };

  const formatSleepRemaining = () => {
    if (!sleepTimerEnd) return '';
    const diff = sleepTimerEnd - Date.now();
    if (diff <= 0) return '';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-bg z-50 flex flex-col p-8 pb-12 overflow-hidden"
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden -z-10 opacity-30">
        <div 
          className="absolute inset-0 bg-cover bg-center blur-3xl scale-150 grayscale-[0.5]" 
          style={{ backgroundImage: `url(${thumbUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/50 via-bg to-bg" />
      </div>

      <header className="flex items-center justify-between relative">
        <button onClick={onClose} className="w-12 h-12 glass rounded-full flex items-center justify-center text-ink-dim hover:text-ink transition-colors">
          <ChevronDown size={28} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-ink-muted">{t('player.currentlyListening')}</p>
          <h2 className="text-sm font-bold text-ink truncate max-w-[200px]">{currentBook.title}</h2>
        </div>
        <div className="relative">
          <button 
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            className={`w-12 h-12 glass rounded-full flex items-center justify-center transition-colors ${isOptionsMenuOpen ? 'text-accent' : 'text-ink-dim hover:text-ink'}`}
          >
            <MoreVertical size={24} />
          </button>
          
          <AnimatePresence>
            {isOptionsMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-14 w-48 glass rounded-2xl shadow-2xl z-50 p-2"
              >
                <button 
                  onClick={() => {
                    onNavigateBook?.(currentBook.ratingKey);
                    setIsOptionsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-ink-dim hover:text-ink hover:bg-ink/5 rounded-xl transition-colors"
                >
                  <BookOpen size={16} /> {t('player.goToBook')}
                </button>
                <button 
                  onClick={() => {
                    if (currentBook.parentRatingKey) onNavigateAuthor?.(currentBook.parentRatingKey);
                    setIsOptionsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold text-ink-dim hover:text-ink hover:bg-ink/5 rounded-xl transition-colors"
                >
                  <Library size={16} /> {t('player.goToAuthor')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-6" onClick={() => setIsOptionsMenuOpen(false)}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full aspect-square max-w-[280px] rounded-[40px] overflow-hidden shadow-2xl shadow-black/50 book-card relative group"
        >
          <img 
            src={thumbUrl || 'https://via.placeholder.com/800?text=No+Cover'} 
            className="w-full h-full object-cover" 
            alt={currentBook.title} 
          />
          {currentChapter && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-[10px] uppercase tracking-widest font-bold text-accent mb-1">{t('player.currentChapter')}</p>
              <p className="text-white text-xs font-medium truncate">{currentChapter.tag || currentChapter.title}</p>
            </div>
          )}
        </motion.div>

        <div className="text-center space-y-2 w-full max-w-sm">
          <h1 className="text-xl font-bold text-ink truncate px-4">{currentTrack.title}</h1>
          <button 
            onClick={() => currentBook.parentRatingKey && onNavigateAuthor?.(currentBook.parentRatingKey)}
            className="accent-text font-bold uppercase tracking-widest text-[10px] hover:brightness-125 transition-all"
          >
            {currentBook.parentTitle || currentBook.grandparentTitle}
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm mx-auto space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div 
            className="relative h-2 w-full glass rounded-full overflow-hidden group cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const clickedPercent = x / rect.width;
              setCurrentTime(clickedPercent * duration);
            }}
          >
            <div 
              className="absolute h-full left-0 top-0 accent-bg shadow-[0_0_15px_rgba(234,88,12,0.6)]" 
              style={{ width: `${progress}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-ink rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" 
              style={{ left: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-ink-muted font-bold">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(duration - currentTime)}</span>
          </div>
        </div>

        {/* Controls Row 1 */}
        <div className="flex items-center justify-between px-2">
          <button 
            onClick={handlePrevChapter}
            disabled={chapters.length === 0}
            className="text-ink-dim hover:text-ink transition-colors disabled:opacity-20"
            title={t('player.chapters')}
          >
            <ChevronsLeft size={28} />
          </button>
          
          <button 
            onClick={() => setCurrentTime(Math.max(0, currentTime - 15))}
            className="text-ink-dim hover:text-ink transition-colors active:scale-90"
            title={t('player.back15')}
          >
            <RotateCcw size={32} />
          </button>
          
          <button 
            onClick={() => setPlaying(!isPlaying)}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} className="ml-1" fill="black" />}
          </button>

          <button 
            onClick={() => setCurrentTime(Math.min(duration, currentTime + 45))}
            className="text-ink-dim hover:text-ink transition-colors active:scale-90"
            title={t('player.forward45')}
          >
            <RotateCw size={32} />
          </button>

          <button 
            onClick={handleNextChapter}
            disabled={chapters.length === 0}
            className="text-ink-dim hover:text-ink transition-colors disabled:opacity-20"
            title={t('player.chapters')}
          >
            <ChevronsRight size={28} />
          </button>
        </div>

        {/* Controls Row 2 */}
        <div className="flex items-center justify-around px-4 py-2 glass rounded-3xl">
          <button 
            onClick={() => setIsSpeedMenuOpen(true)}
            className={`flex flex-col items-center gap-1 transition-colors ${isSpeedMenuOpen ? 'text-accent' : 'text-ink-dim hover:text-ink'}`}
          >
            <Settings2 size={24} />
            <span className="text-[9px] font-bold font-mono">{playbackSpeed}x</span>
          </button>

          <button 
            onClick={() => {
              addBookmark(currentTrack.ratingKey, currentTime, `Bookmark at ${formatTime(currentTime)}`);
              setShowBookmarkFeedback(true);
              setTimeout(() => setShowBookmarkFeedback(false), 1500);
            }}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${showBookmarkFeedback ? 'text-green-500 scale-110' : 'text-ink-dim hover:text-ink'}`}
          >
            {showBookmarkFeedback ? <Check size={24} /> : <Bookmark size={24} />}
            <span className="text-[9px] font-bold uppercase tracking-tighter">
              {showBookmarkFeedback ? t('player.saved') : t('player.mark')}
            </span>
          </button>

          <button 
            onClick={() => setIsChapterMenuOpen(true)}
            disabled={chapters.length === 0}
            className={`flex flex-col items-center gap-1 transition-colors ${isChapterMenuOpen ? 'text-accent' : 'text-ink-dim hover:text-ink'} disabled:opacity-20`}
          >
            <List size={24} />
            <span className="text-[9px] font-bold uppercase tracking-tighter">{t('player.list')}</span>
          </button>

          <button 
            onClick={() => setIsSleepMenuOpen(true)}
            className={`flex flex-col items-center gap-1 transition-colors ${sleepTimerEnd ? 'text-accent' : 'text-ink-dim hover:text-ink'}`}
          >
            <Moon size={24} />
            <span className="text-[9px] font-bold font-mono uppercase tracking-tighter">
              {sleepTimerEnd ? formatSleepRemaining() : t('player.sleep')}
            </span>
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-4 text-ink-muted pb-2">
          <VolumeX size={16} />
          <input 
            type="range" min="0" max="1" step="0.01" 
            value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 accent-accent h-1 bg-black/10 dark:bg-white/10 rounded-full appearance-none outline-none"
          />
          <Volume2 size={16} />
        </div>
      </div>

      {/* Menus */}
      <AnimatePresence>
        {/* Speed Menu */}
        {isSpeedMenuOpen && (
          <Modal onClose={() => setIsSpeedMenuOpen(false)}>
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-ink-muted mb-6 text-center">{t('player.playbackSpeed')}</h3>
            <div className="grid grid-cols-3 gap-4">
              {speeds.map(speed => (
                <button
                  key={speed}
                  onClick={() => { setPlaybackSpeed(speed); setIsSpeedMenuOpen(false); }}
                  className={`py-3 rounded-2xl font-mono text-sm font-bold border transition-all ${playbackSpeed === speed ? 'accent-bg border-accent text-white shadow-lg' : 'glass border-white/10 text-ink-dim hover:text-ink'}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </Modal>
        )}

        {/* Sleep Menu */}
        {isSleepMenuOpen && (
          <Modal onClose={() => setIsSleepMenuOpen(false)}>
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-ink-muted mb-6 text-center">{t('player.sleepTimer')}</h3>
            <div className="grid grid-cols-3 gap-4">
              {sleepOptions.map(opt => (
                <button
                  key={opt ?? 'off'}
                  onClick={() => { setSleepTimer(opt); setIsSleepMenuOpen(false); }}
                  className="py-3 rounded-2xl font-mono text-sm font-bold border bg-white/5 border-white/10 text-ink-dim"
                >
                  {opt ? t('player.minutes', { count: opt }) : t('player.off')}
                </button>
              ))}
            </div>
          </Modal>
        )}

        {/* Chapters Modal */}
        {isChapterMenuOpen && (
          <Modal onClose={() => setIsChapterMenuOpen(false)} fullHeight>
            <div className="flex gap-2 p-1 glass rounded-2xl w-fit mx-auto mb-6">
              <button 
                onClick={() => setActiveMenuTab('chapters')}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeMenuTab === 'chapters' ? 'accent-bg text-white shadow-lg' : 'text-ink-muted hover:text-ink'}`}
              >
                {t('player.chapters')}
              </button>
              <button 
                onClick={() => setActiveMenuTab('bookmarks')}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeMenuTab === 'bookmarks' ? 'accent-bg text-white shadow-lg' : 'text-ink-muted hover:text-ink'}`}
              >
                {t('player.bookmarks')}
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 pr-2 custom-scrollbar flex-1">
              {activeMenuTab === 'chapters' ? (
                chapters.map((chapter, idx) => {
                  const startTime = (chapter.startTimeOffset || chapter.start || 0) / 1000;
                  const isActive = currentChapter?.index === chapter.index;
                  return (
                    <button
                      key={chapter.index || idx}
                      onClick={() => { setCurrentTime(startTime); setIsChapterMenuOpen(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isActive ? 'bg-accent/20 border border-accent/30 text-accent' : 'glass border-white/5 text-ink-dim hover:text-ink'}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-[10px] font-mono">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span className="text-sm font-medium truncate">{chapter.tag || chapter.title}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-accent' : 'text-ink-muted'}`}>{formatTime(startTime)}</span>
                    </button>
                  );
                })
              ) : (
                <div className="space-y-2">
                  {bookmarks
                    .filter(b => b.trackKey === currentTrack.ratingKey)
                    .sort((a, b) => b.date - a.date)
                    .map((bookmark) => (
                      <div 
                        key={`${bookmark.trackKey}-${bookmark.date}`}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group"
                      >
                        <button 
                          onClick={() => { setCurrentTime(bookmark.time); setIsChapterMenuOpen(false); }}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm font-medium text-slate-200 truncate">{bookmark.label || formatTime(bookmark.time)}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">{formatTime(bookmark.time)}</p>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBookmark(bookmark.trackKey, bookmark.date);
                          }}
                          className="p-2 text-slate-600 hover:text-red-400 opacity-40 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  {bookmarks.filter(b => b.trackKey === currentTrack.ratingKey).length === 0 && (
                    <div className="text-center py-10 text-ink-muted italic text-sm">
                      {t('player.noBookmarks')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Modal({ children, onClose, fullHeight }: { children: React.ReactNode; onClose: () => void; fullHeight?: boolean }) {
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60]"
      />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className={`absolute bottom-0 left-0 right-0 glass rounded-t-[40px] p-8 pb-12 z-[70] shadow-2xl ${fullHeight ? 'max-h-[80vh]' : ''} flex flex-col`}
      >
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 flex-shrink-0" />
        {children}
      </motion.div>
    </>
  );
}
