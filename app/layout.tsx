import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata={title:'Almas Stone ERP',description:'سامانه مدیریت یکپارچه صنایع سنگ الماس'};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="fa" dir="rtl"><body><AppShell>{children}</AppShell></body></html>
}
