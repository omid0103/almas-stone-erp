const persianParts=(d:Date)=>{
  const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d);
  const g=(t:string)=>Number(p.find(x=>x.type===t)?.value||0);
  return [g('year'),g('month'),g('day')] as const;
};
const cmp=(a:readonly number[],b:readonly number[])=>{for(let i=0;i<3;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1}return 0};
export function toJalali(value?: string | Date | null){
  if(!value) return '-';
  if(typeof value==='string' && /^1[34]\d{2}\/\d{1,2}\/\d{1,2}$/.test(value)) return value;
  const d=value instanceof Date?value:new Date(typeof value==='string'&&value.length===10?value+'T12:00:00':value);
  if(Number.isNaN(d.getTime())) return String(value);
  const [y,m,day]=persianParts(d);
  return `${y}/${String(m).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
}
export function fromJalali(value?:string|null){
  if(!value)return null;
  const m=value.trim().match(/^(1[34]\d{2})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if(!m)return null;
  const target=[Number(m[1]),Number(m[2]),Number(m[3])] as const;
  if(target[1]<1||target[1]>12||target[2]<1||target[2]>31)return null;
  let lo=Date.UTC(target[0]+620,0,1,12),hi=Date.UTC(target[0]+622,11,31,12),found:number|null=null;
  while(lo<=hi){const mid=lo+Math.floor((hi-lo)/(2*86400000))*86400000;const c=cmp(persianParts(new Date(mid)),target);if(c===0){found=mid;break}if(c<0)lo=mid+86400000;else hi=mid-86400000}
  if(found===null)return null;
  const d=new Date(found);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
export function todayJalali(){return toJalali(new Date())}
export function currentJalaliYear(){return Number(todayJalali().split('/')[0])}
export function currentJalaliMonth(){return Number(todayJalali().split('/')[1])}
