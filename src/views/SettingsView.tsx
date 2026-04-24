import React, { useState, useEffect } from 'react';
import { plexService } from '../services/plexService';
import { useAuthStore } from '../store/useStore';
import { LogIn, Server, Library, CheckCircle2, ChevronDown, ChevronUp, Moon, Sun, Monitor, Trash2, AlertTriangle, Info, Languages, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

export function SettingsView({ onLogin, autoStartLogin }: { onLogin?: () => void, autoStartLogin?: boolean }) {
  const { t, i18n } = useTranslation();
  const { 
    authToken, 
    setAuthToken, 
    selectedServer, 
    setSelectedServer, 
    selectedLibrary, 
    setSelectedLibrary,
    theme,
    setTheme,
    language,
    setLanguage,
    clearAllData
  } = useAuthStore();
  const [servers, setServers] = useState<any[]>([]);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState<any>(null);
  const [isAuthExpanded, setIsAuthExpanded] = useState(!authToken || !selectedServer || !selectedLibrary);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const APP_VERSION = '1.5.0';
  const LAST_UPDATED = '2026-04-24';

  // Trigger login if autoStartLogin is true
  useEffect(() => {
    if (autoStartLogin && !authToken && !pin) {
      handleLogin();
    }
  }, [autoStartLogin]);

  // Synchronize i18n with store
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Poll for token if login started
  useEffect(() => {
    let interval: any;
    if (pin && !authToken) {
      interval = setInterval(async () => {
        const token = await plexService.checkPin(pin.id);
        if (token) {
          setAuthToken(token);
          setPin(null);
          onLogin?.();
          clearInterval(interval);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pin, authToken, setAuthToken, onLogin]);

  // Fetch servers when token is available
  useEffect(() => {
    if (authToken) {
      setLoading(true);
      plexService.getResources(authToken)
        .then(data => {
          const plexServers = data.filter((s: any) => s.provides === 'server' && s.presence);
          setServers(plexServers);
          
          // Auto-select if only one server
          if (plexServers.length === 1 && !selectedServer) {
            setSelectedServer(plexServers[0]);
          }
          
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [authToken]);

  // Fetch libraries when server is selected
  useEffect(() => {
    if (selectedServer) {
      const effectiveToken = selectedServer.accessToken || authToken;
      if (!effectiveToken) return;

      const connections = selectedServer?.connections || [];
      const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
      
      if (!baseUrl) {
        setLibraries([]);
        return;
      }

      plexService.getLibrarySections(baseUrl, effectiveToken)
        .then(sections => {
          // Plex Music libraries are often type 'artist' or 'music'
          const filtered = sections.filter((s: any) => 
            s.type === 'music' || 
            s.type === 'artist' || 
            s.type === 'audio'
          );
          
          const targetLibraries = filtered.length > 0 ? filtered : sections;
          setLibraries(targetLibraries);

          // Auto-select logic
          if (!selectedLibrary && targetLibraries.length > 0) {
            if (targetLibraries.length === 1) {
              setSelectedLibrary(targetLibraries[0]);
            } else {
              const audiobookLib = targetLibraries.find((l: any) => 
                l.title.toLowerCase().includes('audiobook')
              );
              if (audiobookLib) {
                setSelectedLibrary(audiobookLib);
              }
            }
          }
        })
        .catch(err => {
          console.error('Failed to fetch libraries:', err);
          setLibraries([]);
        });
    }
  }, [selectedServer, authToken]);

  const handleLogin = async () => {
    try {
      const newPin = await plexService.getPin();
      setPin(newPin);
      
      const clientId = plexService.getClientId();
      // Use authAppUrl if Plex provides it (newer API) or fallback to manual construction
      const authUrl = newPin.authAppUrl 
        ? `${newPin.authAppUrl}&clientID=${clientId}` 
        : `https://app.plex.tv/auth/#!?clientID=${clientId}&code=${newPin.code}&context[device][product]=Lesenacht`;
        
      window.open(authUrl, 'Plex Login', 'width=600,height=700');
    } catch (err) {
      console.error('Failed to get Plex PIN:', err);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-light tracking-tight text-ink">{t('settings.title')}</h1>
        <p className="text-ink-dim text-[10px] mt-1 uppercase tracking-widest font-bold">{t('settings.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Authentication Section */}
          <section className="space-y-4">
            <button 
              onClick={() => setIsAuthExpanded(!isAuthExpanded)}
              className="w-full flex items-center justify-between group"
            >
              <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2 group-hover:text-ink transition-colors">
                <LogIn size={16} /> {t('settings.auth.title')}
              </h2>
              <div className="text-ink-dim group-hover:text-ink transition-colors">
                {isAuthExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>
            
            <AnimatePresence>
              {isAuthExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-6"
                >
                  {!authToken ? (
                    <button 
                      onClick={handleLogin}
                      className="w-full py-4 px-6 accent-bg hover:opacity-90 text-white rounded-2xl font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3"
                    >
                      {pin ? t('settings.auth.waitingForPlex') : t('settings.auth.loginWithPlex')}
                    </button>
                  ) : (
                    <div className="p-4 glass rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={24} />
                        </div>
                        <span className="font-medium text-ink">{t('settings.auth.signedIn')}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setAuthToken(null);
                          setSelectedServer(null);
                          setSelectedLibrary(null);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-widest"
                      >
                        {t('settings.auth.signOut')}
                      </button>
                    </div>
                  )}

                  {authToken && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
                        <Server size={14} /> {t('settings.auth.serverSelection')}
                      </h3>
                      {loading ? (
                        <div className="animate-pulse h-12 glass rounded-xl"></div>
                      ) : servers.length > 0 ? (
                        <div className="grid gap-2">
                          {servers.map(server => (
                            <button
                              key={server.clientIdentifier}
                              onClick={() => setSelectedServer(server)}
                              className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                                selectedServer?.clientIdentifier === server.clientIdentifier 
                                ? 'bg-accent/10 border-accent/50 accent-text' 
                                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-ink-dim hover:border-black/20 dark:hover:border-white/20'
                              }`}
                            >
                              <span className="font-medium">{server.name}</span>
                              {selectedServer?.clientIdentifier === server.clientIdentifier && <CheckCircle2 size={18} />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-ink-muted text-sm italic">{t('settings.auth.noServers')}</p>
                      )}
                    </div>
                  )}

                  {selectedServer && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
                        <Library size={14} /> {t('settings.auth.librarySelection')}
                      </h3>
                      {libraries.length > 0 ? (
                        <div className="grid gap-2">
                          {libraries.map(library => (
                            <button
                              key={library.key}
                              onClick={() => setSelectedLibrary(library)}
                              className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                                selectedLibrary?.key === library.key 
                                ? 'bg-accent/10 border-accent/50 accent-text' 
                                : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-ink-dim hover:border-black/20 dark:hover:border-white/20'
                              }`}
                            >
                              <span className="font-medium">{library.title}</span>
                              {selectedLibrary?.key === library.key && <CheckCircle2 size={18} />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-ink-muted text-sm italic">{t('settings.auth.noLibraries')}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Language Section shadow removal if any */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
              <Languages size={16} /> {t('settings.language.title')}
            </h2>
            <div className="relative group">
              <select 
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  i18n.changeLanguage(e.target.value);
                }}
                className="w-full h-12 glass rounded-2xl px-5 text-sm font-bold text-ink appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all lowercase tracking-widest"
              >
                <option value="en">{t('settings.language.en')}</option>
                <option value="de">{t('settings.language.de')}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none group-hover:text-ink transition-colors">
                <ChevronDown size={20} />
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
              <Monitor size={16} /> {t('settings.appearance.title')}
            </h2>
            <div className="flex gap-2 p-1 glass rounded-2xl w-full">
              {[
                { id: 'light', label: t('settings.appearance.light'), icon: <Sun size={14} /> },
                { id: 'dark', label: t('settings.appearance.dark'), icon: <Moon size={14} /> },
                { id: 'system', label: t('settings.appearance.system'), icon: <Monitor size={14} /> },
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setTheme(item.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${theme === item.id ? 'accent-bg text-white shadow-lg' : 'text-ink-muted hover:text-ink-dim'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Info Section */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
              <Info size={16} /> {t('settings.info.title')}
            </h2>
            <div className="p-4 glass rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-ink-dim font-bold uppercase tracking-wider">{t('settings.info.version')}</span>
                <span className="text-sm font-mono text-ink bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">{APP_VERSION}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-ink-dim font-bold uppercase tracking-wider">{t('settings.info.lastUpdated')}</span>
                <span className="text-sm text-ink">{LAST_UPDATED}</span>
              </div>
              <div className="pt-2 border-t border-white/5 text-[10px] text-ink-muted text-center uppercase tracking-widest leading-relaxed">
                {t('settings.info.tagline')}
              </div>
            </div>
          </section>

          {/* Privacy Section */}
          <section className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-ink-dim flex items-center gap-2">
              <ShieldCheck size={16} /> {t('settings.privacy.title')}
            </h2>
            <div className="p-6 glass rounded-2xl space-y-6">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-ink flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-accent" /> {t('settings.privacy.dataTitle')}
                </h3>
                <p className="text-xs text-ink-dim leading-relaxed text-left">
                  {t('settings.privacy.dataText')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-ink flex items-center gap-2">
                  <Server size={14} className="text-accent" /> {t('settings.privacy.hostingTitle')}
                </h3>
                <p className="text-xs text-ink-dim leading-relaxed text-left">
                  {t('settings.privacy.hostingText')}
                </p>
              </div>

              <div className="pt-4 border-t border-white/5">
                <h3 className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1">
                  {t('settings.privacy.gdprTitle')}
                </h3>
                <p className="text-[10px] text-ink-muted leading-tight text-left">
                  {t('settings.privacy.gdprText')}
                </p>
              </div>
            </div>
          </section>

          {/* Data Section */}
          <section className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest font-bold text-red-500/80 flex items-center gap-2">
              <Trash2 size={16} /> {t('settings.danger.title')}
            </h2>
            
            {!showClearConfirm ? (
              <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-4 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-bold transition-all flex items-center justify-center gap-3"
              >
                <Trash2 size={18} /> {t('settings.danger.clearData')}
              </button>
            ) : (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-6 glass rounded-2xl border border-red-500/30 text-center space-y-4"
              >
                <div className="flex justify-center text-red-500">
                  <AlertTriangle size={48} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-ink">{t('settings.danger.confirmTitle')}</h3>
                  <p className="text-xs text-ink-dim">{t('settings.danger.confirmText')}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-3 px-4 glass border border-white/10 text-ink-dim hover:text-ink rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    {t('settings.danger.cancel')}
                  </button>
                  <button 
                    onClick={() => {
                      clearAllData();
                      setShowClearConfirm(false);
                    }}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-red-600/30"
                  >
                    {t('settings.danger.clearEverything')}
                  </button>
                </div>
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

