import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  progressMap: Record<string, { time: number; duration: number }>; // Map track ratingKey to its last position and total duration
  lastTrackByBook: Record<string, string>; // Map book ratingKey to last played track ratingKey
  sleepTimerEnd: number | null; // Timestamp when player should stop
  
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
      sleepTimerEnd: null,
      
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
      setQueue: (queue) => set({ queue: queue }),
      addBookmark: (trackKey, time, label) => set((state) => ({
        bookmarks: [...state.bookmarks, { trackKey, time, label, date: Date.now() }]
      })),
      removeBookmark: (trackKey, date) => set((state) => ({
        bookmarks: state.bookmarks.filter(b => !(b.trackKey === trackKey && b.date === date))
      })),
      saveProgress: (trackKey, time, duration) => set((state) => ({
        progressMap: { ...state.progressMap, [trackKey]: { time, duration } }
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
        newProgressMap[trackKey] = { time: duration, duration };
        
        return { 
          lastTrackByBook: newLastTracks,
          progressMap: newProgressMap
        };
      }),
      setSleepTimer: (minutes) => set({ 
        sleepTimerEnd: minutes ? Date.now() + (minutes * 60 * 1000) : null 
      }),
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
      }),
    }
  )
);

interface AuthState {
  authToken: string | null;
  selectedServer: any | null;
  selectedLibrary: any | null;
  theme: 'light' | 'dark' | 'system';
  
  setAuthToken: (token: string | null) => void;
  setSelectedServer: (server: any | null) => void;
  setSelectedLibrary: (library: any | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  clearAllData: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authToken: null,
      selectedServer: null,
      selectedLibrary: null,
      theme: 'system',
      
      setAuthToken: (token) => set({ authToken: token }),
      setSelectedServer: (server) => set({ selectedServer: server }),
      setSelectedLibrary: (library) => set({ selectedLibrary: library }),
      setTheme: (theme) => set({ theme }),
      clearAllData: () => {
        set({ 
          authToken: null, 
          selectedServer: null, 
          selectedLibrary: null, 
          theme: 'system' 
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
