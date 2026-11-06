import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import Login from './Login';
import {EmployeeApp} from './SupportBoard';
import {BoardReminders} from './Whiteboard';
import {json,hasToken,setToken,clearMedia} from './api';
import './styles.css';
import './messenger.css';
import './mobile.css';
export default function Root(){
 const [user,setUser]=useState<any>(null),[checking,setChecking]=useState(hasToken()),[claiming,setClaiming]=useState(new URLSearchParams(location.search).has('invite')||new URLSearchParams(location.search).has('empresa'));
 useEffect(()=>{if(hasToken())json('auth/me').then(setUser).catch(()=>setToken('')).finally(()=>setChecking(false));const expired=()=>{setToken('');clearMedia();setUser(null);};window.addEventListener('startsys-session-expired',expired);return()=>window.removeEventListener('startsys-session-expired',expired);},[]);
 async function logout(){try{await json('auth/logout','POST',{});}finally{setToken('');clearMedia();sessionStorage.removeItem('startsys-trial');setUser(null);}}
 function loggedIn(value:any){setUser(value);setClaiming(false);}
 if(checking)return <div className="loading"><img src={`${import.meta.env.BASE_URL}starsis-compass.svg`} width="40" alt="STARSIS"/><p>Abrindo seu espaço…</p></div>;
 if(claiming)return <Login onLogin={loggedIn} onDemo={()=>setClaiming(false)} accountOnly onCancel={user?()=>setClaiming(false):undefined}/>;
 return <>{user?.role==='employee'?<EmployeeApp key={user.id} user={user} onLogout={logout}/>:<App key={user?.id||'guest'} user={user} onLogin={loggedIn} onLogout={logout} onRegister={()=>setClaiming(true)}/>} {user&&<BoardReminders user={user}/>}</>;
}
const updateHeight=()=>document.documentElement.style.setProperty('--app-height',`${window.visualViewport?.height||window.innerHeight}px`);
updateHeight();window.visualViewport?.addEventListener('resize',updateHeight);window.addEventListener('resize',updateHeight);
createRoot(document.getElementById('root')!).render(<Root/>);
