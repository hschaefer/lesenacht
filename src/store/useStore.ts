import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DownloadProgress {
  bookKey: string;
  trackIndex: number;
  totalTracks: number;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
}

interface DownloadedTrackInfo {
  ratingKey: string;
  localPath: string;
  downloadedAt: number;
}

interface PlayerState {
  isPlaying: boolean;
  currentBook: any | null;
  currentTrack: any | null;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  volume: number;
  queue: any[];
  bookmarks: { trackKey: string; time: number; label: string; date: number }[];
  progressMap: Record<string, { time: number; duration: number; lastPlayed: number }>; // Map track ratingKey to its last position and total duration
  lastTrackByBook: Record<string, string>; // Map book ratingKey to last played track ratingKey
  bookQueues: Record<string, { ratingKey: string; duration: number }[]>; // Map book ratingKey to its ordered track stubs
  sleepTimerEnd: number | null; // Timestamp when player should stop
  isNetworkConnected: boolean;
  activeDownloads: Record<string, DownloadProgress>; // Map bookKey to download progress
  downloadedTracks: Record<string, DownloadedTrackInfo>; // Map track ratingKey to download info
  isOfflineMode: boolean;

  setPlaying: (playing: boolean) => void;
  setCurrentBook: (book: any) => void;
  setCurrentTrack: (track: any) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setQueue: (queue: any[]) => void;
  addBookmark: (trackKey: string, time: number, label: string) => void;
  removeBookmark: (trackKey: string, date: number) => void;
  saveProgress: (trackKey: string, time: number, duration: number) => void;
  resetProgress: (bookKey: string) => void;
  markAsFinished: (bookKey: string, trackKey: string, duration: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  setNetworkConnected: (connected: boolean) => void;
  setDownloadProgress: (bookKey: string, progress: DownloadProgress) => void;
  clearDownloadProgress: (bookKey: string) => void;
  addDownloadedTrack: (trackKey: string, info: DownloadedTrackInfo) => void;
  removeDownloadedBook: (bookKey: string, trackKeys: string[]) => void;
  setDownloadedTracks: (tracks: Record<string, DownloadedTrackInfo>) => void;
  setOfflineMode: (offline: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      isPlaying: false,
      currentBook: null,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
      playbackSpeed: 1.0,
      volume: 1.0,
      queue: [],
      bookmarks: [],
      progressMap: {},
      lastTrackByBook: {},
      bookQueues: {},
      sleepTimerEnd: null,
      isNetworkConnected: true,
      activeDownloads: {},
      downloadedTracks: {},
      isOfflineMode: false,

      setPlaying: (playing) => set({ isPlaying: playing }),
      setCurrentBook: (book) => set({ currentBook: book }),
      setCurrentTrack: (track) => {
        set((state) => {
          const newLastTracks = { ...state.lastTrackByBook };
          if (track && state.currentBook) {
            newLastTracks[state.currentBook.ratingKey] = track.ratingKey;
          }

          return {
            currentTrack: track,
            lastTrackByBook: newLastTracks,
            // When track changes, load stored time for this track or default to 0
            currentTime: track ? (state.progressMap[track.ratingKey]?.time || 0) : 0,
            duration: track ? (state.progressMap[track.ratingKey]?.duration || 0) : 0
          };
        });
      },
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration: duration }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      setVolume: (volume) => set({ volume: volume }),
      setQueue: (queue) => set((state) => {
        const bookKey = state.currentBook?.ratingKey;
        const newBookQueues = bookKey
          ? { ...state.bookQueues, [bookKey]: queue.map((t: any) => ({ ratingKey: t.ratingKey, duration: t.duration || 0 })) }
          : state.bookQueues;
        return { queue, bookQueues: newBookQueues };
      }),
      addBookmark: (trackKey, time, label) => set((state) => ({
        bookmarks: [...state.bookmarks, { trackKey, time, label, date: Date.now() }]
      })),
      removeBookmark: (trackKey, date) => set((state) => ({
        bookmarks: state.bookmarks.filter(b => !(b.trackKey === trackKey && b.date === date))
      })),
      saveProgress: (trackKey, time, duration) => set((state) => ({
        progressMap: { ...state.progressMap, [trackKey]: { time, duration, lastPlayed: Date.now() } }
      })),
      resetProgress: (bookKey) => set((state) => {
        const lastTrackKey = state.lastTrackByBook[bookKey];
        if (!lastTrackKey) return state;

        const newProgressMap = { ...state.progressMap };
        delete newProgressMap[lastTrackKey];

        return { progressMap: newProgressMap };
      }),
      markAsFinished: (bookKey, trackKey, duration) => set((state) => {
        const newLastTracks = { ...state.lastTrackByBook };
        newLastTracks[bookKey] = trackKey;

        const newProgressMap = { ...state.progressMap };
        newProgressMap[trackKey] = { time: duration, duration, lastPlayed: Date.now() };

        return {
          lastTrackByBook: newLastTracks,
          progressMap: newProgressMap
        };
      }),
      setSleepTimer: (minutes) => set({
        sleepTimerEnd: minutes ? Date.now() + (minutes * 60 * 1000) : null
      }),
      setNetworkConnected: (connected) => set({ isNetworkConnected: connected }),
      setDownloadProgress: (bookKey, progress) => set((state) => ({
        activeDownloads: { ...state.activeDownloads, [bookKey]: progress }
      })),
      clearDownloadProgress: (bookKey) => set((state) => {
        const newDownloads = { ...state.activeDownloads };
        delete newDownloads[bookKey];
        return { activeDownloads: newDownloads };
      }),
      addDownloadedTrack: (trackKey, info) => set((state) => ({
        downloadedTracks: { ...state.downloadedTracks, [trackKey]: info }
      })),
      removeDownloadedBook: (bookKey, trackKeys) => set((state) => {
        const newDownloadedTracks = { ...state.downloadedTracks };
        for (const key of trackKeys) {
          delete newDownloadedTracks[key];
        }
        return { downloadedTracks: newDownloadedTracks };
      }),
      setDownloadedTracks: (tracks) => set({ downloadedTracks: tracks }),
      setOfflineMode: (offline) => set({ isOfflineMode: offline }),
    }),
    {
      name: 'plex-audio-player-storage',
      partialize: (state) => ({
        currentBook: state.currentBook,
        currentTrack: state.currentTrack,
        currentTime: state.currentTime,
        playbackSpeed: state.playbackSpeed,
        volume: state.volume,
        bookmarks: state.bookmarks,
        progressMap: state.progressMap,
        lastTrackByBook: state.lastTrackByBook,
        bookQueues: state.bookQueues,
        downloadedTracks: state.downloadedTracks,
      }),
    }
  )
);

interface AuthState {
  authToken: string | null;
  selectedServer: any | null;
  selectedLibrary: any | null;
  theme: 'light' | 'dark' | 'system';
  language: string;
  showVolumeControl: boolean;
  progressBarMode: 'main' | 'chapter' | 'both';
  
  setAuthToken: (token: string | null) => void;
  setSelectedServer: (server: any | null) => void;
  setSelectedLibrary: (library: any | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: string) => void;
  setShowVolumeControl: (show: boolean) => void;
  setProgressBarMode: (mode: 'main' | 'chapter' | 'both') => void;
  clearAllData: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authToken: null,
      selectedServer: null,
      selectedLibrary: null,
      theme: 'system',
      language: 'en',
      showVolumeControl: true,
      progressBarMode: 'both',
      
      setAuthToken: (token) => set({ authToken: token }),
      setSelectedServer: (server) => set({ selectedServer: server }),
      setSelectedLibrary: (library) => set({ selectedLibrary: library }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setShowVolumeControl: (show) => set({ showVolumeControl: show }),
      setProgressBarMode: (mode) => set({ progressBarMode: mode }),
      clearAllData: () => {
        set({ 
          authToken: null, 
          selectedServer: null, 
          selectedLibrary: null, 
          theme: 'system',
          language: 'en',
          showVolumeControl: true,
          progressBarMode: 'both'
        });
        usePlayerStore.setState({
          isPlaying: false,
          currentBook: null,
          currentTrack: null,
          currentTime: 0,
          duration: 0,
          playbackSpeed: 1.0,
          volume: 1.0,
          queue: [],
          bookmarks: [],
          progressMap: {},
          lastTrackByBook: {},
          sleepTimerEnd: null,
        });
        localStorage.clear();
      }
    }),
    {
      name: 'plex-audio-auth-storage',
    }
  )
);
