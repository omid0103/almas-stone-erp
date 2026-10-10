'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {currentJalaliMonth,currentJalaliYear} from '@/lib/jalali';
const money=(n:any)=>new Intl.NumberFormat('fa-IR').format(Number(n||0));

export default function Reports(){
 const[year,setYear]=useState(currentJalaliYear()),[month,setMonth]=useState(currentJalaliMonth()),[d,setD]=useState<any>({}),[loading,setLoading]=useState(false),[msg,setMsg]=useState('');
 async function load(){setLoading(true);setMsg('');const s=supabase(),prefix=`${year}/${String(month).padStart(2,'0')}/%`;
  const[si,ex,tr,pu,pa,ch,pr,ps,ms,ret]=await Promise.all([
   s.from('sales_invoices').select('id,total,paid_amount,returned_amount,status,jalali_date').like('jalali_date',prefix),
   s.from('expenses').select('amount,jalali_date').like('jalali_date',prefix),
   s.from('financial_transactions').select('amount,direction,jalali_date').like('jalali_date',prefix),
   s.from('purchase_invoices').select('total,jalali_date').like('jalali_date',prefix),
   s.from('payroll_periods').select('net_payable,paid').eq('year',year).eq('month',month),
   s.from('checks').select('amount,direction,status,due_jalali'),
   s.from('production_batches').select('quantity,waste_quantity,jalali_date').like('jalali_date',prefix),
   s.from('v_product_stock').select('product_id,name,available_stock,min_stock'),
   s.from('v_material_stock').select('material_id,name,stock,current_unit_cost,min_stock'),
   s.from('sale_returns').select('id,total,status,jalali_date').like('jalali_date',prefix)
  ]);
  if(si.error){setLoading(false);setMsg(si.error.message);return}
  const invoices=(si.data||[]).filter((x:any)=>x.status!=='cancelled'),ids=invoices.map((x:any)=>x.id),returnRows=(ret.data||[]).filter((x:any)=>x.status!=='cancelled'),returnIds=returnRows.map((x:any)=>x.id);
  let saleItems:any[]=[];if(ids.length){const{data}=await s.from('sales_invoice_items').select('quantity,line_total,product:products(estimated_cost,purchase_price)').in('invoice_id',ids);saleItems=data||[]}
  let returnItems:any[]=[];if(returnIds.length){const{data}=await s.from('sale_return_items').select('quantity,product:products(estimated_cost,purchase_price)').in('return_id',returnIds);returnItems=data||[]}
  const sum=(a:any[],k:string)=>a.reduce((x,y)=>x+Number(y[k]||0),0),tx=tr.data||[],checks=ch.data||[];
  const grossSales=sum(invoices,'total'),returnsTotal=sum(returnRows,'total'),netSales=grossSales-returnsTotal;
  const soldCost=saleItems.reduce((x,y:any)=>x+Number(y.quantity||0)*Number(y.product?.purchase_price||y.product?.estimated_cost||0),0);
  const returnedCost=returnItems.reduce((x,y:any)=>x+Number(y.quantity||0)*Number(y.product?.purchase_price||y.product?.estimated_cost||0),0);
  const cogs=Math.max(0,soldCost-returnedCost),grossProfit=netSales-cogs;
  const openReceivables=(await s.from('sales_invoices').select('total,paid_amount,returned_amount,status').neq('status','cancelled')).data||[];
  setD({
   sales:netSales,grossSales,returns:returnsTotal,cogs,grossProfit,
   expenses:sum(ex.data||[],'amount'),receipts:sum(tx.filter((x:any)=>x.direction==='receipt'),'amount'),payments:sum(tx.filter((x:any)=>x.direction==='payment'),'amount'),
   purchases:sum(pu.data||[],'total'),payroll:sum(pa.data||[],'net_payable'),payrollPaid:sum(pa.data||[],'paid'),
   receivableChecks:sum(checks.filter((x:any)=>x.direction==='receivable'&&!['collected','given_back','cancelled'].includes(x.status)),'amount'),
   payableChecks:sum(checks.filter((x:any)=>x.direction==='payable'&&!['cleared','cancelled'].includes(x.status)),'amount'),
   production:sum(pr.data||[],'quantity'),waste:sum(pr.data||[],'waste_quantity'),
   productStock:sum(ps.data||[],'available_stock'),lowProducts:(ps.data||[]).filter((x:any)=>Number(x.available_stock)<=Number(x.min_stock)).length,
   materialValue:(ms.data||[]).reduce((x:number,y:any)=>x+Number(y.stock||0)*Number(y.current_unit_cost||0),0),lowMaterials:(ms.data||[]).filter((x:any)=>Number(x.stock)<=Number(x.min_stock)).length,
   receivables:openReceivables.reduce((x:number,y:any)=>x+Math.max(0,Number(y.total||0)-Number(y.returned_amount||0)-Number(y.paid_amount||0)),0)
  });setLoading(false)
 }
 useEffect(()=>{load()},[]);
 const cash=(d.receipts||0)-(d.payments||0)-(d.expenses||0);
 const operating=(d.grossProfit||0)-(d.expenses||0)-(d.payroll||0);
 return <><div className="title"><div><h1>گزارش‌ها</h1><p>فروش، سود، مطالبات، چک، تولید و موجودی بر اساس ماه شمسی</p></div></div>
 <div className="card" style={{marginBottom:14}}><div className="toolbar"><div className="field" style={{margin:0}}><label>سال</label><input className="input" type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/></div><div className="field" style={{margin:0}}><label>ماه</label><select className="input" value={month} onChange={e=>setMonth(Number(e.target.value))}>{['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((x,i)=><option key={x} value={i+1}>{x}</option>)}</select></div><button className="btn" onClick={load}>{loading?'در حال محاسبه…':'نمایش گزارش'}</button></div></div>
 {msg&&<div className="msg">{msg}</div>}
 <div className="grid">{[
  ['فروش ناخالص',money(d.grossSales)],['مرجوعی فروش',money(d.returns)],['فروش خالص',money(d.sales)],['بهای کالای فروش‌رفته',money(d.cogs)],
  ['سود ناخالص تقریبی',money(d.grossProfit)],['هزینه‌ها',money(d.expenses)],['حقوق پرداختنی',money(d.payroll)],['نتیجه عملیاتی تقریبی',money(operating)],
  ['دریافت',money(d.receipts)],['پرداخت',money(d.payments)],['خالص جریان نقدی',money(cash)],['مطالبات باز کل',money(d.receivables)],
  ['خرید ماه',money(d.purchases)],['چک دریافتی باز',money(d.receivableChecks)],['چک پرداختی باز',money(d.payableChecks)],['ارزش مواد اولیه',money(d.materialValue)],
  ['تولید ماه',money(d.production)],['ضایعات ماه',money(d.waste)],['محصول زیر حداقل',d.lowProducts||0],['ماده زیر حداقل',d.lowMaterials||0]
 ].map(([k,v])=><div className="card" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div>
 <div className="card section"><b>تفسیر گزارش</b><p className="muted">سود ناخالص بر پایه قیمت خرید/بهای تمام‌شده ثبت‌شده برای محصولات محاسبه می‌شود. برای گزارش دقیق، قیمت خرید کالاها و تمام دریافت/پرداخت‌های مرتبط با فاکتورها را ثبت کنید.</p></div></>
}
