// Renders single frames for design review: node scripts/stills.ts 100 230 330 ...
// Bundles once, then renders each frame to out/stills/frame-<n>.jpeg.
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind-v4';
import path from 'node:path';

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({
  entryPoint: path.resolve('src/index.ts'),
  webpackOverride: (config) => enableTailwind(config),
});
const composition = await selectComposition({ serveUrl, id: 'Promo' });

for (const frame of frames) {
  const output = path.resolve(`out/stills/frame-${frame}.jpeg`);
  await renderStill({
    composition,
    serveUrl,
    frame,
    output,
    imageFormat: 'jpeg',
    jpegQuality: 90,
    scale: 0.5,
  });
  console.log(output);
}
