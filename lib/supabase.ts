import { createBrowserClient } from '@supabase/ssr';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://elyjdckzkvphnlpujqea.supabase.co';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_I1tyDrVaSejXhlkpausVGg_a73pjwer';
export const supabase=()=>createBrowserClient(url,key);
