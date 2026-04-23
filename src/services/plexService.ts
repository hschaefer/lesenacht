import axios from 'axios';
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
  'X-Plex-Version': '1.0.0',
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
      const proxyUrl = `/api/plex-proxy?url=${encodeURIComponent(url)}&token=${token}`;
      const response = await axios.get(proxyUrl);
      return response.data;
    }
  },

  async getLibrarySections(baseUrl: string, token: string) {
    const url = `${baseUrl}/library/sections`;
    const data = await this.fetch(url, token);
    return data.MediaContainer.Directory;
  },

  async getLibraryItems(baseUrl: string, sectionId: string, token: string) {
    // We want to fetch Albums as they represent individual audiobooks
    const url = `${baseUrl}/library/sections/${sectionId}/albums`;
    const data = await this.fetch(url, token);
    return data.MediaContainer.Metadata || [];
  },

  async getLibraryArtists(baseUrl: string, sectionId: string, token: string) {
    const url = `${baseUrl}/library/sections/${sectionId}/all?type=8`; // type 8 is Artist in Music library
    const data = await this.fetch(url, token);
    return data.MediaContainer.Metadata || [];
  },

  async getArtistAlbums(baseUrl: string, ratingKey: string, token: string) {
    const url = `${baseUrl}/library/metadata/${ratingKey}/children`;
    const data = await this.fetch(url, token);
    return data.MediaContainer.Metadata || [];
  },

  async getTrackMetadata(baseUrl: string, ratingKey: string, token: string) {
    const url = `${baseUrl}/library/metadata/${ratingKey}?includeChapters=1`;
    const data = await this.fetch(url, token);
    return data.MediaContainer.Metadata?.[0] || null;
  },

  async getItemDetails(baseUrl: string, ratingKey: string, token: string) {
    // For artist/album types, we usually want children (tracks)
    const url = `${baseUrl}/library/metadata/${ratingKey}/children`;
    const data = await this.fetch(url, token);
    return data.MediaContainer.Metadata || [];
  },

  async getItemMetadata(baseUrl: string, ratingKey: string, token: string) {
    const url = `${baseUrl}/library/metadata/${ratingKey}`;
    const data = await this.fetch(url, token);
    return data.MediaContainer.Metadata?.[0] || null;
  },

  getMediaUrl(baseUrl: string, partKey: string, token: string) {
    return `${baseUrl}${partKey}?X-Plex-Token=${token}`;
  },

  getDownloadUrl(baseUrl: string, partKey: string, token: string) {
    return `${baseUrl}${partKey}?download=1&X-Plex-Token=${token}`;
  },

  getThumbUrl(baseUrl: string, thumb: string, token: string, width = 300, height = 300) {
    if (!thumb) return null;
    // Use Plex's built-in image transcoder
    return `${baseUrl}/photo/:/transcode?url=${encodeURIComponent(thumb)}&width=${width}&height=${height}&X-Plex-Token=${token}`;
  }
};
