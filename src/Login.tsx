import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,Eye,EyeOff,LoaderCircle,LockKeyhole,QrCode,RefreshCw,Users} from 'lucide-react';
import {json,setToken} from './api';
type Row=Record<string,any>;
let creatingTrial:Promise<Row>|null=null;
async function prepareTrial(){
 const saved=sessionStorage.getItem('startsys-trial');
 if(saved){try{const value=JSON.parse(saved);await json('auth/trial/status','GET',undefined,value.token);return value;}catch{sessionStorage.removeItem('startsys-trial');}}
 if(!creatingTrial)creatingTrial=json('auth/trial','POST',{},'').then(value=>{sessionStorage.setItem('startsys-trial',JSON.stringify(value));return value;}).finally(()=>creatingTrial=null);
 return creatingTrial;
}
export default function Login({onLogin,onDemo,accountOnly=false,onCancel}:{onLogin:(v:any)=>void,onDemo:()=>void,accountOnly?:boolean,onCancel?:()=>void}){
 const params=new URLSearchParams(window.location.search),invite=params.get('invite')||'',code=params.get('empresa')||'';
 const [section,setSection]=useState(invite||code?'employee':accountOnly?'account':'qr');
 const [mode,setMode]=useState(invite||code?'join':accountOnly?'register':'login'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false),[trial,setTrial]=useState<Row|null>(()=>{try{return JSON.parse(sessionStorage.getItem('startsys-trial')||'null');}catch{return null;}}),[status,setStatus]=useState<Row>({}),[companyName,setCompanyName]=useState('');
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function begin(){setBusy(true);setError('');try{const value=await prepareTrial();if(alive.current)setTrial(value);}catch(e:any){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}}
 useEffect(()=>{if(section==='qr'&&!trial)begin();},[section,trial?.token]);
 useEffect(()=>{if(!trial||section!=='qr')return;let active=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{const value=await json('auth/trial/status','GET',undefined,trial.token);if(active){setStatus(value);setError('');}}catch(e:any){if(active)setError(e.message);}finally{if(active)timer=setTimeout(poll,2200);}};poll();return()=>{active=false;clearTimeout(timer);};
 },[trial?.token,section]);
 useEffect(()=>{if(invite)json('auth/invite','POST',{invite},'').then(v=>setCompanyName(v.companyName)).catch(e=>setError(e.message));},[invite]);
 function account(next:string){setMode(next);setSection(next==='employee'||next==='join'?'employee':'account');setError('');}
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));
  if(['register','join'].includes(mode)&&values.password!==values.confirm){setError('As senhas precisam ser iguais.');return;}
  setBusy(true);setError('');try{
   const result=await json(`auth/${mode==='join'?'employee/register':mode}`,'POST',{...values,...(mode==='join'&&invite?{invite}:{}),...(['register','login'].includes(mode)&&trial?{trialToken:trial.token}:{})},'');
   if(['join','employee'].includes(mode)&&trial)await json('auth/trial/discard','POST',{},trial.token).catch(()=>{});
   setToken(result.token,values.remember==='on');sessionStorage.removeItem('startsys-trial');
   if(invite||code){const url=new URL(window.location.href);url.searchParams.delete('invite');url.searchParams.delete('empresa');history.replaceState(null,'',url);}
   onLogin(result.user);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}
 }
 const connected=status.status==='connected';
 return <div className="wa-entry"><header className="entry-brand"><img src={`${import.meta.env.BASE_URL}starsis-compass.svg`} alt=""/><strong>STARSIS</strong><span>CRM para boas conversas</span></header>
  <main className="entry-card">
   {section==='qr'?<><div className="entry-instructions"><span className="entry-kicker">SEU WHATSAPP. SUA EQUIPE.</span><h1>Conecte e comece<br/>a conversar.</h1><p>O jeito que você já conhece, com atendimento organizado e espaço para toda a equipe.</p><ol><li><b>1</b><span>Abra o <strong>WhatsApp</strong> no seu celular.</span></li><li><b>2</b><span>Toque em <strong>Aparelhos conectados</strong> nas configurações.</span></li><li><b>3</b><span>Toque em <strong>Conectar aparelho</strong> e leia este QR Code.</span></li></ol><div className="entry-test-note"><CheckCircle2 size={17}/><span>Teste por 24 horas. Depois de conectar, você decide como salvar seu acesso.</span></div></div>
    <div className="entry-qr-side">{connected?<div className="entry-connected"><span><CheckCircle2 size={54}/></span><h2>WhatsApp conectado</h2><p>Já tem registro no Starsis?</p><button className="btn primary full" onClick={()=>{setToken(trial!.token);onLogin(trial!.user);}}>Testar o CRM agora <ArrowRight size={17}/></button><button className="btn secondary full" onClick={()=>account('register')}>Ainda não, salvar meu acesso</button><button className="text-btn" onClick={()=>account('login')}>Sim, entrar na minha conta</button></div>:<><div className="entry-qr">{status.qr?<img src={status.qr} alt="QR Code para conectar seu WhatsApp"/>:<div>{busy||status.status==='connecting'?<LoaderCircle size={35} className="spin"/>:<QrCode size={54}/>}<span>{busy?'Preparando seu espaço…':status.lastError||'Preparando QR Code…'}</span></div>}</div><span className="entry-qr-caption">Leia com a câmera do WhatsApp</span><button className="text-btn" disabled={busy} onClick={async()=>{if(!trial){begin();return;}setBusy(true);try{setStatus(await json('auth/trial/reconnect','POST',{},trial.token));}catch(e:any){setError(e.message);if(/expir/i.test(e.message)){sessionStorage.removeItem('startsys-trial');setTrial(null);}}finally{setBusy(false);}}}><RefreshCw size={14}/> Atualizar QR Code</button></>}</div>
   </>:<div className="entry-account"><button className="text-btn" type="button" onClick={()=>{if(onCancel)onCancel();else{setSection('qr');setError('');}}}><ArrowLeft size={16}/>{onCancel?'Voltar ao CRM':'Voltar ao QR Code'}</button><span className="entry-kicker">{section==='employee'?'TRABALHE EM EQUIPE':'SEU ACESSO AO STARSIS'}</span><h1>{mode==='join'?companyName?`Entre na equipe ${companyName}`:'Criar meu acesso de atendente':mode==='employee'?'Acessar minha equipe':mode==='register'?'Guarde sua conexão.':'Bom ter você de volta.'}</h1><p>{mode==='join'?'Crie sua senha individual. Você entrará no atendimento da empresa.':mode==='employee'?'Use o código da empresa e sua senha individual.':mode==='register'?'Seu WhatsApp e as conversas do teste continuam no seu espaço.':'Abra sua empresa e o WhatsApp que ela já mantém conectado. Se já possui empresa, o teste temporário será encerrado.'}</p>
    <div className="auth-tabs">{(section==='employee'?[['employee','Já tenho acesso'],['join','Criar acesso']]:[['login','Entrar'],['register','Criar conta']]).map(([id,name])=><button key={id} className={mode===id?'active':''} onClick={()=>{setMode(id);setError('');}}>{name}</button>)}</div>
    <form className="login-form" onSubmit={submit}>
     {['register','join'].includes(mode)&&<label className="field"><span>Nome completo</span><input name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Seu nome"/></label>}
     {mode==='register'&&<label className="field"><span>Nome da empresa</span><input name="companyName" required minLength={2} maxLength={120} placeholder="Sua empresa"/></label>}
     {section==='employee'?(!invite||mode==='employee')&&<label className="field"><span>Código da empresa</span><input name="companyCode" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required defaultValue={code} placeholder="4 dígitos"/></label>:<label className="field"><span>E-mail</span><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="voce@empresa.com"/></label>}
     <label className="field"><span>{mode==='join'||mode==='register'?'Crie sua senha':'Senha'}</span><span className="password-field"><input name="password" type={visible?'text':'password'} minLength={10} maxLength={200} required autoComplete={['join','register'].includes(mode)?'new-password':'current-password'} placeholder="10 ou mais caracteres"/><button type="button" className="icon-btn" aria-label={visible?'Ocultar senha':'Mostrar senha'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label>
     {['register','join'].includes(mode)&&<label className="field"><span>Confirme sua senha</span><input type={visible?'text':'password'} name="confirm" minLength={10} maxLength={200} required autoComplete="new-password"/></label>}
     <label className="check-field"><input name="remember" type="checkbox" defaultChecked/> Manter conectado neste aparelho</label>
     {error&&<p className="auth-error" role="alert">{error}</p>}
     <button className="btn primary full" disabled={busy}>{busy?<LoaderCircle size={18} className="spin"/>:mode==='join'?'Criar acesso e começar a trabalhar':mode==='register'?'Salvar minha conta':'Entrar'}<ArrowRight size={16}/></button>
    </form>
   </div>}
   {section==='qr'&&error&&<p className="entry-error auth-error" role="alert">{error}</p>}
  </main>
  <div className="entry-bottom"><button onClick={()=>account('login')}>Já tenho conta</button><button onClick={()=>account('employee')}><Users size={15}/> Sou atendente · código ou convite</button><button onClick={onDemo}>Conhecer a demonstração</button></div>
  <footer className="entry-security"><LockKeyhole size={13}/><span>Conexão exclusiva do seu espaço. O QR Code nunca é compartilhado com outra empresa.</span></footer>
 </div>;
}
