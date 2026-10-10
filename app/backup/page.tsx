'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabase';

const tables=['products','parties','sales_invoices','sales_invoice_items','financial_transactions','checks','expenses','purchase_invoices','purchase_items','materials','inventory_movements','production_batches','production_material_usage','bom_items','employees','attendance','payroll_periods','orders','order_items','freight_records','sale_returns','sale_return_items','cash_registers','cash_sessions','company_settings'];
function download(name:string,text:string,type:string){const b=new Blob([text],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function csv(rows:any[]){if(!rows.length)return '';const cols=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));const esc=(v:any)=>{const s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);return '"'+s.replaceAll('"','""')+'"'};return '\uFEFF'+cols.map(esc).join(',')+'\n'+rows.map(r=>cols.map(c=>esc(r[c])).join(',')).join('\n')}

export default function Backup(){
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[progress,setProgress]=useState('');
 async function exportAll(){setBusy(true);setMsg('');const s=supabase();const out:any={meta:{app:'Almas Stone ERP',exported_at:new Date().toISOString(),format:2},tables:{}};for(const t of tables){setProgress(t);const{data,error}=await s.from(t).select('*');out.tables[t]={rows:data||[],error:error?.message||null}}download(`almas-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(out,null,2),'application/json;charset=utf-8');setBusy(false);setProgress('');setMsg('فایل پشتیبان کامل ساخته شد.')}
 async function exportCsv(t:string){setBusy(true);const{data,error}=await supabase().from(t).select('*');setBusy(false);if(error){setMsg(error.message);return}download(`${t}-${new Date().toISOString().slice(0,10)}.csv`,csv(data||[]),'text/csv;charset=utf-8')}
 return <><div className="title"><div><h1>پشتیبان و خروجی</h1><p>دریافت نسخه قابل نگهداری از اطلاعات عملیاتی</p></div></div>
 <div className="card"><h3 style={{marginTop:0}}>پشتیبان کامل JSON</h3><p className="muted">تمام داده‌های قابل دسترس حساب فعلی در یک فایل خروجی ذخیره می‌شوند. فایل را در محل امن نگهداری کنید.</p><button className="btn" disabled={busy} onClick={exportAll}>{busy?`در حال خروجی ${progress}…`:'دریافت پشتیبان کامل'}</button></div>
 <div className="card section"><h3 style={{marginTop:0}}>خروجی CSV برای Excel</h3><div className="toolbar">{[['products','محصولات'],['parties','طرف حساب'],['sales_invoices','فاکتور فروش'],['financial_transactions','دریافت/پرداخت'],['checks','چک‌ها'],['expenses','هزینه‌ها'],['inventory_movements','گردش انبار'],['employees','کارکنان'],['payroll_periods','حقوق']].map(([t,l])=><button className="btn secondary" disabled={busy} key={t} onClick={()=>exportCsv(t)}>{l}</button>)}</div></div>
 {msg&&<div className="success">{msg}</div>}</>
}
