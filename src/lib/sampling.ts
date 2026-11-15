// One-dimensional didactic integral on x = theta/(pi/2), not a scene PDF.
export type Strategy='uniform'|'cosine'|'bsdf'|'light'|'mis';
export const strategies:Strategy[]=['uniform','cosine','bsdf','light','mis'];
export function model(rough:number,size:number){
  const c=.32,w=rough,a=Math.atan(-c/w),b=Math.atan((1-c)/w),lo=.68-size/2,hi=.68+size/2;
  const bsdf=(x:number)=>1/(w*(b-a)*(1+((x-c)/w)**2));
  const light=(x:number)=>x>=lo&&x<=hi?1/size:0;
  const pdf=(s:Strategy,x:number):number=>s==='uniform'?1:s==='cosine'?Math.PI/2*Math.cos(x*Math.PI/2):s==='bsdf'?bsdf(x):s==='light'?light(x):.5*(bsdf(x)+light(x));
  const f=(x:number)=>bsdf(x)*Math.cos(x*Math.PI/2)*(light(x)>0?1:0);
  const draw=(s:Strategy,u:number)=>s==='uniform'?u:s==='cosine'?Math.asin(u)*2/Math.PI:s==='bsdf'?c+w*Math.tan(a+u*(b-a)):lo+u*size;
  // Midpoint quadrature over the light support avoids discontinuous endpoints.
  let reference=0;for(let i=0;i<8192;i++)reference+=f(lo+(i+.5)/8192*size)*size/8192;
  return {pdf,f,draw,reference,lo,hi};
}
export function estimate(rough:number,size:number,strategy:Strategy,count:number,seed=7){
  const m=model(rough,size);let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
  const samples:{x:number;value:number;mean:number}[]=[];let sum=0;
  for(let i=0;i<count;i++){
    const s=strategy==='mis'?(random()<.5?'bsdf':'light'):strategy;
    const x=m.draw(s,random()),p=m.pdf(s,x);let value=m.f(x)/p;
    if(strategy==='mis'){const other=m.pdf(s==='bsdf'?'light':'bsdf',x);value*=2*p*p/(p*p+other*other);}
    sum+=value;samples.push({x,value,mean:sum/(i+1)});
  }
  return {...m,samples,value:sum/count};
}
