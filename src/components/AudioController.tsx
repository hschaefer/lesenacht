import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { downloadService } from '../services/downloadService';
import { Network } from '@capacitor/network';
import { registerPlugin } from '@capacitor/core';

interface AudioPluginInterface {
  startPlayback(options: { title: string; author: string }): Promise<void>;
  updatePlayback(options: { 
    isPlaying?: boolean; 
    position?: number; 
    duration?: number; 
    speed?: number;
    title?: string;
    author?: string;
    thumbUrl?: string | null;
  }): Promise<void>;
  stopPlayback(): Promise<void>;
  addListener(eventName: 'onAction', listenerFunc: (data: { type: string; seekTo?: number }) => void): Promise<any>;
}

const AudioPlugin = registerPlugin<AudioPluginInterface>('AudioPlugin');

export function AudioController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { 
    isPlaying, 
    currentBook,
    currentTrack, 
    currentTime, 
    duration,
    setCurrentTime, 
    setDuration, 
    playbackSpeed, 
    volume,
    setPlaying,
    saveProgress,
    sleepTimerEnd,
    setSleepTimer,
    downloadedTracks,
    isNetworkConnected,
    setNetworkConnected,
    isOfflineMode,
  } = usePlayerStore();
  
  const { authToken, selectedServer } = useAuthStore();
  const effectiveToken = selectedServer?.accessToken || authToken;
  
  // Refs for MediaSession handlers to avoid stale closures without re-binding
  const stateRef = useRef({
    isPlaying,
    currentTime,
    duration,
    currentTrack,
    currentBook,
    effectiveToken,
    selectedServer
  });

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      currentTime,
      duration,
      currentTrack,
      currentBook,
      effectiveToken,
      selectedServer
    };
  }, [isPlaying, currentTime, duration, currentTrack, currentBook, effectiveToken, selectedServer]);
  const lastReportRef = useRef<number>(0);
  const lastStateRef = useRef<'playing' | 'paused' | 'stopped' | null>(null);
  const isMountRef = useRef(true);
  const hasReportedRef = useRef(false);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [isNative, setIsNative] = useState(false);
  const [localThumb, setLocalThumb] = useState<string | null>(null);

  // Check for local thumb if book is downloaded
  useEffect(() => {
    if (!currentBook || !isNative) {
      setLocalThumb(null);
      return;
    }

    const checkLocalThumb = async () => {
      try {
        const books = await downloadService.getDownloadedBooks();
        const downloadedBook = books.find(b => b.ratingKey === currentBook.ratingKey);
        if (downloadedBook?.localThumb) {
          const localUrl = await downloadService.getLocalFileUrl(downloadedBook.localThumb);
          setLocalThumb(localUrl);
        } else {
          setLocalThumb(null);
        }
      } catch (e) {
        setLocalThumb(null);
      }
    };

    checkLocalThumb();
  }, [currentBook?.ratingKey, isNative]);

  // Start/stop Android foreground service to keep process alive in background
  useEffect(() => {
    if (!isNative) return;
    if (isPlaying && currentTrack) {
      AudioPlugin.startPlayback({
        title: currentTrack.title || 'Lesenacht',
        author: currentBook?.title || '',
      }).catch(() => {});
    } else if (!isPlaying) {
      // We don't stop the service immediately when paused, 
      // but we update it. We only stop it if currentTrack is gone.
      if (!currentTrack) {
        AudioPlugin.stopPlayback().catch(() => {});
      }
    }
  }, [isPlaying, isNative, currentTrack?.ratingKey]);

  // Sync state to native Android service for notification controls
  useEffect(() => {
    if (!isNative || !currentTrack) return;
    
    const connections = selectedServer?.connections || [];
    const serverBaseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri || '';
    const thumbPath = currentTrack.thumb || currentBook?.thumb;
    const thumbUrl = thumbPath ? plexService.getThumbUrl(serverBaseUrl, thumbPath, effectiveToken || '', 512, 512) : null;

    AudioPlugin.updatePlayback({
      isPlaying,
      position: currentTime,
      duration: duration,
      speed: playbackSpeed,
      title: currentTrack.title,
      author: currentBook?.title || '',
      thumbUrl
    }).catch(() => {});
  }, [isPlaying, currentTime, duration, playbackSpeed, currentTrack, currentBook, isNative, effectiveToken, selectedServer]);

  // Listen for actions from the native notification (Android)
  useEffect(() => {
    if (!isNative) return;

    const listener = AudioPlugin.addListener('onAction', (data) => {
      switch (data.type) {
        case 'play':
          setPlaying(true);
          break;
        case 'pause':
          setPlaying(false);
          break;
        case 'seekforward': {
          const newTime = Math.min(stateRef.current.duration, stateRef.current.currentTime + 30);
          setCurrentTime(newTime);
          break;
        }
        case 'seekbackward': {
          const newTime = Math.max(0, stateRef.current.currentTime - 15);
          setCurrentTime(newTime);
          break;
        }
        case 'seekto':
          if (data.seekTo !== undefined) {
            setCurrentTime(data.seekTo);
          }
          break;
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [isNative, setPlaying, setCurrentTime]);

  // Network status monitoring
  useEffect(() => {
    const checkNetwork = async () => {
      const status = await downloadService.getNetworkStatus();
      setNetworkConnected(status.connected);
    };
    
    checkNetwork();
    
    const listener = Network.addListener('networkStatusChange', (status) => {
      setNetworkConnected(status.connected);
    });
    
    return () => {
      listener.then(l => l.remove());
    };
  }, [setNetworkConnected]);

  // Check if native platform
  useEffect(() => {
    downloadService.isNative().then(setIsNative);
  }, []);

  // Determine audio source - prefer local file when offline or when downloaded
  useEffect(() => {
    if (!currentTrack) {
      setAudioSrc('');
      return;
    }

    const determineSource = async () => {
      // Check if we have a downloaded version of this track
      const downloadedInfo = downloadedTracks[currentTrack.ratingKey];
      
      if (downloadedInfo && isNative) {
        try {
          const localUri = await downloadService.getLocalFileUrl(downloadedInfo.localPath);
          setAudioSrc(localUri);
          return;
        } catch (e) {
          console.warn('Failed to get local file URI, falling back to streaming:', e);
        }
      }

      // Fall back to streaming if network is available
      if ((!isOfflineMode && isNetworkConnected) || !downloadedInfo) {
        if (selectedServer && effectiveToken) {
          const connections = selectedServer?.connections || [];
          const baseUrl = connections.find((c: any) => !c.local && !c.relay)?.uri 
            || connections.find((c: any) => c.local)?.uri 
            || connections[0]?.uri;
          const partKey = currentTrack?.Media?.[0]?.Part?.[0]?.key;
          
          if (baseUrl && partKey) {
            const streamUrl = plexService.getMediaUrl(baseUrl, partKey, effectiveToken);
            setAudioSrc(streamUrl);
            return;
          }
        }
      }

      // No source available
      setAudioSrc('');
    };

    determineSource();
  }, [currentTrack?.ratingKey, downloadedTracks, isNetworkConnected, isOfflineMode, selectedServer, effectiveToken, isNative]);

  // Handle Plex Playback Reporting
  useEffect(() => {
    if (!currentTrack || !selectedServer || !effectiveToken) return;

    // On initial mount, initialize state without reporting — avoids spurious paused/stopped
    // reports with duration=0 before audio metadata loads or server token refreshes.
    if (isMountRef.current) {
      isMountRef.current = false;
      lastStateRef.current = isPlaying ? 'playing' : 'paused';
      return;
    }

    // Skip until audio metadata is loaded (duration=0 causes 400 from Plex)
    if (duration === 0) return;

    const connections = selectedServer?.connections || [];
    const serverBaseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
    if (!serverBaseUrl) return;

    const currentState = isPlaying ? 'playing' : 'paused';
    const now = Date.now();
    const shouldReport =
      currentState !== lastStateRef.current ||
      (isPlaying && now - lastReportRef.current >= 10000);

    if (shouldReport) {
      plexService.reportPlayback(serverBaseUrl, effectiveToken, {
        ratingKey: currentTrack.ratingKey,
        state: currentState,
        time: currentTime * 1000,
        duration: duration * 1000
      });
      lastReportRef.current = now;
      lastStateRef.current = currentState;
      hasReportedRef.current = true;
    }
  }, [isPlaying, currentTime, currentTrack, duration, selectedServer, effectiveToken]);

  // Report 'stopped' when track changes or unmounts
  useEffect(() => {
    const track = currentTrack;
    const server = selectedServer;
    const token = effectiveToken;

    return () => {
      if (track && server && token && hasReportedRef.current && lastStateRef.current !== 'stopped') {
        const connections = server?.connections || [];
        const serverBaseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
        if (serverBaseUrl) {
          plexService.reportPlayback(serverBaseUrl, token, {
            ratingKey: track.ratingKey,
            state: 'stopped',
            time: usePlayerStore.getState().currentTime * 1000,
            duration: usePlayerStore.getState().duration * 1000
          });
        }
      }
    };
  }, [currentTrack?.ratingKey]); // Track key change triggers cleanup of old track report

  // Handle Sleep Timer
  useEffect(() => {
    if (!isPlaying || !sleepTimerEnd) return;

    const interval = setInterval(() => {
      if (Date.now() >= sleepTimerEnd) {
        setPlaying(false);
        setSleepTimer(null);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, sleepTimerEnd, setPlaying, setSleepTimer]);

  // Periodically save progress to the map locally
  useEffect(() => {
    if (isPlaying && currentTrack && currentTime > 0) {
      saveProgress(currentTrack.ratingKey, currentTime, duration);
    }
  }, [isPlaying, currentTime, currentTrack, duration, saveProgress]);

  useEffect(() => {
    if (audioRef.current && audioSrc) {
      audioRef.current.load();
    }
  }, [audioSrc]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Media Session Metadata & Handlers
  useEffect(() => {
    if (!audioRef.current || !currentTrack || !('mediaSession' in navigator)) return;

    const connections = selectedServer?.connections || [];
    const serverBaseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
    const thumbUrl = currentTrack.thumb || currentBook?.thumb;
    
    // Attempt to get artwork - prefer local if available
    let artworkUrl = localThumb;
    if (!artworkUrl && thumbUrl) {
      artworkUrl = plexService.getThumbUrl(serverBaseUrl, thumbUrl, effectiveToken, 512, 512);
    }
    
    // If we have downloaded info, we might want to check for local thumb, 
    // but currentBook doesn't have it easily available here yet.
    // For now, at least ensure we have a valid URL.

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentBook?.title || '',
      album: currentBook?.title || '',
      artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => setPlaying(true)],
      ['pause', () => setPlaying(false)],
      ['seekbackward', (details) => {
        const skipTime = details.seekOffset || 15;
        const newTime = Math.max(0, stateRef.current.currentTime - skipTime);
        setCurrentTime(newTime);
      }],
      ['seekforward', (details) => {
        const skipTime = details.seekOffset || 30;
        const newTime = Math.min(stateRef.current.duration, stateRef.current.currentTime + skipTime);
        setCurrentTime(newTime);
      }],
      ['previoustrack', () => {
        // Implementation for previous track if needed
      }],
      ['nexttrack', () => {
        // Implementation for next track if needed
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          setCurrentTime(details.seekTime);
        }
      }]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`The media session action "${action}" is not supported yet.`);
      }
    }

    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {}
      }
    };
  }, [currentTrack?.ratingKey, currentBook?.ratingKey, effectiveToken, selectedServer]); // Removed isPlaying and currentTime

  // Update Media Session Playback State
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Update Media Session position state
  useEffect(() => {
    if ('mediaSession' in navigator && audioRef.current && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackSpeed,
          position: currentTime
        });
      } catch (e) {
        // Some browsers might fail if values are inconsistent
      }
    }
  }, [currentTime, duration, playbackSpeed]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          if (err.name !== 'AbortError') {
            console.error("Audio Playback Error:", err);
            // Don't auto-reset playing state on initial load attempts as it might be race condition
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.ratingKey]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 2) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleLoadedMetadata = () => {
    if (audioRef.current && currentTrack) {
      setDuration(audioRef.current.duration);
      
      // Resume from saved position for this specific track
      const savedData = usePlayerStore.getState().progressMap[currentTrack.ratingKey];
      const savedTime = savedData?.time || currentTime;
      if (savedTime > 0) {
        audioRef.current.currentTime = savedTime;
      }
    }
  };

  const handleEnded = () => {
    const { queue, currentTrack: endedTrack, setCurrentTrack: switchTrack } = usePlayerStore.getState();
    if (queue.length > 1 && endedTrack) {
      const currentIdx = queue.findIndex((t: any) => t.ratingKey === endedTrack.ratingKey);
      if (currentIdx >= 0 && currentIdx < queue.length - 1) {
        switchTrack(queue[currentIdx + 1]);
        setPlaying(true);
        return;
      }
    }
    setPlaying(false);
  };

  const handlePlay = () => {
    if (!isPlaying) setPlaying(true);
  };

  const handlePause = () => {
    if (isPlaying) setPlaying(false);
  };

  const handleCanPlay = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.error("onCanPlay Error:", err);
        }
      });
    }
  };

  if (!currentTrack) return null;

  // If no audio source and we need network, show warning
  if (!audioSrc && !isNetworkConnected && !downloadedTracks[currentTrack.ratingKey]) {
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg shadow-lg z-50">
        <p className="text-sm font-medium">Offline - This track is not downloaded</p>
      </div>
    );
  }

  return (
    <audio
      ref={audioRef}
      src={audioSrc}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onEnded={handleEnded}
      onPlay={handlePlay}
      onPause={handlePause}
      style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
    />
  );
}
