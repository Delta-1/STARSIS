import {AlertCircle,Check,CheckCheck,Clock} from 'lucide-react';
export default function DeliveryStatus({value}:{value?:string}){
 if(value==='pending')return <span className="delivery-status pending" role="status"><Clock size={12}/> Enviando</span>;
 if(value==='failed')return <span className="delivery-status failed" role="status"><AlertCircle size={12}/> Não enviada</span>;
 if(value==='uncertain')return <span className="delivery-status uncertain" role="status"><Clock size={12}/> Conferir envio</span>;
 if(value==='read'||value==='delivered')return <CheckCheck size={13} className={value==='read'?'read':''}/>;
 return <Check size={13}/>;
}
