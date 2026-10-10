'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {todayJalali} from '@/lib/jalali';
const fmt=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0))+' تومان';

export default function Dashboard(){
 const[d,setD]=useState<any>({}),[msg,setMsg]=useState('');const r=useRouter();
 useEffect(()=>{(async()=>{const s=supabase();const{data:{session}}=await s.auth.getSession();if(!session){r.replace('/login');return}
  const today=todayJalali();
  const[p,c,i,e,ch,emp,tr,prod,ps,ms,orders]=await Promise.all([
   s.from('products').select('*',{count:'exact',head:true}).eq('active',true),
   s.from('parties').select('*',{count:'exact',head:true}).in('party_type',['customer','both']).eq('active',true),
   s.from('sales_invoices').select('total,paid_amount,returned_amount,status,jalali_date'),
   s.from('expenses').select('amount,jalali_date'),
   s.from('checks').select('amount,direction,status,due_jalali'),
   s.from('employees').select('*',{count:'exact',head:true}).eq('active',true),
   s.from('financial_transactions').select('amount,direction,jalali_date'),
   s.from('production_batches').select('quantity,waste_quantity,jalali_date'),
   s.from('v_product_stock').select('available_stock,min_stock'),
   s.from('v_material_stock').select('stock,min_stock'),
   s.from('orders').select('id,status')
  ]);
  if(i.error){setMsg('اتصال به دیتابیس برقرار نیست یا پروژه نیاز به فعال‌سازی دارد.');return}
  const invoices=(i.data||[]).filter((x:any)=>x.status!=='cancelled');
  const netSales=invoices.reduce((a:number,b:any)=>a+Number(b.total||0)-Number(b.returned_amount||0),0);
  const receivables=invoices.reduce((a:number,b:any)=>a+Math.max(0,Number(b.total||0)-Number(b.returned_amount||0)-Number(b.paid_amount||0)),0);
  const todaySales=invoices.filter((x:any)=>x.jalali_date===today).reduce((a:number,b:any)=>a+Number(b.total||0)-Number(b.returned_amount||0),0);
  const incoming=(ch.data||[]).filter((x:any)=>x.direction==='receivable'&&!['collected','given_back','cancelled'].includes(x.status)).reduce((a:number,b:any)=>a+Number(b.amount||0),0);
  const receipts=(tr.data||[]).filter((x:any)=>x.direction==='receipt').reduce((a:number,b:any)=>a+Number(b.amount||0),0);
  const produced=(prod.data||[]).reduce((a:number,b:any)=>a+Number(b.quantity||0),0);
  setD({products:p.count||0,customers:c.count||0,sales:netSales,todaySales,expenses:(e.data||[]).reduce((a:number,b:any)=>a+Number(b.amount||0),0),incoming,employees:emp.count||0,receipts,produced,receivables,lowProducts:(ps.data||[]).filter((x:any)=>Number(x.available_stock)<=Number(x.min_stock)).length,lowMaterials:(ms.data||[]).filter((x:any)=>Number(x.stock)<=Number(x.min_stock)).length,openOrders:(orders.data||[]).filter((x:any)=>!['delivered','cancelled'].includes(x.status)).length});
 })()},[r]);
 return <><div className="title"><div><h1>داشبورد مدیریتی</h1><p>نمای زنده فروش، مالی، انبار و تولید صنایع سنگ الماس</p></div><div style={{display:'flex',gap:8}}><Link className="btn" href="/pos">فروش سریع</Link><Link className="btn secondary" href="/reports">گزارش‌ها</Link></div></div>
 {msg&&<div className="msg">{msg}</div>}
 <div className="grid">{[
  ['فروش امروز',fmt(d.todaySales)],['فروش خالص',fmt(d.sales)],['مطالبات باز',fmt(d.receivables)],['چک‌های دریافتی باز',fmt(d.incoming)],
  ['سفارش باز',d.openOrders||0],['محصول زیر حداقل',d.lowProducts||0],['ماده زیر حداقل',d.lowMaterials||0],['تولید ثبت‌شده',new Intl.NumberFormat('fa-IR').format(d.produced||0)],
  ['محصولات فعال',d.products||0],['مشتریان فعال',d.customers||0],['نیروی فعال',d.employees||0],['هزینه ثبت‌شده',fmt(d.expenses)]
 ].map(([k,v])=><div className="card" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
 <div className="card section"><b>دسترسی سریع</b><div className="toolbar" style={{marginTop:10}}><Link className="btn" href="/pos">فروش POS</Link><Link className="btn secondary" href="/purchases">خرید</Link><Link className="btn secondary" href="/inventory">انبار</Link><Link className="btn secondary" href="/returns">مرجوعی</Link><Link className="btn secondary" href="/cash">صندوق</Link><Link className="btn secondary" href="/orders">سفارش و ارسال</Link></div></div></>
}
