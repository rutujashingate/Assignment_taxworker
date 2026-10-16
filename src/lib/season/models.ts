import type { Packet, PacketVersion } from '../packet/schema';
import { isAvailable } from '../packet/availability';

export const SCENARIO_NAMES:Record<string,string>={equipment_section179:'Equipment · Section 179',equipment_no_bonus:'Equipment · No bonus',hvac_improvement:'HVAC · Capital improvement',standard_deduction:'Standard deduction',penalty_annualized:'Penalty · Annualized method'};
export function compareVersions(before:PacketVersion,after:PacketVersion) {
  const left=new Map(before.lines.map(l=>[l.key,l]));const right=new Map(after.lines.map(l=>[l.key,l]));
  return [...new Set([...left.keys(),...right.keys()])].sort().flatMap(key=>{
    const a=left.get(key),b=right.get(key);
    if(JSON.stringify(a)===JSON.stringify(b))return [];
    return [{key,label:b?.label??a?.label??key,change:!a?'added':!b?'removed':'changed',old:a?.value??null,new:b?.value??null,
      delta:typeof a?.value==='number'&&typeof b?.value==='number'?b.value-a.value:null,
      inputsChanged:JSON.stringify(a?.inputs)!==JSON.stringify(b?.inputs),sourcesChanged:JSON.stringify(a?.sources)!==JSON.stringify(b?.sources)}];
  });
}
export function replayEvents(packet:Pick<Packet,'timeline'>,asOf:string) {
  // Only event identifiers/dates are offered for navigation before availability;
  // event payloads, actors, refs and future outcomes stay on the server.
  return [...packet.timeline].sort((a,b)=>String(a.at).localeCompare(String(b.at))||String(a.id).localeCompare(String(b.id)))
    .map(e=>isAvailable(String(e.at),asOf)?{id:String(e.id),at:String(e.at),available:true,event:String(e.event),detail:e.detail,refs:e.refs,actor:e.actor}:{id:String(e.id),at:String(e.at),available:false,event:'Future scripted event',detail:null,refs:[],actor:null});
}
export function rateEstimate(version:PacketVersion,category:string,delta:number) {
  const rates=version.tax_effect_rates[category] as {federal_per_dollar:number;california_per_dollar:number}|undefined;
  if(!rates||!Number.isFinite(delta)||Math.abs(delta)>10000000)throw new Error('Choose a supplied rate category and a finite change within $10,000,000.');
  const cents=(x:number)=>Math.round(x*100)/100;
  return {label:'Rate-based estimate only · no engine rerun',category,delta,rates,
    federal:cents(delta*rates.federal_per_dollar),california:cents(delta*rates.california_per_dollar)};
}
