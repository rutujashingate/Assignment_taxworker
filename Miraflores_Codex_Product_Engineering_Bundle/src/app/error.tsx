"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-page"><span className="eyebrow">MIRAFLORES WORKPAPER</span><h1>The workspace could not load.</h1><p>Check the local database connection and retry. Source records have not been changed.</p><button className="button" onClick={reset}>Try again</button></main>; }
