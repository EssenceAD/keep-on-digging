// GitHub Pages 배포: 빌드한 dist/ 를 gh-pages 브랜치로 올린다.  실행: npm run deploy  (모험의 유산과 같은 방식)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd) => execSync(cmd).toString().trim();
const remote = out('git remote get-url origin');
const rev = out('git rev-parse --short HEAD');
run('npm run build');
writeFileSync('dist/.nojekyll', '');
run('git init -q -b gh-pages', 'dist');
run('git add -A', 'dist');
run(`git commit -q -m "deploy ${rev}"`, 'dist');
run(`git push -f "${remote}" gh-pages`, 'dist');
console.log('\n배포 완료 → gh-pages 브랜치. 1~2분 뒤 https://essencead.github.io/keep-on-digging/ 에 반영돼요.');
