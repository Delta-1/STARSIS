import {useEffect,useRef,useState} from 'react';
import {Plus,Trash2,X,LoaderCircle} from 'lucide-react';
import {mediaUrl} from './api';
type Row=Record<string,any>;
function Thumb({item,onSend,onDelete,disabled}:{item:Row,onSend:()=>void,onDelete:()=>void,disabled:boolean}){
 const [url,setUrl]=useState('');useEffect(()=>{let active=true;if(item.url)setUrl(item.url);else mediaUrl(item.mediaId).then(v=>{if(active)setUrl(v);}).catch(()=>{});return()=>{active=false;};},[item.mediaId,item.url]);
 return <div className="saved-sticker"><button className="sticker-send" aria-label={`Enviar figurinha ${item.name}`} onClick={onSend} disabled={disabled}>{url?<img src={url} alt={item.name}/>:<LoaderCircle className="spin" size={20}/>}</button><button className="sticker-delete" aria-label={`Remover figurinha ${item.name}`} onClick={onDelete} disabled={disabled}><Trash2 size={12}/></button></div>;
}
export default function StickerPicker({items,busy,onUpload,onSend,onDelete,onClose}:{items:Row[],busy:boolean,onUpload:(file:File)=>void,onSend:(item:Row)=>void,onDelete:(id:string)=>void,onClose:()=>void}){
 const file=useRef<HTMLInputElement>(null);
 return <section className="sticker-picker" aria-label="Minhas figurinhas"><header><strong>Minhas figurinhas</strong><button className="icon-btn" aria-label="Fechar figurinhas" onClick={onClose}><X size={18}/></button></header><input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)onUpload(f);e.target.value='';}}/><div className="sticker-grid">{items.map(item=><Thumb key={item.id} item={item} onSend={()=>onSend(item)} onDelete={()=>onDelete(item.id)} disabled={busy}/>)}</div>{!items.length&&<p>Salve uma figurinha recebida pelo menu da mensagem ou adicione uma imagem.</p>}<button className="btn secondary full" disabled={busy} onClick={()=>file.current?.click()}>{busy?<LoaderCircle className="spin" size={15}/>:<Plus size={16}/>} Adicionar imagem</button></section>;
}
