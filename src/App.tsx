import React, { useState, useEffect } from 'react';
import {
  Home as HomeIcon,
  Library as LibraryIcon,
  Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore, usePlayerStore } from './store/useStore';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { SettingsView } from './views/SettingsView';
import { BookDetailView } from './views/BookDetailView';
import { NowPlayingView } from './views/NowPlayingView';
import { MiniPlayer } from './components/MiniPlayer';
import { AudioController } from './components/AudioController';
import { useTranslation } from 'react-i18next';
import { plexService } from './services/plexService';
import { App as CapApp } from '@capacitor/app';

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'settings'>('home');
  const [selectedBookKey, setSelectedBookKey] = useState<string | null>(null);
  const [selectedAuthorKey, setSelectedAuthorKey] = useState<string | null>(null);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [loginInitiatedFromHome, setLoginInitiatedFromHome] = useState(false);

  const { authToken, selectedServer, setSelectedServer, selectedLibrary, theme, language } = useAuthStore();
  const { currentBook } = usePlayerStore();
  const { i18n } = useTranslation();

  // False only when we have a stored server that needs a refresh before children fetch.
  const [serverReady, setServerReady] = useState(!authToken || !selectedServer);

  // Refresh server connection info on mount to get fresh URLs and access tokens.
  // Stored server data can become stale (Plex direct URLs / managed tokens rotate),
  // causing 500 errors until the user manually re-authenticates.
  useEffect(() => {
    if (!authToken || !selectedServer) return;
    plexService.getResources(authToken)
      .then((resources: any[]) => {
        const fresh = resources.find((s: any) =>
          s.clientIdentifier === selectedServer.clientIdentifier && s.provides === 'server'
        );
        if (fresh) setSelectedServer(fresh);
      })
      .catch(() => {})
      .finally(() => setServerReady(true));
  }, []);

  // Sync i18n with stored language
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
  
  const handleSelectAuthor = (key: string | null) => {
    setSelectedAuthorKey(key);
    setSelectedBookKey(null);
    setActiveTab('library');
  };

  const handleSelectBook = (key: string | null) => {
    setSelectedBookKey(key);
    if (key) {
      setSelectedAuthorKey(null);
    }
  };

  const renderContent = () => {
    if (selectedBookKey) {
      return (
        <BookDetailView 
          ratingKey={selectedBookKey} 
          onBack={() => setSelectedBookKey(null)} 
          onSelectAuthor={handleSelectAuthor}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <HomeView 
            onSelectBook={handleSelectBook} 
            onSelectAuthor={handleSelectAuthor} 
            onLogin={() => {
              setLoginInitiatedFromHome(true);
              setActiveTab('settings');
            }}
          />
        );
      case 'library':
        return (
          <LibraryView 
            onSelectBook={handleSelectBook} 
            initialAuthorKey={selectedAuthorKey}
            onAuthorBack={() => setSelectedAuthorKey(null)}
          />
        );
      case 'settings':
        return (
          <SettingsView 
            onLogin={() => {
              setLoginInitiatedFromHome(false);
            }} 
            autoStartLogin={loginInitiatedFromHome}
          />
        );
      default:
        return <HomeView onSelectBook={handleSelectBook} onSelectAuthor={handleSelectAuthor} />;
    }
  };

  // Reset login initiative if user manually switches tabs
  useEffect(() => {
    if (activeTab !== 'settings' && loginInitiatedFromHome) {
      setLoginInitiatedFromHome(false);
    }
  }, [activeTab, loginInitiatedFromHome]);

  // Android back gesture/button: navigate back instead of closing app
  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (isNowPlayingOpen) {
        setIsNowPlayingOpen(false);
      } else if (selectedBookKey) {
        setSelectedBookKey(null);
      } else if (selectedAuthorKey) {
        setSelectedAuthorKey(null);
      } else {
        CapApp.exitApp();
      }
    });
    return () => { listener.then(h => h.remove()); };
  }, [isNowPlayingOpen, selectedBookKey, selectedAuthorKey]);

  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-ink font-sans selection:bg-accent/30 overflow-hidden">
      <main className="flex-1 overflow-y-auto pt-safe px-4 pb-32">
        <div className="max-w-lg md:max-w-none mx-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedBookKey || selectedAuthorKey || activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {serverReady ? renderContent() : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/5 pb-[env(safe-area-inset-bottom)] z-40">
        <div className="max-w-lg md:max-w-none mx-auto grid grid-cols-3 h-16">
          <NavButton 
            active={activeTab === 'home' && !selectedBookKey && !selectedAuthorKey} 
            onClick={() => { setActiveTab('home'); setSelectedBookKey(null); setSelectedAuthorKey(null); }}
            icon={<HomeIcon size={20} />}
            label={t('common.home')}
          />
          <NavButton 
            active={activeTab === 'library' && !selectedBookKey && !selectedAuthorKey} 
            onClick={() => { setActiveTab('library'); setSelectedBookKey(null); setSelectedAuthorKey(null); }}
            icon={<LibraryIcon size={20} />}
            label={t('common.library')}
          />
          <NavButton 
            active={activeTab === 'settings' && !selectedBookKey && !selectedAuthorKey} 
            onClick={() => { setActiveTab('settings'); setSelectedBookKey(null); setSelectedAuthorKey(null); }}
            icon={<SettingsIcon size={20} />}
            label={t('common.settings')}
          />
        </div>
      </nav>

      {/* Mini Player */}
      <AnimatePresence>
        {currentBook && (
          <div className="fixed left-0 right-0 z-30" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
            <div className="max-w-lg md:max-w-none mx-auto">
              <MiniPlayer onClick={() => setIsNowPlayingOpen(true)} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Now Playing Fullscreen */}
      <AnimatePresence>
        {isNowPlayingOpen && (
          <NowPlayingView 
            onClose={() => setIsNowPlayingOpen(false)} 
            onNavigateBook={(key) => {
              handleSelectBook(key);
              setIsNowPlayingOpen(false);
            }}
            onNavigateAuthor={(key) => {
              handleSelectAuthor(key);
              setIsNowPlayingOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AudioController />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center space-y-1 transition-colors ${active ? 'accent-text' : 'text-ink-dim hover:text-ink'}`}
    >
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
    </button>
  );
}
