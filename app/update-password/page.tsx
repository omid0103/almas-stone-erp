'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

export default function UpdatePassword(){
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [msg,setMsg]=useState('در حال بررسی لینک بازیابی...');
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const r=useRouter();
 useEffect(()=>{(async()=>{
  const s=supabase();
  const params=new URLSearchParams(window.location.search);
  const code=params.get('code');
  if(code){const {error}=await s.auth.exchangeCodeForSession(code);if(error){setMsg('لینک بازیابی معتبر نیست یا منقضی شده است. دوباره درخواست بازیابی رمز بدهید.');return}}
  const {data:{session}}=await s.auth.getSession();
  if(!session){setMsg('نشست بازیابی ایجاد نشد. دوباره از صفحه ورود درخواست بازیابی رمز بدهید.');return}
  setReady(true);setMsg('رمز عبور جدید را وارد کنید.');
 })()},[]);
 async function save(e:React.FormEvent){e.preventDefault();if(password.length<6){setMsg('رمز عبور باید حداقل ۶ کاراکتر باشد.');return}if(password!==confirm){setMsg('تکرار رمز عبور با رمز جدید یکسان نیست.');return}setBusy(true);const {error}=await supabase().auth.updateUser({password});setBusy(false);if(error){setMsg(error.message);return}setMsg('رمز عبور با موفقیت تغییر کرد.');setTimeout(()=>{r.replace('/login')},1000)}
 return <div className="login"><div className="loginbox"><div className="brand"><b>ALMAS STONE ERP</b><small>صنایع سنگ الماس</small></div><h2>تعیین رمز عبور جدید</h2><div className="msg">{msg}</div>{ready&&<form onSubmit={save}><div className="field"><label>رمز عبور جدید</label><input className="input" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/></div><div className="field"><label>تکرار رمز عبور</label><input className="input" type="password" minLength={6} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></div><button className="btn" disabled={busy} style={{width:'100%',marginTop:16}}>{busy?'در حال ذخیره...':'ثبت رمز عبور جدید'}</button></form>}<button className="btn" type="button" style={{width:'100%',marginTop:10,background:'#333'}} onClick={()=>r.replace('/login')}>بازگشت به ورود</button></div></div>
}
