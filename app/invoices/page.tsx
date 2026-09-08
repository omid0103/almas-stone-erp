'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {fromJalali,toJalali,todayJalali} from '@/lib/jalali';
import FormModal from '@/components/FormModal';

const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));
type Line={product_id:string;description:string;quantity:number;unit_price:number;discount:number};
const emptyLine:Line={product_id:'',description:'',quantity:1,unit_price:0,discount:0};

export default function Invoices(){
 const [rows,setRows]=useState<any[]>([]),[customers,setCustomers]=useState<any[]>([]),[products,setProducts]=useState<any[]>([]);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const [customerId,setCustomerId]=useState(''),[jalali,setJalali]=useState(todayJalali()),[discount,setDiscount]=useState(0),[freight,setFreight]=useState(0),[notes,setNotes]=useState('');
 const [lines,setLines]=useState<Line[]>([{...emptyLine}]);
 async function load(){const s=supabase();const [{data:i},{data:c},{data:p}]=await Promise.all([
   s.from('sales_invoices').select('id,invoice_no,invoice_date,jalali_date,status,subtotal,discount,freight,total,customer:parties(display_name)').order('invoice_no',{ascending:false}).limit(200),
   s.from('parties').select('id,display_name').in('party_type',['customer','both']).eq('active',true).order('display_name'),
   s.from('products').select('id,name,sku,sale_price,unit').eq('active',true).order('name')
 ]);setRows(i||[]);setCustomers(c||[]);setProducts(p||[])}
 useEffect(()=>{load()},[]);
 function reset(){setCustomerId('');setJalali(todayJalali());setDiscount(0);setFreight(0);setNotes('');setLines([{...emptyLine}]);setMsg('')}
 function chooseProduct(idx:number,id:string){const p=products.find(x=>x.id===id);setLines(v=>v.map((x,i)=>i===idx?{...x,product_id:id,description:p?.name||'',unit_price:Number(p?.sale_price||0)}:x))}
 function patchLine(idx:number,k:keyof Line,v:any){setLines(a=>a.map((x,i)=>i===idx?{...x,[k]:v}:x))}
 const subtotal=useMemo(()=>lines.reduce((s,l)=>s+Math.max(0,Number(l.quantity||0)*Number(l.unit_price||0)-Number(l.discount||0)),0),[lines]);
 const total=Math.max(0,subtotal-Number(discount||0)+Number(freight||0));
 async function save(){
   if(!customerId){setMsg('مشتری را انتخاب کنید.');return}
   const date=fromJalali(jalali);if(!date){setMsg('تاریخ شمسی معتبر وارد کنید؛ مثال 1405/06/18');return}
   const valid=lines.filter(l=>l.description.trim()&&Number(l.quantity)>0);
   if(!valid.length){setMsg('حداقل یک قلم کالا وارد کنید.');return}
   setBusy(true);setMsg('');const s=supabase();
   const {data:u}=await s.auth.getUser();
   const {data:inv,error}=await s.from('sales_invoices').insert({customer_id:customerId,invoice_date:date,jalali_date:jalali,status:'confirmed',subtotal,discount:Number(discount||0),freight:Number(freight||0),total,notes:notes||null,created_by:u.user?.id||null}).select('id,invoice_no').single();
   if(error||!inv){setMsg('خطا در ثبت فاکتور: '+(error?.message||''));setBusy(false);return}
   const payload=valid.map(l=>({invoice_id:inv.id,product_id:l.product_id||null,description:l.description,quantity:Number(l.quantity),unit_price:Number(l.unit_price),discount:Number(l.discount||0)}));
   const {error:e2}=await s.from('sales_invoice_items').insert(payload);
   if(e2){await s.from('sales_invoices').delete().eq('id',inv.id);setMsg('خطا در ثبت اقلام فاکتور: '+e2.message);setBusy(false);return}
   setBusy(false);setOpen(false);reset();await load();
 }
 async function remove(id:string){if(!confirm('این فاکتور حذف شود؟'))return;const s=supabase();await s.from('sales_invoice_items').delete().eq('invoice_id',id);const {error}=await s.from('sales_invoices').delete().eq('id',id);if(error)alert(error.message);else load()}
 return <>
  <div className="title"><div><h1>فروش و فاکتور</h1><p>ثبت فاکتورهای جدید از این تاریخ به بعد</p></div><div style={{display:'flex',gap:8,alignItems:'center'}}><span className="badge">{rows.length} فاکتور</span><button className="btn" onClick={()=>{reset();setOpen(true)}}>+ فاکتور جدید</button></div></div>
  <div className="card" style={{marginBottom:14}}><b>جمع فروش ثبت‌شده: {money(rows.reduce((s,r)=>s+Number(r.total||0),0))} تومان</b></div>
  <div style={{overflow:'auto'}}><table className="table"><thead><tr><th>شماره</th><th>تاریخ</th><th>مشتری</th><th>جمع کالا</th><th>تخفیف</th><th>کرایه</th><th>مبلغ نهایی</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{rows.length?rows.map((r:any)=><tr key={r.id}><td>{r.invoice_no}</td><td>{r.jalali_date||toJalali(r.invoice_date)}</td><td>{r.customer?.display_name||'-'}</td><td>{money(r.subtotal)}</td><td>{money(r.discount)}</td><td>{money(r.freight)}</td><td><b>{money(r.total)}</b></td><td>{r.status==='confirmed'?'تأیید شده':r.status}</td><td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><Link className="btn" style={{padding:'6px 9px',textDecoration:'none'}} href={`/invoices/${r.id}/print`} target="_blank">پرینت</Link><button className="btn" style={{background:'#7b2d24',padding:'6px 9px'}} onClick={()=>remove(r.id)}>حذف</button></div></td></tr>):<tr><td colSpan={9} style={{textAlign:'center',padding:30}}>هنوز فاکتوری ثبت نشده است.</td></tr>}</tbody></table></div>
  <FormModal open={open} title="ثبت فاکتور فروش" onClose={()=>setOpen(false)}>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
    <div className="field"><label>مشتری *</label><select className="input" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">انتخاب مشتری</option>{customers.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select>{!customers.length&&<small>ابتدا از بخش مشتریان، مشتری جدید ثبت کنید.</small>}</div>
    <div className="field"><label>تاریخ شمسی</label><input className="input" placeholder="مثلاً 1405/06/18" value={jalali} onChange={e=>setJalali(e.target.value)}/></div>
   </div>
   <div className="section"><b>اقلام فاکتور</b>{lines.map((l,i)=><div key={i} className="card" style={{marginTop:8,background:'#faf8f2'}}>
    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8}}><select className="input" value={l.product_id} onChange={e=>chooseProduct(i,e.target.value)}><option value="">انتخاب محصول / ورود دستی</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.sku?' - '+p.sku:''}</option>)}</select><button className="btn" style={{background:'#7b2d24'}} disabled={lines.length===1} onClick={()=>setLines(v=>v.filter((_,x)=>x!==i))}>حذف قلم</button></div>
    <input className="input" style={{marginTop:8}} placeholder="شرح کالا *" value={l.description} onChange={e=>patchLine(i,'description',e.target.value)}/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:8}}><div><small>تعداد</small><input className="input" type="number" min="0.01" step="0.01" value={l.quantity} onChange={e=>patchLine(i,'quantity',Number(e.target.value))}/></div><div><small>قیمت واحد</small><input className="input" type="number" min="0" value={l.unit_price} onChange={e=>patchLine(i,'unit_price',Number(e.target.value))}/></div><div><small>تخفیف قلم</small><input className="input" type="number" min="0" value={l.discount} onChange={e=>patchLine(i,'discount',Number(e.target.value))}/></div></div>
    <div style={{marginTop:8}}>جمع قلم: <b>{money(Math.max(0,l.quantity*l.unit_price-l.discount))}</b> تومان</div>
   </div>)}<button className="btn" style={{marginTop:8,background:'#333'}} onClick={()=>setLines(v=>[...v,{...emptyLine}])}>+ افزودن قلم</button></div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}><div className="field"><label>تخفیف کل</label><input className="input" type="number" min="0" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></div><div className="field"><label>کرایه</label><input className="input" type="number" min="0" value={freight} onChange={e=>setFreight(Number(e.target.value))}/></div></div>
   <div className="field"><label>توضیحات</label><textarea className="input" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
   <div className="card" style={{marginTop:12}}><div>جمع کالا: {money(subtotal)}</div><div>تخفیف کل: {money(discount)}</div><div>کرایه: {money(freight)}</div><div style={{fontSize:20,fontWeight:800,marginTop:8}}>مبلغ نهایی: {money(total)} تومان</div></div>
   {msg&&<div className="msg">{msg}</div>}<button className="btn" style={{width:'100%',marginTop:12}} disabled={busy} onClick={save}>{busy?'در حال ثبت...':'ثبت نهایی فاکتور'}</button>
  </FormModal>
 </>
}
