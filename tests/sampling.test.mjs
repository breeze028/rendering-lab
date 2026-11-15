import {test} from 'node:test';
import assert from 'node:assert/strict';
import {model,estimate,strategies} from '../src/lib/sampling.ts';
test('all normalized PDFs integrate to one and samples stay in support',()=>{
  for(const rough of [.03,.16,.5])for(const size of [.03,.25,.6]){
    const m=model(rough,size),n=100000;
    for(const s of strategies){let integral=0;for(let i=0;i<n;i++)integral+=m.pdf(s,(i+.5)/n)/n;assert.ok(Math.abs(integral-1)<.001,`${s}: ${integral}`);
      if(s!=='mis')for(let i=0;i<100;i++){const x=m.draw(s,(i+.5)/100);assert.ok(x>=0&&x<=1);assert.ok(m.pdf(s,x)>0);}
    }
  }
});
test('each estimator agrees with quadrature over an independent large sample budget',()=>{
  for(const s of strategies){const d=estimate(.16,.25,s,100000,2026);assert.ok(Math.abs(d.value-d.reference)<.008,`${s}: ${d.value} vs ${d.reference}`);assert.ok(d.samples.every(p=>Number.isFinite(p.value)));}
});
test('replay seed is deterministic and parameter edits change actual calculations',()=>{
 assert.deepEqual(estimate(.16,.25,'mis',128,7).samples,estimate(.16,.25,'mis',128,7).samples);
 assert.notEqual(estimate(.16,.25,'mis',128,7).value,estimate(.3,.1,'mis',128,7).value);
});
