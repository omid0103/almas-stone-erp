export function toJalali(value?: string | Date | null){
  if(!value) return '-';
  if(typeof value==='string' && /^1[34]\d{2}\/\d{1,2}\/\d{1,2}$/.test(value)) return value;
  const d=value instanceof Date?value:new Date(typeof value==='string'&&value.length===10?value+'T12:00:00':value);
  if(Number.isNaN(d.getTime())) return String(value);
  const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const g=(t:string)=>p.find(x=>x.type===t)?.value||'';
  return `${g('year')}/${g('month')}/${g('day')}`;
}
export function todayJalali(){return toJalali(new Date())}
export function currentJalaliYear(){return Number(todayJalali().split('/')[0])}
export function currentJalaliMonth(){return Number(todayJalali().split('/')[1])}
