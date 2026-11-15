// Official Git Data API fallback when this host cannot reach Git's HTTPS endpoint.
// Publishes only the reviewed, already committed tree; credentials remain in memory.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [repo, cwd = '.', branch = 'main', base] = process.argv.slice(2);
if (!repo)
  throw Error('Usage: node scripts/publish-rest.mjs owner/repo cwd branch [baseCommit]');
function git(args, input) {
  const r = spawnSync('git', args, {
    cwd,
    input,
    encoding: input instanceof Buffer ? undefined : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(String(r.stderr));
  return r.stdout;
}
const filled = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}).stdout;
const token = filled
  .split('\n')
  .find((s) => s.startsWith('password='))
  ?.slice(9)
  .trim();
if (!token) throw Error('No existing GitHub credential');
async function api(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    if (
      method === 'GET' &&
      (response.status === 404 ||
        (response.status === 409 && path.startsWith('git/ref/')))
    )
      return undefined;
    throw Error(`GitHub ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
const head = git(['rev-parse', 'HEAD']).trim(),
  raw = git(['cat-file', 'commit', head]);
let remote = await api(`git/ref/heads/${branch}`);
function materialize(commit, parents) {
  const zones = [
    '+0000',
    '-0000',
    '+0800',
    ...Array.from({ length: 105 }, (_, i) => {
      const v = (i - 48) * 15;
      return `${v < 0 ? '-' : '+'}${String(Math.floor(Math.abs(v) / 60)).padStart(2, '0')}${String(Math.abs(v) % 60).padStart(2, '0')}`;
    }),
  ];
  const who = (key, zone) =>
    `${key} ${commit[key].name} <${commit[key].email}> ${Math.floor(Date.parse(commit[key].date) / 1000)} ${zone}`;
  for (const az of zones)
    for (const cz of zones)
      for (const text of [
        commit.message,
        commit.message + '\n',
        commit.message + '\n\n',
        commit.message.replace(/\n$/, ''),
      ]) {
        const candidate = `tree ${commit.tree.sha}\n${parents.map((p) => `parent ${p}\n`).join('')}${who('author', az)}\n${who('committer', cz)}\n\n${text}`;
        const bytes = Buffer.from(candidate),
          sha = createHash('sha1')
            .update(Buffer.from(`commit ${bytes.length}\0`))
            .update(bytes)
            .digest('hex');
        if (sha === commit.sha) {
          git(['hash-object', '-t', 'commit', '-w', '--stdin'], candidate);
          return;
        }
      }
  throw Error(`Cannot reconstruct verified remote object ${commit.sha}`);
}
// Git Data API rejects blobs until an empty repository is initialized.
if (!remote && !base) {
  const content = spawnSync('git', ['show', 'HEAD:README.md'], {
    cwd,
    maxBuffer: 32 * 1024 * 1024,
  }).stdout;
  const seed = await api(
    'contents/README.md',
    {
      message: 'Initialize Rendering Lab documentation',
      content: content.toString('base64'),
      branch,
    },
    'PUT',
  );
  const commit = await api(`git/commits/${seed.commit.sha}`);
  const tree = git(['mktree'], `100644 blob ${seed.content.sha}\tREADME.md\n`).trim();
  if (tree !== commit.tree.sha) throw Error('Initialization tree mismatch');
  materialize(commit, []);
  remote = { object: { sha: commit.sha } };
}
const entries = git(['ls-tree', '-r', 'HEAD'])
  .trim()
  .split('\n')
  .map((line) => {
    const [meta, path] = line.split('\t');
    const [mode, type, sha] = meta.split(' ');
    return { mode, type, sha, path };
  });
const changed = base
  ? new Set(git(['diff', '--name-only', base, 'HEAD']).trim().split('\n'))
  : undefined;
const tree = [];
for (const entry of entries) {
  if (changed && !changed.has(entry.path)) continue;
  if (entry.type === 'commit') {
    tree.push(entry);
    continue;
  }
  const content = spawnSync('git', ['cat-file', 'blob', entry.sha], {
    cwd,
    maxBuffer: 32 * 1024 * 1024,
  }).stdout;
  const blob = await api('git/blobs', {
    content: content.toString('base64'),
    encoding: 'base64',
  });
  if (blob.sha !== entry.sha) throw Error('Blob hash mismatch');
  tree.push(entry);
}
const old = base ? await api(`git/commits/${base}`) : undefined;
const built = await api('git/trees', {
  ...(old ? { base_tree: old.tree.sha } : {}),
  tree,
});
if (built.sha !== git(['rev-parse', 'HEAD^{tree}']).trim())
  throw Error('Remote tree does not match the reviewed commit');
function identity(key) {
  const line = raw.split('\n').find((s) => s.startsWith(key + ' '));
  const m = line.match(/^\w+ (.*) <(.*)> (\d+) ([+-]\d{4})$/);
  return { name: m[1], email: m[2], date: new Date(Number(m[3]) * 1000).toISOString() };
}
const message = raw.slice(raw.indexOf('\n\n') + 2),
  parents = raw
    .split('\n')
    .filter((s) => s.startsWith('parent '))
    .map((s) => s.slice(7));
if (!parents.length && remote) parents.push(remote.object.sha);
if (
  remote &&
  !git(['cat-file', '--batch-check'], remote.object.sha + '\n').includes(' commit ')
) {
  const parent = await api(`git/commits/${remote.object.sha}`);
  if (!parent.parents.length) {
    git(
      ['mktree'],
      `100644 blob ${git(['rev-parse', 'HEAD:README.md']).trim()}\tREADME.md\n`,
    );
    materialize(parent, []);
  }
}
const commit = await api('git/commits', {
  message,
  tree: built.sha,
  parents,
  author: identity('author'),
  committer: identity('committer'),
});
// GitHub normalizes identity dates to UTC. Reconstruct and verify the actual object locally.
if (commit.sha !== head) {
  materialize(commit, parents);
  git(['update-ref', `refs/heads/${branch}`, commit.sha, head]);
}
if (remote)
  await api(`git/refs/heads/${branch}`, { sha: commit.sha, force: false }, 'PATCH');
else await api('git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });
git(['update-ref', `refs/remotes/origin/${branch}`, commit.sha]);
git(['config', `branch.${branch}.remote`, 'origin']);
git(['config', `branch.${branch}.merge`, `refs/heads/${branch}`]);
console.log(
  JSON.stringify({
    repository: repo,
    branch,
    sha: commit.sha,
    tree: built.sha,
    files: tree.length,
  }),
);
