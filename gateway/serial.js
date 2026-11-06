// One running operation per key. Interactive work overtakes queued history imports.
export function createSerial(){
 const queues=new Map();
 return function serial(key,fn,priority=10){
  let queue=queues.get(key);
  if(!queue){queue={running:false,jobs:[],interactive:0};queues.set(key,queue);}
  const result=new Promise((resolve,reject)=>queue.jobs.push({fn,priority,resolve,reject}));
  async function drain(){
   if(queue.running)return;
   queue.running=true;
   while(queue.jobs.length){
    let index=0;
    if(queue.interactive>=20&&queue.jobs.some(job=>job.priority<0))index=queue.jobs.findIndex(job=>job.priority<0);
    else for(let i=1;i<queue.jobs.length;i++)if(queue.jobs[i].priority>queue.jobs[index].priority)index=i;
    const job=queue.jobs.splice(index,1)[0];queue.interactive=job.priority<0?0:queue.interactive+1;
    try{job.resolve(await job.fn());}catch(error){job.reject(error);}
   }
   queue.running=false;queues.delete(key);
  }
  void drain();return result;
 };
}
