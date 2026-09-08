'use client';
import {useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));
const jalali=(value?:string|null)=>{
 if(!value)return '-';
 if(/^1[34]\d{2}\/\d{1,2}\/\d{1,2}$/.test(value))return value;
 const d=new Date(value.length===10?value+'T12:00:00':value);
 if(Number.isNaN(d.getTime()))return value;
 const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const get=(t:string)=>p.find(x=>x.type===t)?.value||'';
 return `${get('year')}/${get('month')}/${get('day')}`;
};
export default function PrintInvoice(){
 const {id}=useParams<{id:string}>();
 const r=useRouter();
 const [inv,setInv]=useState<any>(null),[items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true),[err,setErr]=useState('');
 useEffect(()=>{(async()=>{const s=supabase();const [{data:i,error:e1},{data:it,error:e2}]=await Promise.all([
  s.from('sales_invoices').select('id,invoice_no,invoice_date,jalali_date,status,subtotal,discount,freight,total,notes,customer:parties(display_name,phone,address,city)').eq('id',id).single(),
  s.from('sales_invoice_items').select('id,description,quantity,unit_price,discount,line_total').eq('invoice_id',id).order('id')
 ]);if(e1||!i){setErr('فاکتور پیدا نشد.');setLoading(false);return}if(e2){setErr(e2.message);setLoading(false);return}setInv(i);setItems(it||[]);setLoading(false)})()},[id]);
 if(loading)return <div style={{padding:30,fontFamily:'Tahoma'}}>در حال بارگذاری فاکتور...</div>;
 if(err)return <div style={{padding:30,fontFamily:'Tahoma'}}>{err}</div>;
 const c=inv.customer||{};
 return <div dir="rtl" style={{background:'#fff',minHeight:'100vh',color:'#111',fontFamily:'Tahoma,Arial,sans-serif'}}>
  <style>{`@page{size:A4;margin:12mm} @media print{.no-print{display:none!important} body{background:#fff!important} .sheet{box-shadow:none!important;margin:0!important;max-width:none!important;border:none!important}}`}</style>
  <div className="no-print" style={{maxWidth:900,margin:'16px auto 0',display:'flex',gap:8,justifyContent:'flex-start',padding:'0 12px'}}><button onClick={()=>window.print()} style={{border:0,borderRadius:8,padding:'10px 16px',background:'#b98a29',color:'#fff',cursor:'pointer'}}>چاپ فاکتور</button><button onClick={()=>r.back()} style={{border:0,borderRadius:8,padding:'10px 16px',background:'#333',color:'#fff',cursor:'pointer'}}>بازگشت</button></div>
  <div className="sheet" style={{maxWidth:900,margin:'12px auto 30px',border:'1px solid #ccc',padding:24,boxSizing:'border-box'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:20,borderBottom:'2px solid #222',paddingBottom:14}}>
    <div><div style={{fontSize:24,fontWeight:800}}>صنایع سنگ الماس</div><div style={{marginTop:4,fontSize:13}}>ALMAS STONE</div></div>
    <div style={{textAlign:'left',lineHeight:1.9}}><div><b>فاکتور فروش</b></div><div>شماره: {inv.invoice_no}</div><div>تاریخ: {inv.jalali_date||jalali(inv.invoice_date)}</div></div>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16,fontSize:14}}><div><b>خریدار:</b> {c.display_name||'-'}</div><div><b>موبایل:</b> {c.phone||'-'}</div><div style={{gridColumn:'1 / -1'}}><b>آدرس:</b> {[c.city,c.address].filter(Boolean).join('، ')||'-'}</div></div>
   <table style={{width:'100%',borderCollapse:'collapse',marginTop:18,fontSize:13}}><thead><tr>{['ردیف','شرح کالا','تعداد','قیمت واحد','تخفیف','جمع'].map(x=><th key={x} style={{border:'1px solid #999',padding:8,background:'#f1f1f1'}}>{x}</th>)}</tr></thead><tbody>{items.map((x,i)=><tr key={x.id}><td style={{border:'1px solid #bbb',padding:8,textAlign:'center'}}>{i+1}</td><td style={{border:'1px solid #bbb',padding:8}}>{x.description}</td><td style={{border:'1px solid #bbb',padding:8,textAlign:'center'}}>{money(x.quantity)}</td><td style={{border:'1px solid #bbb',padding:8,textAlign:'center'}}>{money(x.unit_price)}</td><td style={{border:'1px solid #bbb',padding:8,textAlign:'center'}}>{money(x.discount)}</td><td style={{border:'1px solid #bbb',padding:8,textAlign:'center',fontWeight:700}}>{money(x.line_total)}</td></tr>)}</tbody></table>
   <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:18,marginTop:18,alignItems:'start'}}><div>{inv.notes&&<div style={{border:'1px solid #ccc',padding:12,minHeight:70}}><b>توضیحات:</b><div style={{marginTop:8}}>{inv.notes}</div></div>}</div><div style={{border:'1px solid #bbb'}}>{[['جمع کالا',inv.subtotal],['تخفیف کل',inv.discount],['کرایه',inv.freight]].map(([k,v]:any)=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'9px 12px',borderBottom:'1px solid #ddd'}}><span>{k}</span><span>{money(v)} تومان</span></div>)}<div style={{display:'flex',justifyContent:'space-between',padding:'12px',fontSize:17,fontWeight:800,background:'#f7f1e3'}}><span>مبلغ نهایی</span><span>{money(inv.total)} تومان</span></div></div></div>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,marginTop:50,textAlign:'center'}}><div>مهر و امضای فروشنده</div><div>امضای خریدار</div></div>
  </div>
 </div>
}
