import React from 'react';
import { Book, User, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface CoverImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  type?: 'book' | 'author' | 'generic';
  size?: number | string;
}

export function CoverImage({ src, alt, className, type = 'book', size = 20 }: CoverImageProps) {
  const [error, setError] = React.useState(!src);

  if (!src || error) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-slate-800 text-slate-500",
          className
        )}
      >
        {type === 'book' && <Book size={size} />}
        {type === 'author' && <User size={size} />}
        {type === 'generic' && <ImageIcon size={size} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      className={cn("object-cover", className)}
      alt={alt}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
