#!/usr/bin/env node
// Background image generator using OpenRouter API
// Usage: node scripts/generate-backgrounds.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'backgrounds');

const OPENROUTER_KEY = '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';
const MODEL = 'openai/gpt-5-image';

// 540x720 is the card size at 1x. For retina we only need 2x = 1080x1440
// But for backgrounds we use smaller since they're overlays with blur/opacity
// 540x720 is perfect — matches the card exactly, lightweight
const WIDTH = 540;
const HEIGHT = 720;

const PROMPTS = [
  // Neon Cyber theme
  {
    name: 'neon-nebula',
    prompt: `Generate a ${WIDTH}x${HEIGHT} abstract dark background: deep space nebula with purple and indigo luminous gas clouds, scattered tiny cyan star particles, subtle hexagonal grid fading into darkness. No text, no letters, no words. Dark navy-black base. Cinematic lighting. Ultra quality.`
  },
  {
    name: 'neon-circuit',
    prompt: `Generate a ${WIDTH}x${HEIGHT} abstract dark background: glowing purple and cyan circuit traces on deep black surface, electric pulse energy flowing, bokeh light particles. No text, no letters. Moody futuristic atmosphere. Ultra detailed.`
  },
  {
    name: 'neon-orbs',
    prompt: `Generate a ${WIDTH}x${HEIGHT} abstract dark background: soft neon purple and electric blue light orbs floating in void, lens flare, light streaks, particle dust, deep black base. No text, no symbols. Ethereal. Ultra quality.`
  },
  // Terminal theme
  {
    name: 'terminal-matrix',
    prompt: `Generate a ${WIDTH}x${HEIGHT} minimalist dark background: faint green wireframe grid extending to horizon, single point perspective, green glow at vanishing point, matrix style, pure black environment. No text. Clean and elegant. Ultra quality.`
  },
  {
    name: 'terminal-server',
    prompt: `Generate a ${WIDTH}x${HEIGHT} abstract dark background: rows of dim green LED indicator lights in darkness, server room, bokeh effect, subtle smoke. Deep black atmosphere. No text. Cinematic moody lighting. Ultra quality.`
  },
  // White/minimal theme
  {
    name: 'white-geometric',
    prompt: `Generate a ${WIDTH}x${HEIGHT} clean minimal white background: very subtle geometric shapes, soft lavender and light blue gradient shadows, frosted glass effect, elegant luxurious feel. No text. Studio quality lighting. Ultra quality.`
  },
  {
    name: 'white-silk',
    prompt: `Generate a ${WIDTH}x${HEIGHT} abstract white background: very subtle silk fabric wave texture, soft purple and blue tinted shadows, dreamy and elegant, minimal design. No text. Studio quality. Ultra quality.`
  },
  // Pixel/game theme
  {
    name: 'pixel-space',
    prompt: `Generate a ${WIDTH}x${HEIGHT} pixel art dark space background: small pixel stars and planets in amber and gold on dark navy, retro 8-bit video game aesthetic, scanline effect. No text. Nostalgic gaming feel. Pixel art style.`
  },
  {
    name: 'pixel-city',
    prompt: `Generate a ${WIDTH}x${HEIGHT} pixel art dark cityscape: silhouette at bottom, amber gold glowing windows, dark purple sky with pixel stars, retro 16-bit game style. No text. Nostalgic warm feel. Pixel art.`
  },
  // Starfield (new theme)
  {
    name: 'star-galaxy',
    prompt: `Generate a ${WIDTH}x${HEIGHT} deep space background: Milky Way galaxy arm with millions of tiny stars, purple blue and gold nebula colors, cosmic dust. No text. NASA Hubble quality. Breathtaking. Ultra quality.`
  },
  {
    name: 'star-aurora',
    prompt: `Generate a ${WIDTH}x${HEIGHT} dark sky background: aurora borealis, green and purple lights dancing across starfield, subtle mountain silhouette at very bottom. No text. Long exposure photography style. Ultra quality.`
  },
  // Gradient (new theme)
  {
    name: 'gradient-fluid',
    prompt: `Generate a ${WIDTH}x${HEIGHT} abstract fluid gradient background: smooth flowing colors from deep purple to electric blue to teal, liquid chrome effect, dark base with luminous color flow. No text. Apple-style marketing aesthetic. Ultra quality.`
  },
];

async function generateImage(promptObj, index) {
  console.log(`[${index + 1}/${PROMPTS.length}] Generating: ${promptObj.name}...`);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: promptObj.prompt,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAILED: ${res.status} - ${err.substring(0, 200)}`);
    return null;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Extract base64 image from response
  // OpenAI image models return content with inline_data or base64
  const base64Match = content.match(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/);
  if (base64Match) {
    const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
    const buffer = Buffer.from(base64Match[2], 'base64');
    const outPath = path.join(OUT_DIR, `${promptObj.name}.${ext}`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  Saved: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return outPath;
  }

  // Try to find URL in response
  const urlMatch = content.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|webp)/i);
  if (urlMatch) {
    console.log(`  Found URL: ${urlMatch[0]}`);
    try {
      const imgRes = await fetch(urlMatch[0]);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const ext = urlMatch[1];
      const outPath = path.join(OUT_DIR, `${promptObj.name}.${ext}`);
      fs.writeFileSync(outPath, buffer);
      console.log(`  Downloaded: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
      return outPath;
    } catch (e) {
      console.error(`  Download failed: ${e.message}`);
    }
  }

  // Save raw response for debugging
  const debugPath = path.join(OUT_DIR, `${promptObj.name}_response.json`);
  fs.writeFileSync(debugPath, JSON.stringify(data, null, 2).substring(0, 5000));
  console.log(`  No image found in response. Saved debug: ${debugPath}`);
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUT_DIR}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Generating ${PROMPTS.length} background images...\n`);

  const results = [];
  for (let i = 0; i < PROMPTS.length; i++) {
    const result = await generateImage(PROMPTS[i], i);
    results.push({ name: PROMPTS[i].name, path: result });
    // Small delay between requests
    if (i < PROMPTS.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n=== Results ===');
  results.forEach(r => {
    console.log(`${r.path ? '✅' : '❌'} ${r.name}: ${r.path || 'FAILED'}`);
  });
}

main().catch(console.error);
