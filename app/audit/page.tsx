'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabase';
const tableFa:any={products:'محصولات',parties:'طرف حساب',sales_invoices:'فاکتور فروش',purchase_invoices:'فاکتور خرید',expenses:'هزینه‌ها',checks:'چک‌ها',inventory_movements:'گردش انبار',production_batches:'تولید',payroll_periods:'حقوق'};
const actionFa:any={INSERT:'ثبت',UPDATE:'ویرایش',DELETE:'حذف'};

export default function Audit(){
 const[rows,setRows]=useState<any[]>([]),[profiles,setProfiles]=useState<any[]>([]),[table,setTable]=useState(''),[q,setQ]=useState(''),[msg,setMsg]=useState('');
 async function load(){const s=supabase();let x=s.from('audit_logs').select('id,actor_id,table_name,record_id,action,old_data,new_data,created_at').order('created_at',{ascending:false}).limit(500);if(table)x=x.eq('table_name',table);const[{data,error},{data:p}]=await Promise.all([x,s.from('profiles').select('id,full_name')]);if(error){setMsg(error.message);return}setRows(data||[]);setProfiles(p||[])}
 useEffect(()=>{load()},[table]);
 const pm=useMemo(()=>new Map(profiles.map(x=>[x.id,x.full_name])),[profiles]);
 const filtered=useMemo(()=>{const s=q.trim().toLowerCase();if(!s)return rows;return rows.filter(x=>JSON.stringify(x).toLowerCase().includes(s)||String(pm.get(x.actor_id)||'').toLowerCase().includes(s))},[rows,q,pm]);
 return <><div className="title"><div><h1>لاگ تغییرات</h1><p>ردیابی ثبت، ویرایش و حذف اطلاعات حساس سیستم</p></div></div>
 <div className="card" style={{marginBottom:14}}><div className="toolbar"><div className="field" style={{margin:0,minWidth:180}}><label>بخش</label><select className="input" value={table} onChange={e=>setTable(e.target.value)}><option value="">همه</option>{Object.entries(tableFa).map(([k,v])=><option key={k} value={k}>{v as string}</option>)}</select></div><div className="field" style={{margin:0,flex:1,minWidth:220}}><label>جستجو</label><input className="input" value={q} onChange={e=>setQ(e.target.value)} placeholder="نام کاربر، شناسه، مقدار…"/></div><button className="btn" onClick={load}>بروزرسانی</button></div></div>
 {msg&&<div className="msg">{msg}</div>}<div style={{overflow:'auto'}}><table className="table"><thead><tr><th>زمان</th><th>کاربر</th><th>بخش</th><th>عملیات</th><th>شناسه رکورد</th><th>جزئیات</th></tr></thead><tbody>{filtered.length?filtered.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString('fa-IR')}</td><td>{pm.get(x.actor_id)||'سیستم'}</td><td>{tableFa[x.table_name]||x.table_name}</td><td>{actionFa[x.action]||x.action}</td><td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis'}}>{x.record_id||'-'}</td><td><details><summary style={{cursor:'pointer'}}>مشاهده</summary><pre style={{whiteSpace:'pre-wrap',minWidth:300,fontSize:10,direction:'ltr',textAlign:'left'}}>{JSON.stringify({قبل:x.old_data,بعد:x.new_data},null,2)}</pre></details></td></tr>):<tr><td colSpan={6}>لاگی ثبت نشده است.</td></tr>}</tbody></table></div></>
}
