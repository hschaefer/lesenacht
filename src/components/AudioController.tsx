import React, { useRef, useEffect } from 'react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';

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
    setSleepTimer
  } = usePlayerStore();
  const { authToken, selectedServer } = useAuthStore();
  const effectiveToken = selectedServer?.accessToken || authToken;
  const lastReportRef = useRef<number>(0);
  const lastStateRef = useRef<'playing' | 'paused' | 'stopped' | null>(null);

  // Handle Plex Playback Reporting
  useEffect(() => {
    if (!currentTrack || !selectedServer || !effectiveToken) return;

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
    }
  }, [isPlaying, currentTime, currentTrack, duration, selectedServer, effectiveToken]);

  // Report 'stopped' when track changes or unmounts
  useEffect(() => {
    const track = currentTrack;
    const server = selectedServer;
    const token = effectiveToken;

    return () => {
      if (track && server && token && lastStateRef.current !== 'stopped') {
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

  if (!currentTrack || !selectedServer || !authToken) return null;

  const connections = selectedServer?.connections || [];
  // Prefer remote connections that are not relayed, then internal ones
  const baseUrl = connections.find((c: any) => !c.local && !c.relay)?.uri 
    || connections.find((c: any) => c.local)?.uri 
    || connections[0]?.uri;
  
  const partKey = currentTrack?.Media?.[0]?.Part?.[0]?.key;
  
  if (!baseUrl || !partKey) return null;

  const streamUrl = plexService.getMediaUrl(baseUrl, partKey, effectiveToken!);

  return (
    <audio
      ref={audioRef}
      src={streamUrl}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onEnded={handleEnded}
      className="hidden"
    />
  );
}
