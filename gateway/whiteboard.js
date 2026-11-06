export function installWhiteboard(app,{get,put,rows,del,serial,fail}) {
  const clean=input=>{
    const output={};
    for(const key of ['title','text']) if(input[key]!==undefined) output[key]=String(input[key]).slice(0,key==='title'?120:6000);
    for(const key of ['x','y']) if(input[key]!==undefined) output[key]=Math.round(Math.max(0,Math.min(6000,Number(input[key])||0)));
    if(input.color!==undefined) {
      if(!['yellow','green','blue','pink','purple'].includes(input.color)) throw fail(400,'Cor inválida.');
      output.color=input.color;
    }
    if(input.remindAt!==undefined) {
      if(input.remindAt && !Number.isFinite(Date.parse(input.remindAt))) throw fail(400,'Data de lembrete inválida.');
      output.remindAt=input.remindAt?new Date(input.remindAt).toISOString():null;
    }
    if(input.done!==undefined) output.done=!!input.done;
    return output;
  };
  app.get('/whiteboard',async(req,res)=>res.json(await rows(req.company.id,'whiteboard-note',500)));
  app.post('/whiteboard',async(req,res)=>{
    if((await rows(req.company.id,'whiteboard-note',501)).length>=500) throw fail(400,'O quadro tem 500 notas. Exclua uma para continuar.');
    const author=req.employee?.id||req.account.id;
    res.json(await put(req.company.id,'whiteboard-note',{title:'Nova nota',text:'',x:80,y:80,color:'yellow',remindAt:null,done:false,...clean(req.body),revision:1,author,authorName:req.employee?.name||req.account.full_name}));
  });
  app.patch('/whiteboard/:id',async(req,res)=>serial(`whiteboard:${req.company.id}:${req.params.id}`,async()=>{
    const note=await get(req.company.id,req.params.id,'whiteboard-note');
    if(Number(req.body.revision)!==note.revision) throw fail(409,'Esta nota foi alterada por outra pessoa. O quadro será atualizado.');
    res.json(await put(req.company.id,'whiteboard-note',{...note,...clean(req.body),revision:note.revision+1},note.id));
  }));
  app.delete('/whiteboard/:id',async(req,res)=>serial(`whiteboard:${req.company.id}:${req.params.id}`,async()=>{
    const note=await get(req.company.id,req.params.id,'whiteboard-note');
    if(Number(req.query.revision)!==note.revision) throw fail(409,'Esta nota mudou. Atualize o quadro antes de excluir.');
    await del(req.company.id,note.id,'whiteboard-note');res.json({ok:true});
  }));
}
