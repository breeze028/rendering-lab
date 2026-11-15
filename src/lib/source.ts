export function snippet(source:string,id:string){
 const begin=`// snippet:${id}:start`,end=`// snippet:${id}:end`;
 const a=source.indexOf(begin),b=source.indexOf(end,a);
 if(a<0||b<a)throw Error(`Missing live WGSL snippet ${id}`);
 return source.slice(a+begin.length,b).trim();
}
