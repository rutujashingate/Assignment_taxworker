export const AREAS = [
  {id:'comparison',title:'Return vs last year',description:'2024 as filed against the selected 2025 engine return.',forms:['F1040'],trace:'py:/return_2024/lines/F1040.11'},
  {id:'computation',title:'Tax computation',description:'Regular tax, AMT, additional taxes and payment totals.',forms:['F1040','F6251','F8960','F8959','SchSE','Sch2','Sch3'],trace:'F1040.24'},
  {id:'documents',title:'Document index',description:'Available source pages, extraction state and computed usage.',forms:[],trace:'doc:D29#page1'},
  {id:'depreciation',title:'Depreciation by asset',description:'Method, life, federal, California, AMT and disposition records.',forms:['F4562-C','F4562-E','FTB3885A','F4797'],trace:'asset:STU-PRINTER'},
  {id:'sales',title:'Brokerage & crypto sales',description:'Category groups, exceptions and individual lots with provenance.',forms:['F8949','SchD'],trace:'F8949.D.X1'},
  {id:'business',title:'Schedule C · books to tax',description:'Book figures beside the engine’s taxable business income.',forms:['SchC','F8995','SchSE'],trace:'SchC.31'},
  {id:'rentals',title:'Rentals & passive losses',description:'Two rental activities, disposition and supplied passive limitations.',forms:['SchE','F8582','F4797'],trace:'SchE.22A'},
  {id:'k1',title:'K-1 records',description:'Partnership and S-corp boxes, state supplements and basis constraints.',forms:['F7203'],trace:'SchE.28B'},
  {id:'retirement-foreign',title:'Retirement & foreign accounts',description:'IRA basis/conversion, SEP/HSA and foreign account reporting.',forms:['F8606','F8889','F8938'],trace:'F8606.18'},
  {id:'deductions-credits',title:'Deductions, credits & limits',description:'Itemized deductions, credits, phaseouts and diligence gaps.',forms:['SchA','F8812','F8863','F2441','F8283','F8867','F8995'],trace:'SchA.14'},
  {id:'payments',title:'Payments & agency reconciliation',description:'Withholding and estimates alongside available agency records.',forms:['F2210','FTB5805'],trace:'F540NR.72'},
  {id:'california',title:'California allocation',description:'Federal amounts, California-law totals and California-source columns.',forms:['SchCA540NR','F540NR','ScheduleS'],trace:'SchCA540NR.12.E'},
  {id:'carryovers',title:'Carryovers',description:'Supplied opening balances and selected-version carryovers out.',forms:['F8582'],trace:'SchE.22A'},
  {id:'basis',title:'Basis by year',description:'Stock, partnership, IRA and home basis with explicit unknown years.',forms:['F7203','F8606'],trace:'F7203.1'},
  {id:'prior-treatment',title:'Prior preparer vs current',description:'Prior memo and unresolved items beside current engine treatment.',forms:[],trace:'py:/prior_preparer_workpaper'},
] as const;
export type AreaId = typeof AREAS[number]['id'];
export type FactRecord = {title:string;ref:string;data:unknown};
export type TaxArea = {id:AreaId;title:string;description:string;trace:string;lines:{key:string;label:string;value:unknown}[];
  metrics:{label:string;ref:string;value:unknown}[];records:FactRecord[];gaps:{title:string;detail:string;ref?:string}[];
  comparisons:{key:string;label:string;prior:unknown;current:unknown;delta:number|null;percent:number|null;flagged:boolean;priorRef:string}[];
  bridge?:{label:string;value:number;refs:string[]}[];
};
export type Lot = {key:string;id:string;category:string;exception:string;description:string;documentId:string;page:number;
  proceeds:number|null;basis:number|null;wash:number|null;quantity:number|null;acquired:string|null;sold:string|null;gain:number|null;sourceRefs:string[];fieldRefs:string[]};
export type LotReview = {key:string;status:'reviewed'|'needs_review';revision:number;reason:string;updatedBy:string;updatedAt:string};
export type LotGroup = {key:string;category:string;exception:string;count:number;proceeds:number;knownBasis:number;basisComplete:boolean;wash:number;engineGain:number};
