'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

const nav=[
  {h:'/',l:'داشبورد',roles:['owner','admin','accountant','sales','workshop']},
  {h:'/pos',l:'فروش سریع / POS',roles:['owner','admin','accountant','sales']},
  {h:'/customers',l:'مشتریان',roles:['owner','admin','accountant','sales']},
  {h:'/products',l:'محصولات',roles:['owner','admin','accountant','sales','workshop']},
  {h:'/invoices',l:'فروش و فاکتور',roles:['owner','admin','accountant','sales']},
  {h:'/returns',l:'مرجوعی فروش',roles:['owner','admin','accountant','sales']},
  {h:'/orders',l:'سفارش و ارسال',roles:['owner','admin','sales','workshop']},
  {h:'/cash',l:'صندوق و کارتخوان',roles:['owner','admin','accountant','sales']},
  {h:'/receipts',l:'دریافت و پرداخت',roles:['owner','admin','accountant']},
  {h:'/checks',l:'چک‌ها',roles:['owner','admin','accountant']},
  {h:'/expenses',l:'هزینه‌ها',roles:['owner','admin','accountant']},
  {h:'/purchases',l:'خرید',roles:['owner','admin','accountant','workshop']},
  {h:'/inventory',l:'انبار',roles:['owner','admin','workshop']},
  {h:'/production',l:'تولید و BOM',roles:['owner','admin','workshop']},
  {h:'/employees',l:'کارکنان و حقوق',roles:['owner','admin','accountant']},
  {h:'/ledger',l:'حساب طرف‌ها',roles:['owner','admin','accountant']},
  {h:'/reports',l:'گزارش‌ها',roles:['owner','admin','accountant']},
  {h:'/users',l:'کاربران و دسترسی',roles:['owner','admin']},
  {h:'/audit',l:'لاگ تغییرات',roles:['owner','admin']},
  {h:'/backup',l:'پشتیبان و خروجی',roles:['owner','admin']},
  {h:'/settings',l:'تنظیمات',roles:['owner','admin']}
];
const roleFa:any={owner:'مالک',admin:'مدیر',accountant:'حسابدار',sales:'فروش',workshop:'کارگاه'};

export default function AppShell({children}:{children:React.ReactNode}){
 const p=usePathname();const r=useRouter();
 const publicRoute=p==='/login'||p==='/update-password'||p==='/offline'||(p.startsWith('/invoices/')&&p.endsWith('/print'));
 const [ready,setReady]=useState(publicRoute),[drawer,setDrawer]=useState(false),[role,setRole]=useState(''),[name,setName]=useState('');
 useEffect(()=>{
  if(publicRoute){setReady(true);return}
  const s=supabase();let live=true;
  (async()=>{
   const {data:{session}}=await s.auth.getSession();
   if(!live)return;
   if(!session){r.replace('/login');return}
   const {data:profile}=await s.from('profiles').select('full_name,role,active').eq('id',session.user.id).maybeSingle();
   if(profile?.active===false){await s.auth.signOut();r.replace('/login');return}
   setRole(profile?.role||'sales');setName(profile?.full_name||session.user.email||'');setReady(true);
  })();
  const {data:{subscription}}=s.auth.onAuthStateChange((_e,session)=>{if(!session)r.replace('/login')});
  return()=>{live=false;subscription.unsubscribe()}
 },[p,publicRoute,r]);
 useEffect(()=>setDrawer(false),[p]);
 const visible=useMemo(()=>nav.filter(x=>!role||x.roles.includes(role)),[role]);
 if(publicRoute)return <>{children}</>;
 if(!ready)return <div className="boot"><div className="spinner"/><span>در حال ورود به سامانه…</span></div>;
 async function logout(){await supabase().auth.signOut();r.replace('/login')}
 return <div className="shell">
   <div className={drawer?'nav-overlay show':'nav-overlay'} onClick={()=>setDrawer(false)}/>
   <aside className={drawer?'side open':'side'}>
     <div className="brand"><b>ALMAS STONE ERP</b><small>صنایع سنگ الماس</small></div>
     <nav className="nav">{visible.map(x=><Link key={x.h} href={x.h} style={{background:p===x.h?'#2b2415':'transparent',color:p===x.h?'#f2cc72':'inherit'}}>{x.l}</Link>)}</nav>
     <div className="side-user"><b>{name||'کاربر'}</b><small>{roleFa[role]||role}</small></div>
   </aside>
   <main className="main">
     <header className="top">
       <div style={{display:'flex',alignItems:'center',gap:10}}><button className="menu-btn" onClick={()=>setDrawer(true)}>☰</button><b>مدیریت یکپارچه الماس</b></div>
       <div className="top-actions"><span className="badge">{roleFa[role]||'V2'}</span><button className="btn secondary compact" onClick={logout}>خروج</button></div>
     </header>
     <div className="content">{children}</div>
     <nav className="mobile-bottom">
       <Link className={p==='/'?'active':''} href="/">خانه</Link>
       <Link className={p==='/pos'?'active':''} href="/pos">فروش</Link>
       <Link className={p==='/invoices'?'active':''} href="/invoices">فاکتور</Link>
       <Link className={p==='/inventory'?'active':''} href="/inventory">انبار</Link>
       <button onClick={()=>setDrawer(true)}>منو</button>
     </nav>
   </main>
 </div>
}
