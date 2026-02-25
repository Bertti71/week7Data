const clientId: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = "http://127.0.0.1:5173/callback";
const scope = 
"user-read-private user-read-email user-top-read user-read-recently-played";

const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement | null;
const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLElement | null;

loginBtn?.addEventListener("click", () => redirectToAuthCodeFlow(clientId));
logoutBtn?.addEventListener("click", logout);

const params = new URLSearchParams(window.location.search);
const code = params.get("code");

init().catch((e) => setStatus(`Error: ${e?.message ?? String(e)}`));

async function init() {
  if (!clientId) {
    setStatus("Missing VITE_SPOTIFY_CLIENT_ID in .env");
    return;
  }

  const existingToken = sessionStorage.getItem("access_token");
  if (existingToken) return load(existingToken);

  if (!code) {
    setStatus("Not logged in.");
    return;
  }

  const token = await getAccessToken(clientId, code);
  sessionStorage.setItem("access_token", token);
  window.history.replaceState({}, document.title, "/");
  await load(token);
}


async function load(token: string) {
  setStatus("Loading…");

  const profileSection = document.getElementById("profile") as HTMLElement | null;
  if (profileSection) profileSection.style.display = "block";

  const profile = await api<UserProfile>(
    token,
    "https://api.spotify.com/v1/me"
  );

  populateUI(profile);

  const [top, recent] = await Promise.all([
    fetchTopArtists(token, 10),
    fetchRecentlyPlayed(token, 30),
  ]);

  const seen = new Set<string>();
  const recentArtists: { name: string; url: string }[] = [];

  for (const item of recent.items ?? []) {
    for (const a of item.track.artists ?? []) {
      if (!seen.has(a.name)) {
        seen.add(a.name);
        recentArtists.push({
          name: a.name,
          url: a.external_urls.spotify,
        });
      }
    }
  }

  renderArtistsBlocks(
    top.items.map((a) => ({
      name: a.name,
      url: a.external_urls.spotify,
    })),
    recentArtists
  );

  setStatus(`Logged in as ${profile.display_name ?? "user"}.`);
}


async function fetchTopArtists(token: string, limit = 10) {
  return api<{
    items: { name: string; external_urls: { spotify: string } }[];
  }>(
    token,
    `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=medium_term`
  );
}


async function fetchRecentlyPlayed(token: string, limit = 20) {
  return api<{
    items: {
      track: {
        artists: { name: string; external_urls: { spotify: string } }[];
      };
    }[];
  }>(token, `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`);
}


async function api<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    logout();
    throw new Error("Token expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as T;
}


function renderArtistsBlocks(
    mostPlayed: { name: string; url: string }[],
    recent: { name: string; url: string }[]
  ) {
    const mostList = document.getElementById("mostPlayedList") as HTMLOListElement | null;
    const recentList = document.getElementById("recentPlayedList") as HTMLOListElement | null;
  
    if (!mostList || !recentList) return;
  
    mostList.innerHTML = "";
    recentList.innerHTML = "";
  
    if (mostPlayed.length) {
      for (const a of mostPlayed) {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = a.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = a.name;
        li.appendChild(link);
        mostList.appendChild(li);
      }
    } else {
      mostList.innerHTML = "<li>(no data)</li>";
    }
  
    if (recent.length) {
      for (const a of recent.slice(0, 15)) {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = a.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = a.name;
        li.appendChild(link);
        recentList.appendChild(li);
      }
    } else {
      recentList.innerHTML = "<li>(no recent history)</li>";
    }
  }

function setStatus(msg: string) {
  if (statusEl) statusEl.innerText = msg;
}


function logout() {
  sessionStorage.removeItem("access_token");
  localStorage.removeItem("verifier");
  document.getElementById("extraArtists")?.remove();
  setStatus("Logged out.");
}


export async function redirectToAuthCodeFlow(clientId: string) {
  const verifier = randomString(64);
  localStorage.setItem("verifier", verifier);

  const challenge = await sha256base64url(verifier);

  const p = new URLSearchParams();
  p.append("client_id", clientId);
  p.append("response_type", "code");
  p.append("redirect_uri", redirectUri);
  p.append("scope", scope);
  p.append("code_challenge_method", "S256");
  p.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${p.toString()}`;
}


export async function getAccessToken(
  clientId: string,
  code: string
): Promise<string> {
  const verifier = localStorage.getItem("verifier");
  if (!verifier) throw new Error("Missing verifier. Click login again.");

  const p = new URLSearchParams();
  p.append("client_id", clientId);
  p.append("grant_type", "authorization_code");
  p.append("code", code);
  p.append("redirect_uri", redirectUri);
  p.append("code_verifier", verifier);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: p,
  });

  if (!res.ok) {
    throw new Error(`Token error: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}


function randomString(len: number) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}


async function sha256base64url(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}


function populateUI(profile: UserProfile) {
  (document.getElementById("displayName") as HTMLElement).innerText =
    profile.display_name ?? "";

  const avatar = document.getElementById("avatar") as HTMLElement;
  avatar.innerHTML = "";

  if (profile.images?.[0]) {
    const img = new Image(200, 200);
    img.src = profile.images[0].url;
    img.alt = "Profile image";
    avatar.appendChild(img);
  }

  (document.getElementById("id") as HTMLElement).innerText = profile.id ?? "";
  (document.getElementById("email") as HTMLElement).innerText =
    profile.email ?? "";

  const uri = document.getElementById("uri") as HTMLAnchorElement;
  uri.innerText = profile.uri ?? "";
  uri.href = profile.external_urls?.spotify ?? "#";

  const url = document.getElementById("url") as HTMLAnchorElement;
  url.innerText = profile.href ?? "";
  url.href = profile.href ?? "#";

  (document.getElementById("imgUrl") as HTMLElement).innerText =
    profile.images?.[0]?.url ?? "(no profile image)";
}