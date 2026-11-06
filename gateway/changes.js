import {randomUUID} from 'node:crypto';

// Only invalidation cursors cross the connection. Actual data always passes auth again.
export function createChanges() {
  const epoch=randomUUID(),versions=new Map(),listeners=new Map();
  const cursor=cid=>`${epoch}:${versions.get(cid)||0}`;
  function publish(cid) {
    versions.set(cid,(versions.get(cid)||0)+1);
    for(const wake of listeners.get(cid)||[]) wake();
  }
  function wait(cid,since,req,res) {
    if(since!==cursor(cid)) return res.json({cursor:cursor(cid),changed:true});
    const set=listeners.get(cid)||new Set();listeners.set(cid,set);
    if(set.size>=100) return res.status(429).json({error:'Muitas conexões abertas. Feche outras abas.'});
    let timer;
    const finish=()=>{clearTimeout(timer);set.delete(wake);if(!set.size)listeners.delete(cid);res.off('close',closed);};
    const closed=()=>finish();
    const wake=()=>{finish();if(!res.destroyed)res.json({cursor:cursor(cid),changed:since!==cursor(cid)});};
    set.add(wake);timer=setTimeout(wake,25000);res.on('close',closed);
  }
  return {publish,wait,cursor};
}
