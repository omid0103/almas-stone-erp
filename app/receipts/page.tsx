'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {fromJalali,toJalali,todayJalali} from '@/lib/jalali';
import FormModal from '@/components/FormModal';
const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));
const methods:any={cash:'نقد',pos:'کارتخوان',card_to_card:'کارت به کارت',paya:'پایا',satna:'ساتنا',check:'چک',bank:'بانکی',other:'سایر'};

export default function Receipts(){
 const[rows,setRows]=useState<any[]>([]),[parties,setParties]=useState<any[]>([]),[invoices,setInvoices]=useState<any[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[sessionId,setSessionId]=useState<string|null>(null);
 const[direction,setDirection]=useState('receipt'),[method,setMethod]=useState('bank'),[amount,setAmount]=useState(0),[jalali,setJalali]=useState(todayJalali()),[description,setDescription]=useState(''),[partyId,setPartyId]=useState(''),[reference,setReference]=useState(''),[invoiceId,setInvoiceId]=useState('');
 async function load(){const s=supabase();const[{data:r},{data:p},{data:i},{data:cs}]=await Promise.all([
  s.from('financial_transactions').select('id,direction,method,amount,jalali_date,transaction_date,description,reference,invoice_id,party:parties(display_name),invoice:sales_invoices(invoice_no)').order('created_at',{ascending:false}).limit(300),
  s.from('parties').select('id,display_name').eq('active',true).order('display_name'),
  s.from('sales_invoices').select('id,invoice_no,total,paid_amount,returned_amount,payment_status,customer_id,customer:parties(display_name)').neq('status','cancelled').order('invoice_no',{ascending:false}).limit(200),
  s.from('cash_sessions').select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle()
 ]);setRows(r||[]);setParties(p||[]);setInvoices((i||[]).filter((x:any)=>Number(x.total||0)-Number(x.paid_amount||0)-Number(x.returned_amount||0)>0));setSessionId(cs?.id||null)}
 useEffect(()=>{load()},[]);
 function reset(){setDirection('receipt');setMethod('bank');setAmount(0);setJalali(todayJalali());setDescription('');setPartyId('');setReference('');setInvoiceId('');setMsg('')}
 function chooseInvoice(id:string){setInvoiceId(id);const x=invoices.find(z=>z.id===id);if(x){setPartyId(x.customer_id||'');setAmount(Math.max(0,Number(x.total||0)-Number(x.paid_amount||0)-Number(x.returned_amount||0)));setDescription(`دریافت بابت فاکتور #${x.invoice_no}`)}}
 async function save(){
  if(amount<=0){setMsg('مبلغ باید بیشتر از صفر باشد.');return}if(!description.trim()){setMsg('شرح تراکنش را وارد کنید.');return}
  const date=fromJalali(jalali);if(!date){setMsg('تاریخ شمسی معتبر نیست.');return}
  setBusy(true);const s=supabase();const{data:u}=await s.auth.getUser();const payload:any={direction,method,amount:Number(amount),jalali_date:jalali,transaction_date:date,description:description.trim(),party_id:partyId||null,reference:reference||null,invoice_id:invoiceId||null,created_by:u.user?.id||null};if(sessionId&&['cash','pos'].includes(method))payload.cash_session_id=sessionId;
  const{data:tx,error}=await s.from('financial_transactions').insert(payload).select('id').single();
  if(error){setBusy(false);setMsg(error.message);return}
  if(direction==='receipt'&&invoiceId){const inv=invoices.find(x=>x.id===invoiceId);if(inv){const next=Number(inv.paid_amount||0)+Number(amount);const net=Math.max(0,Number(inv.total||0)-Number(inv.returned_amount||0));await s.from('sales_invoices').update({paid_amount:next,payment_status:next>=net?'paid':'partial'}).eq('id',invoiceId)}}
  setBusy(false);setOpen(false);reset();load()
 }
 async function remove(id:string){if(!confirm('این تراکنش حذف شود؟'))return;const s=supabase();const row=rows.find(x=>x.id===id);const{error}=await s.from('financial_transactions').delete().eq('id',id);if(error){alert(error.message);return}if(row?.direction==='receipt'&&row.invoice_id){const{data:inv}=await s.from('sales_invoices').select('id,total,paid_amount,returned_amount').eq('id',row.invoice_id).maybeSingle();if(inv){const next=Math.max(0,Number(inv.paid_amount||0)-Number(row.amount||0)),net=Math.max(0,Number(inv.total||0)-Number(inv.returned_amount||0));await s.from('sales_invoices').update({paid_amount:next,payment_status:next<=0?'unpaid':next>=net?'paid':'partial'}).eq('id',inv.id)}}load()}
 const income=rows.filter(r=>r.direction==='receipt').reduce((s,r)=>s+Number(r.amount||0),0),out=rows.filter(r=>r.direction==='payment').reduce((s,r)=>s+Number(r.amount||0),0);
 return <><div className="title"><div><h1>دریافت و پرداخت</h1><p>ثبت تراکنش، تسویه فاکتور و اتصال صندوق</p></div><button className="btn" onClick={()=>{reset();setOpen(true)}}>+ ثبت تراکنش</button></div>
 <div className="grid" style={{marginBottom:14}}><div className="card"><div className="k">جمع دریافت</div><div className="v">{money(income)}</div></div><div className="card"><div className="k">جمع پرداخت</div><div className="v">{money(out)}</div></div><div className="card"><div className="k">خالص جریان</div><div className="v">{money(income-out)}</div></div><div className="card"><div className="k">فاکتور باز</div><div className="v">{invoices.length}</div></div></div>
 <div style={{overflow:'auto'}}><table className="table"><thead><tr><th>تاریخ</th><th>نوع</th><th>طرف حساب</th><th>فاکتور</th><th>شرح</th><th>روش</th><th>مرجع</th><th>مبلغ</th><th></th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{r.jalali_date||toJalali(r.transaction_date)}</td><td>{r.direction==='receipt'?'دریافت':'پرداخت'}</td><td>{r.party?.display_name||'-'}</td><td>{r.invoice?.invoice_no?'#'+r.invoice.invoice_no:'-'}</td><td>{r.description||'-'}</td><td>{methods[r.method]||r.method}</td><td>{r.reference||'-'}</td><td><b>{money(r.amount)}</b></td><td><button className="btn danger compact" onClick={()=>remove(r.id)}>حذف</button></td></tr>):<tr><td colSpan={9} style={{textAlign:'center',padding:30}}>هنوز تراکنشی ثبت نشده است.</td></tr>}</tbody></table></div>
 <FormModal open={open} title="ثبت دریافت / پرداخت" onClose={()=>setOpen(false)}><div className="two-col">
  <div className="field"><label>نوع</label><select className="input" value={direction} onChange={e=>setDirection(e.target.value)}><option value="receipt">دریافت</option><option value="payment">پرداخت</option></select></div>
  <div className="field"><label>روش</label><select className="input" value={method} onChange={e=>setMethod(e.target.value)}>{Object.entries(methods).map(([k,v])=><option key={k} value={k}>{v as string}</option>)}</select></div>
  {direction==='receipt'&&<div className="field"><label>فاکتور فروش</label><select className="input" value={invoiceId} onChange={e=>chooseInvoice(e.target.value)}><option value="">بدون اتصال به فاکتور</option>{invoices.map(x=><option key={x.id} value={x.id}>#{x.invoice_no} · {x.customer?.display_name||'-'} · مانده {money(Number(x.total||0)-Number(x.paid_amount||0)-Number(x.returned_amount||0))}</option>)}</select></div>}
  <div className="field"><label>مبلغ *</label><input className="input" type="number" min="0" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></div>
  <div className="field"><label>تاریخ شمسی</label><input className="input" value={jalali} onChange={e=>setJalali(e.target.value)}/></div>
  <div className="field"><label>طرف حساب</label><select className="input" value={partyId} onChange={e=>setPartyId(e.target.value)}><option value="">بدون طرف حساب</option>{parties.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
  <div className="field"><label>شماره مرجع / پیگیری</label><input className="input" value={reference} onChange={e=>setReference(e.target.value)}/></div>
 </div><div className="field"><label>شرح *</label><textarea className="input" rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></div>{sessionId&&['cash','pos'].includes(method)&&<div className="success">این تراکنش به صندوق باز فعلی متصل می‌شود.</div>}{msg&&<div className="msg">{msg}</div>}<button className="btn" style={{width:'100%',marginTop:12}} disabled={busy} onClick={save}>{busy?'در حال ثبت…':'ثبت تراکنش'}</button></FormModal></>
}
