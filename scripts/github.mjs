// Reuses the existing Git credential helper in memory. Never prints credentials.
import { spawnSync } from 'node:child_process';
const fill = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
});
const password = fill.stdout
  ?.split('\n')
  .find((v) => v.startsWith('password='))
  ?.slice(9)
  .trim();
if (!password) throw Error('Existing GitHub credential unavailable');
const [method = 'GET', path = 'user', json] = process.argv.slice(2);
const response = await fetch('https://api.github.com/' + path, {
  method,
  headers: {
    Authorization: `Bearer ${password}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: json ? JSON.stringify(JSON.parse(json)) : undefined,
});
const body = await response.text();
if (!response.ok) {
  console.error(response.status, body);
  process.exit(1);
}
if (body) {
  const data = JSON.parse(body);
  console.log(JSON.stringify(data, null, 2));
} else console.log(response.status);
