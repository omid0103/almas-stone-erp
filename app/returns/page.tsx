'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {fromJalali,todayJalali,toJalali} from '@/lib/jalali';
const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));

export default function Returns(){
 const[invoices,setInvoices]=useState<any[]>([]),[returns,setReturns]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[qty,setQty]=useState<Record<string,number>>({});
 const[refund,setRefund]=useState(0),[method,setMethod]=useState('bank'),[jalali,setJalali]=useState(todayJalali()),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function load(){
  const s=supabase();
  const[{data:i,error},{data:r}]=await Promise.all([
   s.from('sales_invoices').select('id,invoice_no,invoice_date,jalali_date,total,customer_id,customer:parties(display_name),sales_invoice_items(id,product_id,description,quantity,unit_price,discount)').neq('status','cancelled').order('invoice_no',{ascending:false}).limit(100),
   s.from('sale_returns').select('id,return_no,return_date,jalali_date,total,refund_amount,status,invoice:sales_invoices(invoice_no),customer:parties(display_name)').order('return_no',{ascending:false}).limit(100)
  ]);
  if(error){setMsg('ماژول مرجوعی هنوز روی دیتابیس فعال نشده است.');return}setInvoices(i||[]);setReturns(r||[]);
 }
 useEffect(()=>{load()},[]);
 function choose(id:string){const x=invoices.find(z=>z.id===id)||null;setSelected(x);setQty({});setRefund(0);setMsg('')}
 const returnTotal=useMemo(()=>{if(!selected)return 0;return (selected.sales_invoice_items||[]).reduce((s:number,it:any)=>s+Math.max(0,Number(qty[it.id]||0))*Number(it.unit_price||0),0)},[selected,qty]);
 async function save(){
  if(!selected){setMsg('فاکتور را انتخاب کنید.');return}const date=fromJalali(jalali);if(!date){setMsg('تاریخ شمسی معتبر نیست.');return}
  const items=(selected.sales_invoice_items||[]).filter((x:any)=>Number(qty[x.id]||0)>0).map((x:any)=>({invoice_item_id:x.id,quantity:Number(qty[x.id])}));
  if(!items.length){setMsg('حداقل یک قلم مرجوعی وارد کنید.');return}if(refund>returnTotal){setMsg('مبلغ استرداد نمی‌تواند بیشتر از مبلغ مرجوعی باشد.');return}
  setBusy(true);setMsg('');const {error}=await supabase().rpc('create_sale_return',{p_invoice_id:selected.id,p_customer_id:selected.customer_id,p_return_date:date,p_jalali_date:jalali,p_items:items,p_refund_amount:Number(refund||0),p_refund_method:method,p_notes:notes||null});setBusy(false);
  if(error){setMsg(error.message);return}setMsg('مرجوعی با موفقیت ثبت و موجودی کالا اصلاح شد.');setSelected(null);setQty({});setRefund(0);setNotes('');await load();
 }
 return <><div className="title"><div><h1>مرجوعی فروش</h1><p>برگشت کالا بر اساس فاکتور، اصلاح خودکار موجودی و ثبت استرداد وجه</p></div></div>
 <div className="card"><div className="two-col"><div className="field" style={{margin:0}}><label>فاکتور فروش</label><select className="input" value={selected?.id||''} onChange={e=>choose(e.target.value)}><option value="">انتخاب فاکتور</option>{invoices.map(x=><option key={x.id} value={x.id}>#{x.invoice_no} · {x.customer?.display_name||'-'} · {x.jalali_date||toJalali(x.invoice_date)}</option>)}</select></div><div className="field" style={{margin:0}}><label>تاریخ مرجوعی</label><input className="input" value={jalali} onChange={e=>setJalali(e.target.value)}/></div></div>
 {selected&&<><div style={{overflow:'auto',marginTop:14}}><table className="table"><thead><tr><th>کالا</th><th>فروخته‌شده</th><th>قیمت واحد</th><th>تعداد مرجوعی</th><th>جمع</th></tr></thead><tbody>{(selected.sales_invoice_items||[]).map((x:any)=><tr key={x.id}><td>{x.description}</td><td>{x.quantity}</td><td>{money(x.unit_price)}</td><td><input className="input" style={{maxWidth:120}} type="number" min="0" max={x.quantity} step="0.01" value={qty[x.id]||''} onChange={e=>setQty({...qty,[x.id]:Number(e.target.value)})}/></td><td>{money(Number(qty[x.id]||0)*Number(x.unit_price||0))}</td></tr>)}</tbody></table></div>
 <div className="two-col"><div className="field"><label>روش استرداد</label><select className="input" value={method} onChange={e=>setMethod(e.target.value)}><option value="bank">بانکی</option><option value="cash">نقد</option><option value="pos">کارتخوان</option><option value="card_to_card">کارت به کارت</option><option value="other">سایر</option></select></div><div className="field"><label>مبلغ استرداد</label><input className="input" type="number" min="0" max={returnTotal} value={refund} onChange={e=>setRefund(Number(e.target.value))}/><button className="btn secondary compact" style={{marginTop:6}} onClick={()=>setRefund(returnTotal)}>استرداد کامل</button></div></div>
 <div className="field"><label>توضیحات</label><textarea className="input" rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></div><div className="summary-row total"><span>جمع مرجوعی</span><span>{money(returnTotal)} تومان</span></div><button className="btn" style={{width:'100%',marginTop:10}} disabled={busy} onClick={save}>{busy?'در حال ثبت…':'ثبت قطعی مرجوعی'}</button></>}
 {msg&&<div className={msg.includes('موفقیت')?'success':'msg'}>{msg}</div>}</div>
 <div className="section"><h2 style={{fontSize:18}}>سوابق مرجوعی</h2><div style={{overflow:'auto'}}><table className="table"><thead><tr><th>شماره</th><th>تاریخ</th><th>فاکتور</th><th>مشتری</th><th>جمع</th><th>استرداد</th><th>وضعیت</th></tr></thead><tbody>{returns.length?returns.map((r:any)=><tr key={r.id}><td>{r.return_no}</td><td>{r.jalali_date||toJalali(r.return_date)}</td><td>#{r.invoice?.invoice_no||'-'}</td><td>{r.customer?.display_name||'-'}</td><td>{money(r.total)}</td><td>{money(r.refund_amount)}</td><td>{r.status==='confirmed'?'تأیید شده':'لغو شده'}</td></tr>):<tr><td colSpan={7}>مرجوعی ثبت نشده است.</td></tr>}</tbody></table></div></div></>
}
