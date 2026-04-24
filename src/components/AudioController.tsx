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
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      // Only sync if the difference is small (playback)
      // Large differences (seeking) are handled by the effect below
      setCurrentTime(audioRef.current.currentTime);
    } else if (audioRef.current) {
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
  const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri;
  
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
