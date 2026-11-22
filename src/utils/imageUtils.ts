// Centralized image mapping, team logos, and professional SVG fallbacks

/**
 * Team Logo Badges
 * High resolution SVG representations and official logos for all 10 IPL franchises
 */
export const TEAM_LOGOS: Record<string, string> = {
  MI: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/1200px-Mumbai_Indians_Logo.svg.png',
  CSK: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/1200px-Chennai_Super_Kings_Logo.svg.png',
  RCB: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0a/Royal_Challengers_Bengaluru_Logo.png/1200px-Royal_Challengers_Bengaluru_Logo.png',
  KKR: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/4f/Kolkata_Knight_Riders_Logo.svg/1200px-Kolkata_Knight_Riders_Logo.svg.png',
  SRH: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Sunrisers_Hyderabad.svg/1200px-Sunrisers_Hyderabad.svg.png',
  RR: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Rajasthan_Royals_Logo.svg/1200px-Rajasthan_Royals_Logo.svg.png',
  PBKS: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Punjab_Kings_Logo.svg/1200px-Punjab_Kings_Logo.svg.png',
  GT: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/1200px-Gujarat_Titans_Logo.svg.png',
  DC: 'https://upload.wikimedia.org/wikipedia/en/thumb/2/2f/Delhi_Capitals.svg/1200px-Delhi_Capitals.svg.png',
  LSG: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Lucknow_Super_Giants_IPL_Logo.svg/1200px-Lucknow_Super_Giants_IPL_Logo.svg.png'
};

/**
 * Fallback SVG data URI for team badges in case of network unavailability
 */
export function getTeamFallbackLogo(shortName: string, primaryColor: string, secondaryColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="grad-${shortName}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primaryColor}" />
        <stop offset="100%" stop-color="${secondaryColor}" />
      </linearGradient>
      <filter id="shadow">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.4"/>
      </filter>
    </defs>
    <polygon points="60,6 112,30 112,85 60,114 8,85 8,30" fill="url(#grad-${shortName})" stroke="#d4af37" stroke-width="3" filter="url(#shadow)" />
    <polygon points="60,16 102,36 102,80 60,104 18,80 18,36" fill="rgba(0,0,0,0.3)" />
    <text x="60" y="68" fill="#ffffff" font-family="'Montserrat', sans-serif" font-weight="900" font-size="28" text-anchor="middle" letter-spacing="1.5">${shortName}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Professional SVG cricket silhouette generator for players
 */
export function getPlayerFallbackSilhouette(name?: string, role?: string, nationality?: string): string {
  const nat = (nationality || 'India').toLowerCase();
  const isIndian = nat === 'india' || nat === 'ind';
  const roleColor = role === 'Batter' ? '#3b82f6' : role === 'Bowler' ? '#ef4444' : role === 'All-Rounder' ? '#10b981' : '#f59e0b';
  
  const initials = (name || 'IPL')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'IPL';

  const displayRole = (role || 'Player').toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280">
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="60%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#020617" />
      </radialGradient>
      <linearGradient id="jerseyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${roleColor}" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    <!-- Background -->
    <rect width="240" height="280" fill="url(#bgGlow)" />
    <!-- Stadium floodlight rays -->
    <path d="M0,0 L80,280 L0,280 Z" fill="rgba(255,255,255,0.02)" />
    <path d="M240,0 L160,280 L240,280 Z" fill="rgba(255,255,255,0.02)" />
    
    <!-- Player Silhouette Body -->
    <g transform="translate(120, 155)">
      <!-- Head / Helmet -->
      <circle cx="0" cy="-65" r="28" fill="#334155" stroke="${roleColor}" stroke-width="2" />
      <path d="M-18,-68 Q0,-90 18,-68 Q22,-52 14,-45 L-14,-45 Z" fill="#475569" />
      <rect x="-14" y="-55" width="28" height="6" rx="3" fill="#94a3b8" />
      
      <!-- Torso / Jersey -->
      <path d="M-45,-25 L-20,-38 L20,-38 L45,-25 L38,45 L-38,45 Z" fill="url(#jerseyGrad)" stroke="#1e293b" stroke-width="2" />
      
      <!-- Collar -->
      <polygon points="0,-22 -14,-38 14,-38" fill="#e2e8f0" />
      
      <!-- Initials on chest -->
      <text x="0" y="15" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="800" font-size="20" text-anchor="middle" opacity="0.9">${initials}</text>
      
      <!-- Shoulders & Arms outline -->
      <path d="M-45,-25 L-55,25 L-40,28 L-35,-15" fill="#334155" opacity="0.8" />
      <path d="M45,-25 L55,25 L40,28 L35,-15" fill="#334155" opacity="0.8" />
    </g>

    <!-- Role Badge Lower Third -->
    <rect x="20" y="235" width="200" height="28" rx="6" fill="rgba(15, 23, 42, 0.85)" stroke="${roleColor}" stroke-width="1.5" />
    <text x="120" y="254" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="700" font-size="12" text-anchor="middle" letter-spacing="1.5">
      ${isIndian ? '🇮🇳' : '✈️'} ${displayRole}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
