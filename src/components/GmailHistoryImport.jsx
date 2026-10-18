import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function GmailHistoryImport({ connected }) {
  const [months,setMonths]=useState(6);
  const [session,setSession]=useState(null);
  const [candidates,setCandidates]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function load() {
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const {data:imports,error:importsError}=await supabase.from("gmail_history_imports")
      .select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1);
    if(importsError) {
      // Schema migration may not have been applied yet.
      setError("Historical import needs its database migration installed.");
      return;
    }
    const current=imports?.[0]||null;
    setSession(current);
    if(!current){setCandidates([]);return;}
    const {data:rows,error:rowsError}=await supabase.from("gmail_history_candidates")
      .select("id,company,role,proposed_status,applied_date,subject,confidence,decision")
      .eq("user_id",user.id).eq("import_id",current.id)
      .order("created_at",{ascending:false}).limit(250);
    if(rowsError){setError(rowsError.message);return;}
    setCandidates(rows||[]);
  }

  useEffect(()=>{if(connected)load();},[connected]);

  async function call(action,extra={}) {
    setBusy(true);setError("");setMessage("");
    try {
      const {data,error:invokeError}=await supabase.functions.invoke(
        "import-gmail-history",{body:{action,...extra}});
      if(invokeError)throw invokeError;
      if(data?.error)throw new Error(data.error);
      setMessage(action==="approve"?"Application imported into Offerly."
        :action==="dismiss"?"Candidate dismissed."
        :data.completed?"Scan complete. Review your matches below."
        :`Processed another batch. Total messages checked: ${data.checked}.`);
      await load();
    } catch(e){setError(e?.message||"Import could not finish. Please try again.");}
    finally{setBusy(false);}
  }

  if(!connected)return null;
  const pending=candidates.filter(c=>c.decision==="pending");
  return (
    <section className="gmail-content-card" aria-label="Historical Gmail application import"
      style={{marginTop:20}}>
      <div className="gmail-section-heading">
        <div>
          <h2>Import past job applications</h2>
          <p>One-time historical scan, separate from your automatic Gmail sync. Review everything before saving it.</p>
        </div>
      </div>
      {!session ? (
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginTop:16}}>
          <label htmlFor="gmail-history-months">Look back</label>
          <select id="gmail-history-months" value={months}
            onChange={e=>setMonths(Number(e.target.value))}>
            <option value={1}>30 days</option>
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
          <button className="gmail-button gmail-button-primary" type="button"
            disabled={busy} onClick={()=>call("start",{months})}>
            {busy?"Scanning…":"Find past applications"}
          </button>
        </div>
      ):(
        <div style={{marginTop:16,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <span>{session.checked_count} emails checked · {pending.length} awaiting review</span>
          {!session.completed && (
            <button type="button" className="gmail-button gmail-button-primary"
              disabled={busy} onClick={()=>call("continue",{importId:session.id})}>
              {busy?"Scanning…":"Continue scanning"}
            </button>
          )}
          {session.completed&&<strong>Scan finished</strong>}
          <button className="gmail-button gmail-button-secondary"
            type="button" disabled={busy} onClick={load}>Refresh results</button>
        </div>
      )}
      {error&&<p className="gmail-inline-error" role="alert">{error}</p>}
      {message&&<p role="status">{message}</p>}
      {pending.length===0&&session&&(
        <p style={{marginTop:16}}>No unreviewed applications yet. Continue the scan if it isn't finished.</p>
      )}
      {pending.map(candidate=>(
        <article key={candidate.id} style={{
          marginTop:12,padding:16,border:"1px solid #e2e8f0",borderRadius:12
        }}>
          <strong>{candidate.company} — {candidate.role}</strong>
          <p>{candidate.proposed_status}{candidate.applied_date?` · ${candidate.applied_date}`:""} · Email: {candidate.subject}</p>
          <p style={{fontSize:12,opacity:.75}}>AI extraction confidence: {Math.round(candidate.confidence*100)}%. Check the original Gmail message before approving.</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button type="button" className="gmail-button gmail-button-primary" disabled={busy}
              onClick={()=>call("approve",{candidateId:candidate.id})}>Import application</button>
            <button type="button" className="gmail-button gmail-button-secondary" disabled={busy}
              onClick={()=>call("dismiss",{candidateId:candidate.id})}>Dismiss</button>
          </div>
        </article>
      ))}
      <p style={{marginTop:16,fontSize:12,opacity:.75}}>
        Read-only Gmail access. Offerly does not send emails. Imported application details can be edited on your dashboard.
      </p>
    </section>
  );
}
