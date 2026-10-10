import {createBrowserClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';

export const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://elyjdckzkvphnlpujqea.supabase.co';
export const supabasePublishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_I1tyDrVaSejXhlkpausVGg_a73pjwer';

export const supabase=()=>createBrowserClient(supabaseUrl,supabasePublishableKey);

export const isolatedSupabase=()=>createClient(supabaseUrl,supabasePublishableKey,{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
