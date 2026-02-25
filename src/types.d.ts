interface SpotifyImage {
    url: string;
    height: number;
    width: number;
  }
interface UserProfile {
    country: string;
    display_name: string;
    email: string;
    explicit_content: { filter_enabled: boolean; filter_locked: boolean };
    external_urls: { spotify: string };
    followers: { href: string; total: number };
    href: string;
    id: string;
    images: SpotifyImage[];
    product: string;
    type: string;
    uri: string;
  }
interface SpotifyArtist {
    id: string;
    name: string;
    popularity: number;
    genres: string[];
    images: SpotifyImage[];
    external_urls: { spotify: string };
  }
interface SpotifyTrack {
    id: string;
    name: string;
    popularity: number;
    preview_url: string | null;
    external_urls: { spotify: string };
    album: {
      name: string;
      images: SpotifyImage[];
    };
    artists: { id: string; name: string }[];
  }
interface Paging<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    href: string;
    next: string | null;
    previous: string | null;
  }