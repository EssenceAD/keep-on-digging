import { mkdirSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// dev 전용: 브라우저가 찍은 화면을 docs/screens/<이름>.png 로 저장 (README 스크린샷용 · window.__kod.shot('phone'))
const shotSaver = {
  name: 'kod-shot-saver',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      const name = (req.url || '').replace(/[^a-z0-9_-]/gi, '') || 'shot';
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const dir = server.config.root + '/docs/screens';
        mkdirSync(dir, { recursive: true });
        writeFileSync(`${dir}/${name}.png`, Buffer.from(Buffer.concat(chunks).toString().split(',')[1], 'base64'));
        res.end('ok');
      });
    });
  },
};

export default defineConfig({ base: './', plugins: [shotSaver], build: { target: 'es2022', assetsInlineLimit: 0 } });
