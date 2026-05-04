import axios from 'axios';
import { version as APP_VERSION } from '../../package.json';
import { Capacitor } from '@capacitor/core';

// Use a stored UUID or generate a new one for this browser
const getStoredClientId = () => {
  const key = 'plex_client_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'lesenacht-pwa-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
};

const PLEX_CLIENT_ID = getStoredClientId();
const PLEX_HEADERS = {
  'X-Plex-Product': 'Lesenacht',
  'X-Plex-Version': APP_VERSION,
  'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
  'X-Plex-Device': Capacitor.getPlatform() === 'web' ? 'Web Browser' : 'Mobile App',
  'X-Plex-Platform': Capacitor.getPlatform(),
};

export interface PlexPin {
  id: number;
  code: string;
  authAppUrl?: string;
}

export interface PlexTokenResponse {
  authToken: string | null;
}

export const plexService = {
  getClientId() {
    return PLEX_CLIENT_ID;
  },

  async getPin(): Promise<PlexPin> {
    const response = await axios.post('https://plex.tv/api/v2/pins', {
      strong: true
    }, {
      headers: {
        ...PLEX_HEADERS,
        'Accept': 'application/json'
      }
    });
    return response.data;
  },

  async checkPin(pinId: number): Promise<string | null> {
    const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
      headers: {
        ...PLEX_HEADERS,
        'Accept': 'application/json'
      }
    });
    return response.data.authToken || null;
  },

  async getResources(token: string) {
    const response = await axios.get('https://plex.tv/api/v2/resources?includeHttps=1', {
      headers: {
        ...PLEX_HEADERS,
        'X-Plex-Token': token,
        'Accept': 'application/json'
      }
    });
    return response.data;
  },

  async fetch(url: string, token: string) {
    const isNative = Capacitor.isNativePlatform();
    
    try {
      if (isNative) {
        // Direct call on native platforms (No CORS restrictions)
        const response = await axios.get(url, {
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Token': token,
            'Accept': 'application/json'
          }
        });
        return response.data;
      } else {
        // Use proxy on web to avoid CORS
        const proxyUrl = `/api/plex-proxy?url=${encodeURIComponent(url)}`;
        const response = await axios.get(proxyUrl, {
          headers: {
            ...PLEX_HEADERS,
            'X-Plex-Token': token,
            'Accept': 'application/json'
          }
        });
        
        // If the response is a string (like HTML from a fallback), it's an error
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          throw new Error('Proxy returned HTML instead of JSON. The proxy endpoint might be missing or misconfigured.');
        }
        
        return response.data;
      }
    } catch (error: any) {
      console.error(`Plex Fetch Error for ${url}:`, error.message);
      throw error;
    }
  },

  async getLibrarySections(baseUrl: string, token: string) {
    try {
      const url = `${baseUrl}/library/sections`;
      const data = await this.fetch(url, token);
      
      if (!data?.MediaContainer) {
        console.error('Invalid Plex response: missing MediaContainer', data);
        return [];
      }
      
      return data.MediaContainer.Directory || [];
    } catch (error) {
      console.error('Failed to get library sections:', error);
      return [];
    }
  },

  async getLibraryItems(baseUrl: string, sectionId: string, token: string) {
    try {
      // We want to fetch Albums as they represent individual audiobooks
      const url = `${baseUrl}/library/sections/${sectionId}/albums`;
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata || [];
    } catch (error) {
      console.error('Failed to get library items:', error);
      return [];
    }
  },

  async getLibraryArtists(baseUrl: string, sectionId: string, token: string) {
    try {
      const url = `${baseUrl}/library/sections/${sectionId}/all?type=8`; // type 8 is Artist in Music library
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata || [];
    } catch (error) {
      console.error('Failed to get library artists:', error);
      return [];
    }
  },

  async getLibraryTracks(baseUrl: string, sectionId: string, token: string) {
    try {
      const url = `${baseUrl}/library/sections/${sectionId}/all?type=10`; // type 10 = track
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata || [];
    } catch (error) {
      console.error('Failed to get library tracks:', error);
      return [];
    }
  },

  async getArtistAlbums(baseUrl: string, ratingKey: string, token: string) {
    try {
      const url = `${baseUrl}/library/metadata/${ratingKey}/children`;
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata || [];
    } catch (error) {
      console.error('Failed to get artist albums:', error);
      return [];
    }
  },

  async getTrackMetadata(baseUrl: string, ratingKey: string, token: string) {
    try {
      const url = `${baseUrl}/library/metadata/${ratingKey}?includeChapters=1`;
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata?.[0] || null;
    } catch (error) {
      console.error('Failed to get track metadata:', error);
      return null;
    }
  },

  async getItemDetails(baseUrl: string, ratingKey: string, token: string) {
    try {
      // For artist/album types, we usually want children (tracks)
      const url = `${baseUrl}/library/metadata/${ratingKey}/children`;
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata || [];
    } catch (error) {
      console.error('Failed to get item details:', error);
      return [];
    }
  },

  async getItemMetadata(baseUrl: string, ratingKey: string, token: string) {
    try {
      const url = `${baseUrl}/library/metadata/${ratingKey}`;
      const data = await this.fetch(url, token);
      return data?.MediaContainer?.Metadata?.[0] || null;
    } catch (error) {
      console.error('Failed to get item metadata:', error);
      return null;
    }
  },

  getMediaUrl(baseUrl: string, partKey: string, token: string) {
    return `${baseUrl}${partKey}?X-Plex-Token=${token}`;
  },

  getDownloadUrl(baseUrl: string, partKey: string, token: string) {
    return `${baseUrl}${partKey}?download=1&X-Plex-Token=${token}`;
  },

  getThumbUrl(baseUrl: string, thumb: string, token: string, width = 300, height = 300) {
    if (!thumb) return null;
    // Already an absolute URL (e.g. local capacitor:// or file:// path) — use as-is
    if (/^(https?|capacitor|file):\/\//.test(thumb)) return thumb;
    // Relative Plex path — needs a server base URL
    if (!baseUrl) return null;
    return `${baseUrl}/photo/:/transcode?url=${encodeURIComponent(thumb)}&width=${width}&height=${height}&X-Plex-Token=${token}`;
  },

  async reportPlayback(baseUrl: string, token: string, params: {
    ratingKey: string;
    state: 'playing' | 'paused' | 'stopped';
    time: number; // ms
    duration: number; // ms
  }) {
    try {
      const url = new URL(`${baseUrl}/:/timeline`);
      url.searchParams.append('ratingKey', params.ratingKey);
      url.searchParams.append('key', `/library/metadata/${params.ratingKey}`);
      url.searchParams.append('state', params.state);
      url.searchParams.append('time', Math.round(params.time).toString());
      url.searchParams.append('duration', Math.round(params.duration).toString());
      url.searchParams.append('context', 'music'); // Audiobooks are usually in music libraries
      
      // To ensure that Plex (and Tautulli) see the user's IP address rather than the Cloudflare proxy IP,
      // we attempt a direct 'no-cors' fetch from the browser first.
      // This is possible for GET requests where we don't need to read the response.
      if (!Capacitor.isNativePlatform()) {
        const directUrl = new URL(url.toString());
        directUrl.searchParams.append('X-Plex-Token', token);
        directUrl.searchParams.append('X-Plex-Client-Identifier', PLEX_CLIENT_ID);
        directUrl.searchParams.append('X-Plex-Product', 'Lesenacht');
        directUrl.searchParams.append('X-Plex-Version', APP_VERSION);
        
        try {
          // 'no-cors' mode allows sending the request to another origin without full CORS compliance,
          // but we won't be able to read the response. For a timeline update, this is sufficient.
          // Required Plex headers are passed as query params since no-cors strips custom headers.
          fetch(directUrl.toString(), { mode: 'no-cors', keepalive: true }).catch(() => {});
          // We still proceed to call the proxy version to be sure it's recorded if direct fails,
          // though this may result in double reporting if the user is technical, Tautulli 
          // usually merges these.
        } catch (e) {
          // ignore direct fetch errors
        }
      }

      // The fetch method in this service handles headers and proxying (required for metadata reading)
      return await this.fetch(url.toString(), token);
    } catch (error) {
      console.error('Failed to report playback to Plex:', error);
      return null;
    }
  }
};
