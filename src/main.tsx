import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {json,hasToken,setToken,clearMedia} from './api';
import './styles.css';
export default function Root(){const [user,setUser]=useState<any>(null),[checking,setChecking]=useState(hasToken());useEffect(()=>{if(hasToken())json('auth/me').then(setUser).catch(()=>setToken('')).finally(()=>setChecking(false));const expired=()=>{setToken('');clearMedia();setUser(null);};window.addEventListener('startsys-session-expired',expired);return()=>window.removeEventListener('startsys-session-expired',expired);},[]);async function logout(){try{await json('auth/logout','POST',{});}finally{setToken('');clearMedia();setUser(null);}}if(checking)return <div className="loading"><img src={`${import.meta.env.BASE_URL}favicon.svg`} width="40" alt="StartSys"/><p>Abrindo seu espaço…</p></div>;return <App key={user?.id||'guest'} user={user} onLogin={setUser} onLogout={logout}/>;}
createRoot(document.getElementById('root')!).render(<Root/>);
