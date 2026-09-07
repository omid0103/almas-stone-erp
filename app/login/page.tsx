'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

function faError(message:string){
 const m=message.toLowerCase();
 if(m.includes('email not confirmed')) return 'ایمیل شما هنوز تأیید نشده است. روی «ارسال دوباره لینک تأیید» بزنید و سپس ایمیل را تأیید کنید.';
 if(m.includes('invalid login credentials')) return 'ایمیل یا رمز عبور صحیح نیست.';
 if(m.includes('user already registered')) return 'این ایمیل قبلاً ثبت شده است. از بخش ورود استفاده کنید.';
 if(m.includes('password')) return 'رمز عبور باید حداقل ۶ کاراکتر باشد.';
 return message;
}

export default function Login(){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [name,setName]=useState('');
 const [mode,setMode]=useState<'login'|'signup'>('login');
 const [msg,setMsg]=useState('');
 const [needsConfirm,setNeedsConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const r=useRouter();

 async function submit(e:React.FormEvent){
  e.preventDefault();setMsg('');setNeedsConfirm(false);setBusy(true);
  const s=supabase();
  if(mode==='login'){
   const {error}=await s.auth.signInWithPassword({email,password});
   setBusy(false);
   if(error){setMsg(faError(error.message));if(error.message.toLowerCase().includes('email not confirmed'))setNeedsConfirm(true);return}
   r.replace('/');r.refresh();
  }else{
   const {data,error}=await s.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:typeof window!=='undefined'?window.location.origin+'/login':undefined}});
   setBusy(false);
   if(error){setMsg(faError(error.message));return}
   if(data.session){r.replace('/');r.refresh();return}
   setMsg('حساب ساخته شد. برای فعال شدن ورود، لینک تأیید ارسال‌شده به ایمیل را باز کنید.');setNeedsConfirm(true);setMode('login');
  }
 }

 async function resend(){
  if(!email){setMsg('ابتدا ایمیل را وارد کنید.');return}
  setBusy(true);setMsg('');
  const {error}=await supabase().auth.resend({type:'signup',email,options:{emailRedirectTo:typeof window!=='undefined'?window.location.origin+'/login':undefined}});
  setBusy(false);
  if(error){setMsg(faError(error.message));return}
  setMsg('لینک تأیید دوباره ارسال شد. پوشه Inbox و Spam را بررسی کنید.');
 }

 async function resetPassword(){
  if(!email){setMsg('برای بازیابی رمز، ابتدا ایمیل را وارد کنید.');return}
  setBusy(true);setMsg('');
  const {error}=await supabase().auth.resetPasswordForEmail(email,{redirectTo:typeof window!=='undefined'?window.location.origin+'/login':undefined});
  setBusy(false);
  setMsg(error?faError(error.message):'لینک بازیابی رمز عبور به ایمیل شما ارسال شد.');
 }

 return <div className="login"><div className="loginbox"><div className="brand"><b>ALMAS STONE ERP</b><small>صنایع سنگ الماس</small></div><h2>{mode==='login'?'ورود به سامانه':'ساخت حساب مدیر'}</h2><form onSubmit={submit}>{mode==='signup'&&<div className="field"><label>نام و نام خانوادگی</label><input className="input" value={name} onChange={e=>setName(e.target.value)} required/></div>}<div className="field"><label>ایمیل</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value.trim())} required/></div><div className="field"><label>رمز عبور</label><input className="input" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/></div><button className="btn" disabled={busy} style={{width:'100%',marginTop:16}}>{busy?'در حال بررسی...':mode==='login'?'ورود':'ایجاد حساب'}</button></form>{msg&&<div className="msg">{msg}</div>}{mode==='login'&&<><button className="btn" type="button" style={{width:'100%',marginTop:10,background:needsConfirm?'#9a7416':'#555'}} onClick={resend}>ارسال دوباره لینک تأیید ایمیل</button><button className="btn" type="button" style={{width:'100%',marginTop:8,background:'#555'}} onClick={resetPassword}>فراموشی رمز عبور</button></>}<button className="btn" type="button" style={{width:'100%',marginTop:10,background:'#333'}} onClick={()=>{setMode(mode==='login'?'signup':'login');setMsg('');setNeedsConfirm(false)}}>{mode==='login'?'اولین بار است؟ ساخت حساب':'بازگشت به ورود'}</button></div></div>
}
