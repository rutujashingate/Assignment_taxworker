export const FINDING_CODES=['BROKER_PAGE_UNEXTRACTED','CA_PAYMENT_YEAR','CARD_RECEIPTS_OVERLAP','CHARITY_AMOUNT_UNCLEAR','INTEREST_SWEEP_OVERLAP','MILEAGE_DUPLICATE_PAGES','W2_CONTRIBUTION_COUNT'] as const;
export const DELIVERY_ARTIFACTS:Record<string,{title:string;path:string;type:string}>={
  product:{title:'One-page product idea and data model',path:'docs/PRODUCT_AND_DATA_MODEL.md',type:'text/markdown'},
  findings:{title:'Errors and uncertainties · evidence report',path:'docs/FINDINGS_REPORT.md',type:'text/markdown'},
  'findings-json':{title:'Deterministic findings data',path:'docs/FINDINGS_REPORT.json',type:'application/json'},
  'screenshot-manifest':{title:'UI screenshot routes and SHA-256 manifest',path:'docs/screenshots/findings/manifest.json',type:'application/json'},
  requirements:{title:'Every brief requirement · audit and gaps',path:'docs/REQUIREMENTS_AUDIT.md',type:'text/markdown'},
  interactions:{title:'Interaction audit and dispositions',path:'docs/INTERACTION_AUDIT.md',type:'text/markdown'},
  deployment:{title:'Deployment status and exact unblock checklist',path:'docs/DEPLOYMENT_HANDOFF.md',type:'text/markdown'},
  video:{title:'Personal video script · 10–11 minutes',path:'docs/VIDEO_SCRIPT.md',type:'text/markdown'},
  qa:{title:'Phase 8 validation · commands and results',path:'docs/PHASE_8_VALIDATION.md',type:'text/markdown'},
  ai:{title:'AI assistance and verification disclosure',path:'AI_USAGE.md',type:'text/markdown'},
  ...Object.fromEntries(FINDING_CODES.map(code=>[`screenshot-${code}`,{title:`Evidence screenshot · ${code}`,path:`docs/screenshots/findings/${code}.png`,type:'image/png'}])),
};
