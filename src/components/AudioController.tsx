import React, { useRef, useEffect, useState } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';
import { downloadService } from '../services/downloadService';
import { Network } from '@capacitor/network';

export function AudioController() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { 
    isPlaying, 
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
  const lastReportRef = useRef<number>(0);
  const lastStateRef = useRef<'playing' | 'paused' | 'stopped' | null>(null);
  const isMountRef = useRef(true);
  const hasReportedRef = useRef(false);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [isNative, setIsNative] = useState(false);

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
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

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
    setPlaying(false);
    // Future: Auto-play next track in queue
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
      className="hidden"
    />
  );
}
