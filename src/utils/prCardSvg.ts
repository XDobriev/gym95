/**
 * Generator of 1080x1920 vertical SVG Stories/Reels Personal Record (PR) Share Cards.
 * Strictly adheres to gym95 DESIGN.md:
 * - Anton font strictly on numbers/metrics.
 * - Barlow and Barlow Semi Condensed for text, labels, and badges.
 * - Toxic neon lime #c9ff2e on dark midnight gym background #0e1117.
 * - Hot PR orange #ff7a1a reserved strictly for personal record achievements.
 */

export interface PrCardSvgOptions {
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1RM: number;
  prevEstimated1RM?: number;
  dateStr?: string;
  athleteName?: string;
}

export function generatePrCardSvg(options: PrCardSvgOptions): string {
  const width = 1080;
  const height = 1920;

  const exercise = escapeXml(options.exerciseName.toUpperCase());
  const weight = options.weightKg;
  const reps = options.reps;
  const oneRepMax = options.estimated1RM;
  const prev1RM = options.prevEstimated1RM;
  const dateStr = options.dateStr || new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const athlete = options.athleteName ? escapeXml(options.athleteName.toUpperCase()) : 'АТЛЕТ GYM95';

  const deltaKg = prev1RM && oneRepMax > prev1RM ? Math.round((oneRepMax - prev1RM) * 10) / 10 : null;
  const percentGrowth = deltaKg && prev1RM ? Math.round((deltaKg / prev1RM) * 100) : null;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Anton&amp;family=Barlow+Semi+Condensed:wght@600;700;800&amp;family=Barlow:wght@400;600;700&amp;display=swap');
      .num-anton { font-family: 'Anton', sans-serif; font-weight: 400; }
      .lbl-barlow { font-family: 'Barlow Semi Condensed', -apple-system, sans-serif; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .text-barlow { font-family: 'Barlow', -apple-system, sans-serif; font-weight: 600; }
    </style>

    <!-- Linear Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#141922" />
      <stop offset="45%" stop-color="#0e1117" />
      <stop offset="100%" stop-color="#07090c" />
    </linearGradient>

    <!-- Lime Aura in Top Right -->
    <radialGradient id="limeGlow" cx="80%" cy="15%" r="50%">
      <stop offset="0%" stop-color="#c9ff2e" stop-opacity="0.18" />
      <stop offset="60%" stop-color="#c9ff2e" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#c9ff2e" stop-opacity="0" />
    </radialGradient>

    <!-- PR Flame Aura in Bottom Left -->
    <radialGradient id="prFlameGlow" cx="15%" cy="85%" r="55%">
      <stop offset="0%" stop-color="#ff7a1a" stop-opacity="0.18" />
      <stop offset="60%" stop-color="#ff7a1a" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#ff7a1a" stop-opacity="0" />
    </radialGradient>

    <!-- Accent Top Line Gradient (PR Orange to Toxic Lime, NO teal mixing) -->
    <linearGradient id="topLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff7a1a" />
      <stop offset="100%" stop-color="#c9ff2e" />
    </linearGradient>

    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- 1. Background Layers -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  <rect width="${width}" height="${height}" fill="url(#limeGlow)" />
  <rect width="${width}" height="${height}" fill="url(#prFlameGlow)" />

  <!-- Top Decorative Accent Bar -->
  <rect x="80" y="80" width="920" height="6" rx="3" fill="url(#topLineGrad)" />

  <!-- 2. Header Branding -->
  <g transform="translate(80, 160)">
    <!-- GYM95 Logo -->
    <text x="0" y="55" class="num-anton" font-size="64" fill="#ffffff">GYM95</text>
    <rect x="180" y="18" width="170" height="34" rx="10" fill="rgba(255, 122, 26, 0.16)" stroke="#ff7a1a" stroke-width="1.5" />
    <text x="265" y="41" class="lbl-barlow" font-size="14" fill="#ff7a1a" text-anchor="middle">🔥 NEW PR CARD</text>

    <!-- Date and Athlete -->
    <text x="920" y="32" class="lbl-barlow" font-size="16" fill="#8a8f98" text-anchor="end">${escapeXml(dateStr.toUpperCase())}</text>
    <text x="920" y="58" class="text-barlow" font-size="18" fill="#c9ff2e" text-anchor="end">${athlete}</text>
  </g>

  <!-- 3. PR Hero Container Box -->
  <g transform="translate(80, 280)">
    <!-- Outer Card Background -->
    <rect width="920" height="1460" rx="24" fill="rgba(255, 255, 255, 0.025)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="2" />

    <!-- Badge: Личный рекорд -->
    <g transform="translate(50, 60)">
      <rect width="320" height="44" rx="22" fill="#ff7a1a" />
      <text x="160" y="28" class="lbl-barlow" font-size="15" fill="#0a1400" text-anchor="middle">⚡ НОВЫЙ ЛИЧНЫЙ РЕКОРД</text>
    </g>

    <!-- Exercise Name -->
    <text x="50" y="180" class="text-barlow" font-size="46" font-weight="700" fill="#ffffff" letter-spacing="-0.01em">${exercise}</text>

    <!-- Weight & Reps Hero Display -->
    <g transform="translate(50, 240)">
      <rect width="820" height="400" rx="20" fill="rgba(201, 255, 46, 0.05)" stroke="#c9ff2e" stroke-width="2.5" />
      
      <text x="50" y="70" class="lbl-barlow" font-size="20" fill="#c9ff2e">ВЕС НА ГРИФЕ / СНАРЯДЕ</text>
      
      <!-- Huge Anton Display Number for Weight + Barlow for unit -->
      <text x="50" y="260">
        <tspan class="num-anton" font-size="190" fill="#c9ff2e" filter="url(#glowEffect)">${weight}</tspan>
        <tspan dx="20" class="lbl-barlow" font-size="64" fill="#ffffff">КГ</tspan>
      </text>

      <!-- Reps Indicator -->
      <g transform="translate(50, 310)">
        <rect width="260" height="50" rx="12" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" />
        <text x="130" y="32" class="lbl-barlow" font-size="20" fill="#ffffff" text-anchor="middle">× <tspan class="num-anton" font-size="24">${reps}</tspan> ПОВТОРЕНИЙ</text>
      </g>
    </g>

    <!-- 1RM Calculation Metric Box -->
    <g transform="translate(50, 680)">
      <rect width="820" height="260" rx="20" fill="rgba(255, 122, 26, 0.07)" stroke="#ff7a1a" stroke-width="2" />
      <text x="50" y="60" class="lbl-barlow" font-size="18" fill="#ff7a1a">РАСЧЁТНЫЙ МАКСИМУМ НА 1 ПОВТОРЕНИЕ (1RM ЭПЛИ)</text>
      
      <text x="50" y="190">
        <tspan class="num-anton" font-size="120" fill="#ff7a1a">~${oneRepMax}</tspan>
        <tspan dx="20" class="lbl-barlow" font-size="44" fill="#ffffff">КГ 1RM</tspan>
      </text>

      ${prev1RM ? `<text x="50" y="230" class="text-barlow" font-size="18" fill="#8a8f98">Прошлый 1RM максимум: ~${prev1RM} кг</text>` : ''}
    </g>

    <!-- Delta Growth Banner -->
    ${
      deltaKg
        ? `
    <g transform="translate(50, 980)">
      <rect width="820" height="150" rx="20" fill="rgba(201, 255, 46, 0.12)" stroke="#c9ff2e" stroke-width="2" />
      <text x="410" y="60" class="lbl-barlow" font-size="20" fill="#c9ff2e" text-anchor="middle">ДИНАМИКА ПРИРОСТА К РЕКОРДУ</text>
      <text x="410" y="115" text-anchor="middle">
        <tspan class="num-anton" font-size="48" fill="#ffffff">+${deltaKg}</tspan>
        <tspan dx="10" class="lbl-barlow" font-size="34" fill="#c9ff2e"> КГ</tspan>
        ${percentGrowth ? `<tspan dx="12" class="lbl-barlow" font-size="30" fill="#8a8f98">(+${percentGrowth}%)</tspan>` : ''}
      </text>
    </g>`
        : ''
    }

    <!-- Motivation Quotes & Verification Footer -->
    <g transform="translate(50, 1310)">
      <line x1="0" y1="0" x2="820" y2="0" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" />
      <text x="0" y="45" class="lbl-barlow" font-size="15" fill="#8a8f98">ПОЛУНОЧНЫЙ ЗАЛ · СИЛА В ДИСЦИПЛИНЕ</text>
      <text x="820" y="45" class="text-barlow" font-size="16" fill="#c9ff2e" text-anchor="end">@gym95_bot</text>
    </g>
  </g>

  <!-- 4. Stories Bottom Brand Pill -->
  <g transform="translate(540, 1840)">
    <text x="0" y="0" class="lbl-barlow" font-size="18" fill="#8a8f98" text-anchor="middle">GYM95 TRAINING LOG</text>
  </g>
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
