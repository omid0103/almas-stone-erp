import './globals.css';
import AppShell from '@/components/AppShell';
import PwaRegister from '@/components/PwaRegister';

export const metadata={
 title:'Almas Stone ERP',
 description:'سامانه فروش، انبار، مالی و تولید صنایع سنگ الماس',
 manifest:'/manifest.webmanifest',
 themeColor:'#111111',
 appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'Almas ERP'},
 icons:{icon:'/icon.svg',apple:'/icon.svg'}
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="fa" dir="rtl"><body><PwaRegister/><AppShell>{children}</AppShell></body></html>
}
