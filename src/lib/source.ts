export function snippet(source: string, id: string) {
  const begin = `// snippet:${id}:start`,
    end = `// snippet:${id}:end`;
  const a = source.indexOf(begin),
    b = source.indexOf(end, a);
  if (a < 0 || b < a) throw Error(`Missing live WGSL snippet ${id}`);
  const lines = source
    .slice(a + begin.length, b)
    .replace(/^\s*\n/, '')
    .trimEnd()
    .split('\n');
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.match(/^\s*/)?.[0].length ?? 0),
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}
