'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { CollaborationData } from '@/lib/collaboration/types';

export function LiveChanges({clientId,taxYear,actorId}:{clientId:string;taxYear:number;actorId:string}) {
  const router=useRouter();const path=usePathname();const [data,setData]=useState<CollaborationData|null>(null);
  const [error,setError]=useState('');const [pending,setPending]=useState(false);const cursor=useRef('');const dirty=useRef(false);
  const endpoint=`/api/engagements/${clientId}/${taxYear}/collaboration`;
  useEffect(()=>{
    let stopped=false;let active=false;const controller=new AbortController();
    function changed(e:Event){if(e.target instanceof Element&&e.target.closest('form'))dirty.current=true;}
    async function poll() {
      if(active||document.visibilityState==='hidden')return;active=true;
      try {
        const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error(response.status===401?'Session expired. Select your demo identity again.':'Live updates unavailable. Use Refresh to retry.');
        const next:CollaborationData=await response.json();if(stopped)return;
        const changed=cursor.current!==''&&cursor.current!==next.cursor;
        cursor.current=next.cursor;setData(next);setError('');
        window.dispatchEvent(new CustomEvent('workpaper-change',{detail:next}));
        if(changed&&!path.endsWith('/workflow')) {
          if(dirty.current)setPending(true);else router.refresh();
        }
      }catch(e){if(!stopped)setError(e instanceof Error?e.message:'Live updates unavailable.');}
      finally{active=false;}
    }
    document.addEventListener('input',changed);document.addEventListener('change',changed);
    const timer=setInterval(()=>void poll(),3000);void poll();
    const wake=()=>void poll();document.addEventListener('visibilitychange',wake);window.addEventListener('workpaper-saved',wake);
    return ()=>{stopped=true;controller.abort();clearInterval(timer);document.removeEventListener('input',changed);document.removeEventListener('change',changed);document.removeEventListener('visibilitychange',wake);window.removeEventListener('workpaper-saved',wake);};
  },[endpoint,path,actorId,router]);
  async function read(id:string) {
    try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read_notification',id})});
      if(!response.ok){const body=await response.json();throw new Error(body.error);}
      window.dispatchEvent(new Event('workpaper-saved'));
    }catch(e){setError(e instanceof Error?e.message:'Unable to mark notification read.');}
  }
  return <aside className="live-bar" aria-label="Engagement updates">
    <span role="status" aria-label="Live update status">{error||'Live updates · checks every 3 seconds'}</span>
    {(error||pending)&&<button className="text-button" type="button" onClick={()=>{dirty.current=false;setPending(false);window.dispatchEvent(new Event('workpaper-saved'));router.refresh();}}>Refresh current view</button>}
    {pending&&<span>Updates available. Your draft is preserved until you reload.</span>}
    <details className="notification-menu"><summary>Notifications ({data?.notifications.filter(n=>!n.readAt).length??0} unread)</summary>
      <div>{data?.notifications.length?data.notifications.slice(-20).reverse().map(n=><article key={n.id}>
        <a href={`/engagements/${clientId}/${taxYear}/workflow?item=${n.itemId}`}>{n.title}</a><small>{n.event} · {new Date(n.createdAt).toLocaleString('en-US',{timeZone:'UTC'})+' UTC'}</small>
        {!n.readAt&&<button type="button" className="text-button" onClick={()=>void read(n.id)}>Mark read</button>}
      </article>):<p>No notifications for this identity.</p>}</div>
    </details>
  </aside>;
}
