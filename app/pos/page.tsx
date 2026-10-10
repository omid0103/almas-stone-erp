'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {fromJalali,todayJalali} from '@/lib/jalali';

const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));
type CartLine={product_id:string;name:string;quantity:number;unit_price:number;discount:number;stock:number;track_stock:boolean;unit:string};
const priceOf=(p:any,tier:string)=>Number(tier==='wholesale'?p.wholesale_price:tier==='colleague'?p.colleague_price:p.sale_price)||Number(p.sale_price||0);

export default function Pos(){
 const[products,setProducts]=useState<any[]>([]),[customers,setCustomers]=useState<any[]>([]),[cart,setCart]=useState<CartLine[]>([]);
 const[q,setQ]=useState(''),[customerId,setCustomerId]=useState(''),[tier,setTier]=useState('retail'),[jalali,setJalali]=useState(todayJalali());
 const[discount,setDiscount]=useState(0),[paid,setPaid]=useState(0),[method,setMethod]=useState('pos'),[notes,setNotes]=useState('');
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[lastInvoice,setLastInvoice]=useState<any>(null),[sessionId,setSessionId]=useState<string|null>(null);
 const scanRef=useRef<HTMLInputElement>(null);
 async function load(){
  const s=supabase();
  const[{data:p,error:pe},{data:st},{data:c},{data:cs}]=await Promise.all([
   s.from('products').select('id,name,sku,barcode,unit,sale_price,wholesale_price,colleague_price,track_stock,active').eq('active',true).order('name'),
   s.from('v_product_stock').select('product_id,available_stock'),
   s.from('parties').select('id,display_name,customer_kind,phone').in('party_type',['customer','both']).eq('active',true).order('display_name'),
   s.from('cash_sessions').select('id').eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  if(pe){setMsg('ساختار فروش سریع هنوز روی دیتابیس فعال نشده است. پس از اجرای ارتقای V2 دوباره تلاش کنید.');return}
  const sm=new Map((st||[]).map((x:any)=>[x.product_id,Number(x.available_stock||0)]));
  setProducts((p||[]).map((x:any)=>({...x,stock:sm.get(x.id)||0})));setCustomers(c||[]);setSessionId(cs?.id||null);
 }
 useEffect(()=>{load();setTimeout(()=>scanRef.current?.focus(),250)},[]);
 const filtered=useMemo(()=>{const s=q.trim().toLowerCase();if(!s)return products.slice(0,40);return products.filter(p=>[p.name,p.sku,p.barcode].some(v=>String(v||'').toLowerCase().includes(s))).slice(0,60)},[products,q]);
 const subtotal=useMemo(()=>cart.reduce((a,x)=>a+Math.max(0,x.quantity*x.unit_price-x.discount),0),[cart]);
 const total=Math.max(0,subtotal-Number(discount||0));const balance=Math.max(0,total-Number(paid||0));
 function selectCustomer(id:string){setCustomerId(id);const c=customers.find(x=>x.id===id);const t=c?.customer_kind||'retail';setTier(t);setCart(v=>v.map(x=>{const p=products.find(y=>y.id===x.product_id);return {...x,unit_price:p?priceOf(p,t):x.unit_price}}))}
 function add(p:any){setMsg('');setCart(v=>{const i=v.findIndex(x=>x.product_id===p.id);if(i>=0)return v.map((x,n)=>n===i?{...x,quantity:x.quantity+1}:x);return [...v,{product_id:p.id,name:p.name,quantity:1,unit_price:priceOf(p,tier),discount:0,stock:Number(p.stock||0),track_stock:p.track_stock!==false,unit:p.unit||'عدد'}]})}
 function scan(e:React.KeyboardEvent<HTMLInputElement>){if(e.key!=='Enter')return;const s=q.trim();if(!s)return;const p=products.find(x=>String(x.barcode||'')===s||String(x.sku||'')===s);if(p){add(p);setQ('');setTimeout(()=>scanRef.current?.focus(),50)}else setMsg('کالایی با این بارکد/کد پیدا نشد.')}
 function patch(id:string,k:keyof CartLine,v:any){setCart(a=>a.map(x=>x.product_id===id?{...x,[k]:v}:x))}
 async function save(){
  if(!customerId){setMsg('مشتری را انتخاب کنید.');return}
  if(!cart.length){setMsg('سبد فروش خالی است.');return}
  const date=fromJalali(jalali);if(!date){setMsg('تاریخ شمسی معتبر نیست.');return}
  for(const x of cart){if(x.quantity<=0){setMsg('تعداد کالا باید بیشتر از صفر باشد.');return}if(x.track_stock&&x.quantity>x.stock){setMsg(`موجودی «${x.name}» کافی نیست.`);return}}
  if(Number(paid||0)>total){setMsg('مبلغ پرداختی نمی‌تواند بیشتر از مبلغ فاکتور باشد.');return}
  setBusy(true);setMsg('');setLastInvoice(null);const s=supabase();const{data:u}=await s.auth.getUser();
  const pay=Number(paid||0),paymentStatus=pay<=0?'unpaid':pay>=total?'paid':'partial';
  const{data:inv,error}=await s.from('sales_invoices').insert({customer_id:customerId,invoice_date:date,jalali_date:jalali,status:'confirmed',channel:'pos',subtotal,discount:Number(discount||0),freight:0,total,paid_amount:pay,payment_status:paymentStatus,notes:notes||null,created_by:u.user?.id||null}).select('id,invoice_no').single();
  if(error||!inv){setBusy(false);setMsg('خطا در ثبت فروش: '+(error?.message||''));return}
  const{error:itemError}=await s.from('sales_invoice_items').insert(cart.map(x=>({invoice_id:inv.id,product_id:x.product_id,description:x.name,quantity:x.quantity,unit_price:x.unit_price,discount:x.discount})));
  if(itemError){await s.from('sales_invoices').delete().eq('id',inv.id);setBusy(false);setMsg('خطا در ثبت اقلام: '+itemError.message);return}
  let paymentWarning='';
  if(pay>0&&method!=='credit'){
   const{error:txe}=await s.from('financial_transactions').insert({direction:'receipt',method,amount:pay,transaction_date:date,jalali_date:jalali,description:`دریافت بابت فاکتور فروش #${inv.invoice_no}`,party_id:customerId,invoice_id:inv.id,cash_session_id:sessionId,created_by:u.user?.id||null});
   if(txe){paymentWarning=' فاکتور ثبت شد اما ثبت دریافت مالی ناموفق بود؛ از «دریافت و پرداخت» اصلاح کنید.';await s.from('sales_invoices').update({paid_amount:0,payment_status:'unpaid'}).eq('id',inv.id)}
  }
  setBusy(false);setLastInvoice(inv);setMsg('فروش ثبت شد.'+paymentWarning);setCart([]);setDiscount(0);setPaid(0);setNotes('');await load();
 }
 function setFullPayment(){setPaid(total)}
 return <><div className="title"><div><h1>فروش سریع / POS</h1><p>جستجو یا اسکن بارکد، صدور فاکتور و ثبت پرداخت در یک مرحله</p></div><div style={{display:'flex',gap:8}}>{sessionId?<span className="pill">صندوق باز</span>:<span className="pill warn">صندوق باز نیست</span>}<Link className="btn secondary" href="/cash">صندوق</Link></div></div>
 <div className="pos-layout">
  <div>
   <div className="card"><div className="two-col"><div className="field" style={{margin:0}}><label>بارکد / کد / نام کالا</label><input ref={scanRef} className="input" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={scan} placeholder="بارکد را اسکن کنید یا نام کالا را بنویسید"/></div><div className="field" style={{margin:0}}><label>مشتری *</label><select className="input" value={customerId} onChange={e=>selectCustomer(e.target.value)}><option value="">انتخاب مشتری</option>{customers.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></div></div></div>
   <div className="pos-products section">{filtered.map(p=><button type="button" className={Number(p.stock)<=0&&p.track_stock!==false?'product-tile low':'product-tile'} key={p.id} onClick={()=>add(p)}><b>{p.name}</b><div className="muted" style={{fontSize:11,marginTop:5}}>{p.sku||p.barcode||'بدون کد'} · موجودی {money(p.stock)} {p.unit}</div><div style={{fontWeight:800,marginTop:8}}>{money(priceOf(p,tier))} تومان</div></button>)}</div>
  </div>
  <div className="cart card">
   <h3 style={{marginTop:0}}>سبد فروش</h3>
   {!cart.length?<p className="muted">کالا را انتخاب یا بارکد را اسکن کنید.</p>:cart.map(x=><div key={x.product_id} style={{borderBottom:'1px solid #eee',padding:'10px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{x.name}</b><button className="btn danger compact" onClick={()=>setCart(v=>v.filter(y=>y.product_id!==x.product_id))}>حذف</button></div><div className="three-col"><div className="field"><label>تعداد</label><input className="input" type="number" min="0.01" step="0.01" value={x.quantity} onChange={e=>patch(x.product_id,'quantity',Number(e.target.value))}/></div><div className="field"><label>قیمت</label><input className="input" type="number" min="0" value={x.unit_price} onChange={e=>patch(x.product_id,'unit_price',Number(e.target.value))}/></div><div className="field"><label>تخفیف</label><input className="input" type="number" min="0" value={x.discount} onChange={e=>patch(x.product_id,'discount',Number(e.target.value))}/></div></div><small className="muted">جمع: {money(Math.max(0,x.quantity*x.unit_price-x.discount))} تومان</small></div>)}
   <div className="two-col"><div className="field"><label>تخفیف کل</label><input className="input" type="number" min="0" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></div><div className="field"><label>تاریخ شمسی</label><input className="input" value={jalali} onChange={e=>setJalali(e.target.value)}/></div></div>
   <div className="two-col"><div className="field"><label>روش پرداخت</label><select className="input" value={method} onChange={e=>setMethod(e.target.value)}><option value="pos">کارتخوان</option><option value="cash">نقد</option><option value="card_to_card">کارت به کارت</option><option value="bank">بانکی</option><option value="check">چک</option><option value="credit">نسیه</option></select></div><div className="field"><label>مبلغ پرداختی</label><input className="input" type="number" min="0" value={paid} onChange={e=>setPaid(Number(e.target.value))}/><button className="btn secondary compact" style={{marginTop:6}} onClick={setFullPayment}>تسویه کامل</button></div></div>
   <div className="field"><label>توضیحات</label><textarea className="input" rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
   <div className="summary-row"><span>جمع کالا</span><b>{money(subtotal)}</b></div><div className="summary-row"><span>تخفیف</span><b>{money(discount)}</b></div><div className="summary-row total"><span>قابل پرداخت</span><span>{money(total)} تومان</span></div><div className="summary-row"><span>مانده</span><b>{money(balance)} تومان</b></div>
   {msg&&<div className={msg.startsWith('فروش ثبت شد')?'success':'msg'}>{msg}</div>}
   {lastInvoice&&<Link className="btn secondary" style={{display:'block',textAlign:'center',marginTop:8}} target="_blank" href={`/invoices/${lastInvoice.id}/print`}>چاپ فاکتور #{lastInvoice.invoice_no}</Link>}
   <button className="btn" style={{width:'100%',marginTop:10,fontSize:16}} disabled={busy||!cart.length} onClick={save}>{busy?'در حال ثبت…':'ثبت فروش'}</button>
  </div>
 </div></>
}
