import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return{
 name:'Almas Stone ERP',
 short_name:'Almas ERP',
 description:'سامانه فروش، انبار، مالی و تولید صنایع سنگ الماس',
 start_url:'/',
 display:'standalone',
 background_color:'#111111',
 theme_color:'#111111',
 orientation:'portrait-primary',
 lang:'fa',
 dir:'rtl',
 icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'maskable'}]
}}
