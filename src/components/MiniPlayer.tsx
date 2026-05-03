import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, ChevronUp } from 'lucide-react';
import { usePlayerStore, useAuthStore } from '../store/useStore';
import { plexService } from '../services/plexService';

import { CoverImage } from './CoverImage';

export function MiniPlayer({ onClick }: { onClick: () => void }) {
  const { currentBook, isPlaying, setPlaying, currentTime, duration } = usePlayerStore();
  const { authToken, selectedServer } = useAuthStore();
  const effectiveToken = selectedServer?.accessToken || authToken;

  if (!currentBook) return null;

  const connections = selectedServer?.connections || [];
  const baseUrl = connections.find((c: any) => !c.local)?.uri || connections[0]?.uri || '';

  const thumbUrl = plexService.getThumbUrl(baseUrl, currentBook.thumb, effectiveToken || '', 100, 100);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <motion.div 
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="mx-4 glass rounded-2xl shadow-2xl overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden -z-10 opacity-40">
        <div 
          className="absolute inset-0 bg-cover bg-center blur-2xl scale-125" 
          style={{ backgroundImage: `url(${thumbUrl})` }}
        />
        <div className="absolute inset-0 bg-bg/40" />
      </div>

      <div className="flex items-center p-3 gap-3 relative z-10">
        <CoverImage 
          src={thumbUrl} 
          className="w-12 h-12 rounded-lg shadow-lg"
          alt={currentBook.title}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-ink truncate">{currentBook.title}</h4>
          <p className="text-xs text-ink-dim truncate">{currentBook.parentTitle || currentBook.grandparentTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setPlaying(!isPlaying);
            }}
            className="w-10 h-10 accent-bg rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
          </button>
        </div>
      </div>
      <div className="w-full progress-track">
        <motion.div 
          className="h-full accent-bg shadow-[0_0_8px_rgba(249,115,22,0.5)]" 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
