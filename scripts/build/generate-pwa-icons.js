/**
 * PWA Icon Generator Script
 * 
 * This script generates placeholder PWA icons for IronScout.
 * Run with: node scripts/generate-pwa-icons.js
 * 
 * For production, replace these with properly designed icons.
 * 
 * Icon Requirements:
 * - 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
 * - PNG format with transparent background (or solid background for maskable)
 * - For maskable icons, keep important content in the center 80% (safe zone)
 */

const fs = require('fs')
const path = require('path')

const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512]

// Simple SVG template for a crosshair/target icon (fitting for ammo search)
const generateSVG = (size) => {
  const padding = size * 0.1
  const center = size / 2
  const outerRadius = (size - padding * 2) / 2
  const innerRadius = outerRadius * 0.3
  const lineLength = outerRadius * 0.8
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#0f172a" rx="${size * 0.15}"/>
  
  <!-- Outer circle -->
  <circle cx="${center}" cy="${center}" r="${outerRadius * 0.85}" fill="none" stroke="#3b82f6" stroke-width="${size * 0.04}"/>
  
  <!-- Inner circle -->
  <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="#3b82f6"/>
  
  <!-- Crosshair lines -->
  <line x1="${center}" y1="${padding}" x2="${center}" y2="${center - innerRadius - size * 0.05}" stroke="#3b82f6" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <line x1="${center}" y1="${center + innerRadius + size * 0.05}" x2="${center}" y2="${size - padding}" stroke="#3b82f6" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <line x1="${padding}" y1="${center}" x2="${center - innerRadius - size * 0.05}" y2="${center}" stroke="#3b82f6" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <line x1="${center + innerRadius + size * 0.05}" y1="${center}" x2="${size - padding}" y2="${center}" stroke="#3b82f6" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  
  <!-- "AI" text indicator (only for larger sizes) -->
  ${size >= 96 ? `<text x="${center}" y="${size - padding * 1.5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size * 0.12}" font-weight="bold" fill="#10b981">AI</text>` : ''}
</svg>`
}

const iconsDir = path.join(__dirname, '..', 'apps', 'web', 'public', 'icons')

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Generate SVG files (you'll need to convert these to PNG for production)
sizes.forEach(size => {
  const svg = generateSVG(size)
  const filename = `icon-${size}x${size}.svg`
  fs.writeFileSync(path.join(iconsDir, filename), svg)
  console.log(`Generated: ${filename}`)
})

console.log(`
✅ SVG icons generated in apps/web/public/icons/

⚠️  IMPORTANT: For production, you need to:

1. Convert SVGs to PNGs using a tool like:
   - https://cloudconvert.com/svg-to-png
   - Figma export
   - ImageMagick: convert icon.svg -resize 192x192 icon-192x192.png

2. Or use a proper icon generator:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator

3. Replace placeholder icons with your actual brand icons

4. For iOS, also generate splash screens at:
   - https://appsco.pe/developer/splash-screens
`)
