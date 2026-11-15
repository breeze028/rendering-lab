// An integrator may own many passes and persistent state, not only trace(ray).
export interface IntegratorSession {
  initialize():Promise<void>;
  reset(reason:'scene'|'camera'|'estimator'):void;
  step():Promise<void>;
  capture(request:{pixel:[number,number];sample:number}):Promise<unknown>;
  dispose():void;
}
export interface DebugViewDefinition {id:string;label:string;quantity:string;space:string;source:string;}
export const debugViews:DebugViewDefinition[]=[
  {id:'0',label:'Final radiance',quantity:'Mean linear RGB; exponential tone map, gamma 2.2',space:'linear RGB → display',source:'trace / accumulation'},
  {id:'1',label:'Albedo',quantity:'Material base color at primary hit',space:'linear RGB shown directly',source:'surface_material.color'},
  {id:'2',label:'Geometric normal',quantity:'0.5 + 0.5 × unit normal',space:'world',source:'geometric'},
  {id:'3',label:'Shading normal',quantity:'0.5 + 0.5 × BSDF frame normal',space:'world',source:'surface_frame[2]'},
  {id:'4',label:'Depth',quantity:'Camera-ray distance t / (1 + t)',space:'world distance',source:'intersect.t'},
  {id:'5',label:'UV',quantity:'fract(u), fract(v), 0',space:'surface UV',source:'surface_uv'},
  {id:'6',label:'Object ID',quantity:'Stable hash of GPU placement index',space:'GPU placement IDs, not parser shape IDs',source:'Hit.inst'},
  {id:'7',label:'Material ID',quantity:'Stable hash of GPU material index',space:'GPU material IDs',source:'info(Hit.inst).y'}
];
