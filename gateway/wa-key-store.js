// Persist a Signal transaction in batches instead of one database round trip per device/key.
export function createPersistentKeys({db,cid,nid,crypt,slot,reviver,replacer,fromAppState,fail}){
 return {
  async get(type,ids){
   if(!ids.length)return {};
   const records=new Map();
   for(let offset=0;offset<ids.length;offset+=100){
    const {data,error}=await db.from('startsys_records').select('id,data').eq('company_id',cid).eq('kind','wa-auth').in('id',ids.slice(offset,offset+100).map(id=>slot(`${type}-${id}`)));
    if(error)throw fail(503,'Não foi possível consultar as chaves da sessão.');
    for(const record of data||[])records.set(record.id,record.data);
   }
   return Object.fromEntries(ids.map(id=>{
    const record=records.get(slot(`${type}-${id}`));let value=record?JSON.parse(crypt.open(record.value),reviver):null;
    if(type==='app-state-sync-key'&&value)value=fromAppState(value);
    return [id,value];
   }));
  },
  async set(values){
   const writes=[],removals=[],at=new Date().toISOString();
   for(const [type,items]of Object.entries(values))for(const [id,value]of Object.entries(items)){
    const key=slot(`${type}-${id}`);
    if(value)writes.push({id:key,company_id:cid,kind:'wa-auth',data:{numberId:nid,value:crypt.seal(JSON.stringify(value,replacer))},updated_at:at});
    else removals.push(key);
   }
   // WhatsApp key transactions may contain hundreds of prekeys or group devices.
   for(let offset=0;offset<writes.length;offset+=500){
    const {error}=await db.from('startsys_records').upsert(writes.slice(offset,offset+500),{onConflict:'id'});
    if(error)throw fail(503,'Não foi possível salvar as chaves da sessão.');
   }
   if(removals.length){const {error}=await db.from('startsys_records').delete().eq('company_id',cid).eq('kind','wa-auth').in('id',removals);if(error)throw fail(503,'Não foi possível atualizar as chaves da sessão.');}
  }
 };
}
