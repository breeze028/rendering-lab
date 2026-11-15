import { cp, mkdir, access } from 'node:fs/promises';
for(const name of ['wasm','scenes/cornell-box','licenses']) {
  const source=`external/pbrt/web/public/${name}`;
  try{await access(source);}catch{throw Error(`Missing ${source}. Build the pinned SDK first; see README.`);}
  await mkdir('public/runtime',{recursive:true});await cp(source,`public/runtime/${name}`,{recursive:true});
}
