'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
export default function Settings(){
 const[f,setF]=useState<any>({company_name:'صنایع سنگ الماس',english_name:'ALMAS STONE',currency:'toman',phone:'',address:'',invoice_footer:'',store_mode:true,logo_url:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{supabase().from('company_settings').select('*').eq('id',true).maybeSingle().then(({data,error})=>{if(error)setMsg(error.message);else if(data)setF((x:any)=>({...x,...data}))})},[]);
 async function save(){setBusy(true);setMsg('');const{error}=await supabase().from('company_settings').upsert({id:true,company_name:f.company_name||'صنایع سنگ الماس',english_name:f.english_name||'ALMAS STONE',currency:f.currency||'toman',phone:f.phone||null,address:f.address||null,invoice_footer:f.invoice_footer||null,store_mode:!!f.store_mode,logo_url:f.logo_url||null,updated_at:new Date().toISOString()});setBusy(false);setMsg(error?error.message:'تنظیمات با موفقیت ذخیره شد.')}
 return <><div className="title"><div><h1>تنظیمات</h1><p>مشخصات مجموعه، فروشگاه و چاپ فاکتور</p></div></div><div className="card"><div className="two-col">
 <label className="field">نام مجموعه<input className="input" value={f.company_name} onChange={e=>setF({...f,company_name:e.target.value})}/></label>
 <label className="field">نام انگلیسی<input className="input" value={f.english_name} onChange={e=>setF({...f,english_name:e.target.value})}/></label>
 <label className="field">واحد پول<select className="input" value={f.currency} onChange={e=>setF({...f,currency:e.target.value})}><option value="toman">تومان</option><option value="rial">ریال</option></select></label>
 <label className="field">تلفن<input className="input" value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></label>
 <label className="field">آدرس لوگو (اختیاری)<input className="input" value={f.logo_url||''} onChange={e=>setF({...f,logo_url:e.target.value})}/></label>
 </div>
 <label className="field">آدرس<textarea className="input" rows={2} value={f.address||''} onChange={e=>setF({...f,address:e.target.value})}/></label>
 <label className="field">متن پایین فاکتور<textarea className="input" rows={3} value={f.invoice_footer||''} onChange={e=>setF({...f,invoice_footer:e.target.value})} placeholder="با تشکر از خرید شما..."/></label>
 <label style={{display:'flex',gap:8,alignItems:'center',margin:'12px 0'}}><input type="checkbox" checked={!!f.store_mode} onChange={e=>setF({...f,store_mode:e.target.checked})}/> حالت فروشگاهی / POS فعال باشد</label>
 {msg&&<div className={msg.includes('موفقیت')?'success':'msg'}>{msg}</div>}<button className="btn" disabled={busy} onClick={save}>{busy?'در حال ذخیره…':'ذخیره تنظیمات'}</button></div></>
}
