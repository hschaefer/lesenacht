import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { plexService } from './plexService';

export interface DownloadedTrack {
  ratingKey: string;
  parentRatingKey: string;
  title: string;
  parentTitle: string;
  duration: number;
  index: number;
  localPath: string;
  downloadedAt: number;
  fileSize?: number;
}

export interface DownloadedBook {
  ratingKey: string;
  title: string;
  parentTitle: string;
  thumb?: string;
  summary?: string;
  tracks: DownloadedTrack[];
  downloadedAt: number;
  totalSize?: number;
}

const DOWNLOADS_KEY = 'lesenacht_downloads';
const AUDIOBOOKS_DIR = 'audiobooks';

async function ensureAudiobooksDirectory(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: AUDIOBOOKS_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e) {
    // Directory likely already exists
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_\.]/g, '_').substring(0, 100);
}

export const downloadService = {
  async isNative(): Promise<boolean> {
    return typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();
  },

  async getNetworkStatus() {
    return await Network.getStatus();
  },

  async getDownloadedBooks(): Promise<DownloadedBook[]> {
    const { value } = await Preferences.get({ key: DOWNLOADS_KEY });
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  },

  async saveDownloadedBooks(books: DownloadedBook[]): Promise<void> {
    await Preferences.set({
      key: DOWNLOADS_KEY,
      value: JSON.stringify(books),
    });
  },

  async isBookDownloaded(ratingKey: string): Promise<boolean> {
    const books = await this.getDownloadedBooks();
    return books.some(b => b.ratingKey === ratingKey);
  },

  async isTrackDownloaded(ratingKey: string): Promise<boolean> {
    const books = await this.getDownloadedBooks();
    return books.some(b => b.tracks.some(t => t.ratingKey === ratingKey));
  },

  async getDownloadedTrackPath(ratingKey: string): Promise<string | null> {
    const books = await this.getDownloadedBooks();
    for (const book of books) {
      const track = book.tracks.find(t => t.ratingKey === ratingKey);
      if (track) {
        return track.localPath;
      }
    }
    return null;
  },

  async downloadBook(
    baseUrl: string,
    token: string,
    book: { ratingKey: string; title: string; parentTitle: string; thumb?: string; summary?: string },
    tracks: any[],
    onProgress?: (trackIndex: number, totalTracks: number, progress: number) => void
  ): Promise<DownloadedBook> {
    if (!(await this.isNative())) {
      throw new Error('Downloads only supported in native apps');
    }

    await ensureAudiobooksDirectory();

    const downloadedTracks: DownloadedTrack[] = [];
    const bookDir = `${AUDIOBOOKS_DIR}/${sanitizeFileName(book.title)}_${book.ratingKey}`;

    try {
      await Filesystem.mkdir({
        path: bookDir,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (e) {
      // Directory may already exist
    }

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const partKey = track?.Media?.[0]?.Part?.[0]?.key;

      if (!partKey) {
        console.warn(`No part key for track ${track.title}`);
        continue;
      }

      const downloadUrl = plexService.getDownloadUrl(baseUrl, partKey, token);
      const fileName = `${sanitizeFileName(track.title || `track_${i + 1}`)}_${track.ratingKey}.mp3`;
      const filePath = `${bookDir}/${fileName}`;

      try {
        onProgress?.(i, tracks.length, 0);

        // Listen for progress
        const progressListener = await Filesystem.addListener('progress', (progress) => {
          if (progress.url === downloadUrl) {
            // Note: Native progress ranges might vary by platform, sometimes bytes, sometimes percent
            // Using bytes if total is provided, otherwise percent
            let progressPercent = 0;
            if (progress.bytes && progress.contentLength && progress.contentLength > 0) {
              progressPercent = Math.round((progress.bytes / progress.contentLength) * 100);
            }
            onProgress?.(i, tracks.length, progressPercent);
          }
        });

        // Download using Capacitor native downloader
        const result = await Filesystem.downloadFile({
          url: downloadUrl,
          path: filePath,
          directory: Directory.Data,
          progress: true // Enable progress events
        });
        
        // Remove listener after download
        await progressListener.remove();
        
        let fileSize = 0;
        try {
          const stat = await Filesystem.stat({
            path: filePath,
            directory: Directory.Data,
          });
          fileSize = stat.size;
        } catch (e) {
          console.warn('Failed to get file size:', e);
        }

        downloadedTracks.push({
          ratingKey: track.ratingKey,
          parentRatingKey: book.ratingKey,
          title: track.title || `Track ${i + 1}`,
          parentTitle: book.title,
          duration: track.duration || 0,
          index: track.index || i + 1,
          localPath: filePath,
          downloadedAt: Date.now(),
          fileSize: fileSize,
        });

        onProgress?.(i, tracks.length, 100);
      } catch (error) {
        console.error(`Failed to download track ${track.title}:`, error);
        throw error;
      }
    }

    const downloadedBook: DownloadedBook = {
      ratingKey: book.ratingKey,
      title: book.title,
      parentTitle: book.parentTitle,
      thumb: book.thumb,
      summary: book.summary,
      tracks: downloadedTracks,
      downloadedAt: Date.now(),
      totalSize: downloadedTracks.reduce((sum, t) => sum + (t.fileSize || 0), 0),
    };

    // Save to preferences
    const existingBooks = await this.getDownloadedBooks();
    const filteredBooks = existingBooks.filter(b => b.ratingKey !== book.ratingKey);
    filteredBooks.push(downloadedBook);
    await this.saveDownloadedBooks(filteredBooks);

    return downloadedBook;
  },

  async deleteBook(ratingKey: string): Promise<void> {
    if (!(await this.isNative())) {
      throw new Error('Downloads only supported in native apps');
    }

    const books = await this.getDownloadedBooks();
    const book = books.find(b => b.ratingKey === ratingKey);

    if (!book) return;

    // Delete all track files and get book directory from first track
    let bookDir = '';
    for (const track of book.tracks) {
      try {
        await Filesystem.deleteFile({
          path: track.localPath,
          directory: Directory.Data,
        });
        if (!bookDir) {
          bookDir = track.localPath.split('/').slice(0, -1).join('/');
        }
      } catch (e) {
        console.warn(`Failed to delete file ${track.localPath}:`, e);
      }
    }

    // Delete book directory
    if (bookDir) {
      try {
        await Filesystem.rmdir({
          path: bookDir,
          directory: Directory.Data,
          recursive: true,
        });
      } catch (e) {
        console.warn(`Failed to delete directory ${bookDir}:`, e);
      }
    }

    // Update preferences
    const filteredBooks = books.filter(b => b.ratingKey !== ratingKey);
    await this.saveDownloadedBooks(filteredBooks);
  },

  async getLocalFileUrl(filePath: string): Promise<string> {
    const result = await Filesystem.getUri({
      path: filePath,
      directory: Directory.Data,
    });
    return result.uri;
  },

  async getAvailableSpace(): Promise<number> {
    try {
      const stat = await Filesystem.stat({
        path: '.',
        directory: Directory.Data,
      });
      // This may not give accurate free space on all platforms
      return 0;
    } catch {
      return 0;
    }
  },
};
