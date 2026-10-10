'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {toJalali} from '@/lib/jalali';
const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));

export default function Ledger(){
 const[parties,setParties]=useState<any[]>([]),[selected,setSelected]=useState(''),[entries,setEntries]=useState<any[]>([]),[loading,setLoading]=useState(false),[msg,setMsg]=useState('');
 async function loadParties(){const s=supabase();const[{data:p,error},{data:c},{data:sp}]=await Promise.all([
  s.from('parties').select('id,display_name,party_type,phone,active').eq('active',true).order('display_name'),
  s.from('v_customer_balances').select('customer_id,balance'),
  s.from('v_supplier_balances').select('supplier_id,balance')
 ]);if(error){setMsg(error.message);return}const cm=new Map((c||[]).map((x:any)=>[x.customer_id,Number(x.balance||0)])),sm=new Map((sp||[]).map((x:any)=>[x.supplier_id,Number(x.balance||0)]));setParties((p||[]).map((x:any)=>({...x,customer_balance:cm.get(x.id)||0,supplier_balance:sm.get(x.id)||0})))}
 useEffect(()=>{loadParties()},[]);
 async function loadLedger(id:string){setSelected(id);setEntries([]);if(!id)return;setLoading(true);setMsg('');const s=supabase();const[si,pu,tr,ch]=await Promise.all([
  s.from('sales_invoices').select('id,invoice_no,invoice_date,jalali_date,total,returned_amount,status').eq('customer_id',id).order('invoice_date'),
  s.from('purchase_invoices').select('id,purchase_no,invoice_date,jalali_date,total').eq('supplier_id',id).order('invoice_date'),
  s.from('financial_transactions').select('id,direction,method,amount,transaction_date,jalali_date,description,reference').eq('party_id',id).order('transaction_date'),
  s.from('checks').select('id,direction,amount,status,due_date,due_jalali,reason,check_serial').eq('party_id',id).order('due_date')
 ]);
 const e:any[]=[];
 (si.data||[]).filter((x:any)=>x.status!=='cancelled').forEach((x:any)=>e.push({k:'فروش',ref:'#'+x.invoice_no,date:x.jalali_date||toJalali(x.invoice_date),sort:x.invoice_date||'',debit:Math.max(0,Number(x.total||0)-Number(x.returned_amount||0)),credit:0,desc:'فاکتور فروش'}));
 (pu.data||[]).forEach((x:any)=>e.push({k:'خرید',ref:'#'+x.purchase_no,date:x.jalali_date||toJalali(x.invoice_date),sort:x.invoice_date||'',debit:0,credit:Number(x.total||0),desc:'فاکتور خرید'}));
 (tr.data||[]).forEach((x:any)=>e.push({k:x.direction==='receipt'?'دریافت':'پرداخت',ref:x.reference||'-',date:x.jalali_date||toJalali(x.transaction_date),sort:x.transaction_date||'',debit:x.direction==='payment'?Number(x.amount||0):0,credit:x.direction==='receipt'?Number(x.amount||0):0,desc:x.description||x.method}));
 (ch.data||[]).forEach((x:any)=>e.push({k:x.direction==='receivable'?'چک دریافتی':'چک پرداختی',ref:x.check_serial||'-',date:x.due_jalali||toJalali(x.due_date),sort:x.due_date||'',debit:0,credit:0,desc:(x.reason||'')+' · '+String(x.status||'')+' · '+money(x.amount)}));
 e.sort((a,b)=>String(a.sort).localeCompare(String(b.sort)));setEntries(e);setLoading(false)
 }
 const p=parties.find(x=>x.id===selected);
 const net=Number(p?.customer_balance||0)-Number(p?.supplier_balance||0);
 const running=useMemo(()=>{let v=0;return entries.map(x=>{v+=Number(x.debit||0)-Number(x.credit||0);return {...x,running:v}})},[entries]);
 return <><div className="title"><div><h1>حساب طرف‌ها</h1><p>مانده مشتری، تأمین‌کننده و گردش یکپارچه هر طرف حساب</p></div></div>
 <div className="card"><div className="two-col"><div className="field" style={{margin:0}}><label>طرف حساب</label><select className="input" value={selected} onChange={e=>loadLedger(e.target.value)}><option value="">انتخاب کنید</option>{parties.map(x=><option key={x.id} value={x.id}>{x.display_name}</option>)}</select></div>{p&&<div><div className="k">خالص وضعیت حساب</div><div className="v">{net>0?money(net)+' تومان بدهکار به ما':net<0?money(Math.abs(net))+' تومان بستانکار از ما':'تسویه'}</div></div>}</div></div>
 {p&&<div className="grid section"><div className="card"><div className="k">مطالبات از مشتری</div><div className="v">{money(p.customer_balance)}</div></div><div className="card"><div className="k">بدهی به تأمین‌کننده</div><div className="v">{money(p.supplier_balance)}</div></div><div className="card"><div className="k">موبایل</div><div className="v" style={{fontSize:16}}>{p.phone||'-'}</div></div><div className="card"><div className="k">نوع</div><div className="v" style={{fontSize:16}}>{p.party_type==='both'?'مشتری و تأمین‌کننده':p.party_type==='supplier'?'تأمین‌کننده':'مشتری'}</div></div></div>}
 {msg&&<div className="msg">{msg}</div>}
 {selected&&<div className="section"><h2 style={{fontSize:18}}>گردش حساب</h2><div style={{overflow:'auto'}}><table className="table"><thead><tr><th>تاریخ</th><th>نوع</th><th>مرجع</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده گردش</th></tr></thead><tbody>{loading?<tr><td colSpan={7}>در حال بارگذاری…</td></tr>:running.length?running.map((x:any,i)=><tr key={i}><td>{x.date}</td><td>{x.k}</td><td>{x.ref}</td><td>{x.desc}</td><td>{x.debit?money(x.debit):'-'}</td><td>{x.credit?money(x.credit):'-'}</td><td><b>{money(x.running)}</b></td></tr>):<tr><td colSpan={7}>گردشی ثبت نشده است.</td></tr>}</tbody></table></div></div>}</>
}
