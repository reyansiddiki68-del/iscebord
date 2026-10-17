const crypto = require('crypto');
const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS' };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const fresh = () => ({ users: [], applications: [], students: [], notices: [{ id:'notice-1', title:'Welcome to ISCE Board Portal', body:'Independent demo portal only; not affiliated with an existing examination board.', date:new Date().toISOString().slice(0,10) }], examFormsOpen:true, resultsPublished:false, nextSchool:1002, nextStudent:10001, sessions:{} });
async function dbRequest(method, path, body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Database is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables.');
  const r = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey:key, authorization:`Bearer ${key}`, 'content-type':'application/json', prefer: method==='GET' ? 'return=representation' : 'return=representation,resolution=merge-duplicates' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); if (!r.ok) throw new Error(`Database request failed (${r.status}). Check Supabase setup and SQL schema.`);
  return txt ? JSON.parse(txt) : [];
}
async function loadState() {
  let rows = await dbRequest('GET', 'portal_state?id=eq.main&select=payload');
  if (!rows.length) {
    const state=fresh();
    rows=await dbRequest('POST','portal_state?on_conflict=id',[{id:'main',payload:state}]);
    if (!rows.length) rows=await dbRequest('GET','portal_state?id=eq.main&select=payload');
  }
  const state=rows[0]?.payload || fresh();
  state.sessions ||= {}; state.users ||= []; state.applications ||= []; state.students ||= []; state.notices ||= [];
  return state;
}
async function saveState(state) { await dbRequest('PATCH','portal_state?id=eq.main',{payload:state,updated_at:new Date().toISOString()}); }
const cleanUser = u => { const {password, ...safe}=u; return safe; };
exports.handler = async event => {
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers,body:''};
  try {
    const path=event.path.replace(/^.*\/api\/?/, '/');
    const method=event.httpMethod;
    let data={}; try { data=event.body ? JSON.parse(event.body) : {}; } catch {}
    const state=await loadState();
    const auth=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    const session=state.sessions[auth];
    const user=session ? state.users.find(u=>u.id===session.userId) : null;
    if(path==='/health') return reply(200,{ok:true,database:'connected'});
    if(path==='/login' && method==='POST') {
      const username=String(data.username||'').trim(); const password=String(data.password||'');
      // First-run admin and demo school accounts are configured via environment variables.
      const adminId=process.env.BOARD_ADMIN_ID || 'admin'; const adminPass=process.env.BOARD_ADMIN_PASSWORD || 'Board@123';
      const schoolId=process.env.DEMO_SCHOOL_ID || 'SCHOOL1001'; const schoolPass=process.env.DEMO_SCHOOL_PASSWORD || 'School@123';
      if(username===adminId && password===adminPass && !state.users.some(x=>x.username===adminId && x.role==='board')) state.users.push({id:'board-admin',role:'board',username:adminId,password:adminPass,name:'Board Administrator'});
      if(username===schoolId && password===schoolPass && !state.users.some(x=>x.username===schoolId && x.role==='school')) state.users.push({id:'school-demo',role:'school',username:schoolId,password:schoolPass,name:'Demo Senior Secondary School',schoolId:'ISCE-SCH-1001',status:'approved',address:'Patna, Bihar',contact:'Demo account'});
      const u=state.users.find(x=>x.username.toLowerCase()===username.toLowerCase()&&x.password===password);
      if(!u) return reply(401,{error:'Invalid ID or password.'});
      if(u.role==='school'&&u.status!=='approved') return reply(403,{error:'This school account is not approved yet.'});
      const token=crypto.randomBytes(32).toString('hex'); state.sessions[token]={userId:u.id,createdAt:Date.now()}; await saveState(state);
      return reply(200,{token,user:cleanUser(u)});
    }
    if(path==='/apply-school'&&method==='POST') {
      const name=String(data.name||'').trim(),address=String(data.address||'').trim(),contact=String(data.contact||'').trim();
      if(!name||!address||!contact) return reply(400,{error:'Please complete all school application fields.'});
      state.applications.push({id:'app-'+crypto.randomUUID(),name,address,contact,principal:String(data.principal||''),status:'pending',date:new Date().toISOString().slice(0,10)}); await saveState(state); return reply(200,{message:'Application submitted. The Board will review it.'});
    }
    if(path==='/logout'&&method==='POST'){if(auth) delete state.sessions[auth];await saveState(state);return reply(200,{ok:true});}
    if(path==='/student/result'&&method==='POST'){
      const st=state.students.find(x=>x.studentId.toLowerCase()===String(data.studentId||'').trim().toLowerCase()&&x.dob===String(data.dob||''));if(!st)return reply(404,{error:'No result record found. Check Student ID and date of birth.'});if(!state.resultsPublished)return reply(403,{error:'Results have not been published by the Board yet.'});return reply(200,{student:st});
    }
    if(!user) return reply(401,{error:'Please log in again.'});
    if(path==='/board/summary'&&user.role==='board') return reply(200,{schools:state.users.filter(u=>u.role==='school').length,pending:state.applications.filter(a=>a.status==='pending').length,students:state.students.length,formsOpen:state.examFormsOpen,resultsPublished:state.resultsPublished,applications:state.applications,schoolsList:state.users.filter(u=>u.role==='school').map(cleanUser),notices:state.notices});
    if(path.startsWith('/board/applications/')&&method==='PATCH'&&user.role==='board') {
      const a=state.applications.find(x=>x.id===path.split('/').pop());if(!a)return reply(404,{error:'Application not found.'});
      if(data.action==='approve'){a.status='approved';const n=state.nextSchool++;const id=`ISCE-SCH-${n}`,username=`SCHOOL${String(n).slice(-4)}`,password='Sch'+crypto.randomBytes(4).toString('hex')+'!';const school={id:'user-'+crypto.randomUUID(),role:'school',username,password,name:a.name,schoolId:id,status:'approved',address:a.address,contact:a.contact};state.users.push(school);a.schoolId=id;await saveState(state);return reply(200,{school:{username,password,schoolId:id,name:school.name}});}
      a.status='rejected';await saveState(state);return reply(200,{message:'Application rejected.'});
    }
    if(path==='/board/settings'&&method==='PATCH'&&user.role==='board'){state.examFormsOpen=!!data.examFormsOpen;state.resultsPublished=!!data.resultsPublished;if(data.noticeTitle&&data.noticeBody)state.notices.unshift({id:'n-'+crypto.randomUUID(),title:String(data.noticeTitle),body:String(data.noticeBody),date:new Date().toISOString().slice(0,10)});await saveState(state);return reply(200,{message:'Board settings updated.'});}
    if(path==='/school/dashboard'&&user.role==='school')return reply(200,{school:cleanUser(user),students:state.students.filter(x=>x.schoolId===user.schoolId),formsOpen:state.examFormsOpen,resultsPublished:state.resultsPublished,notices:state.notices});
    if(path==='/school/students'&&method==='POST'&&user.role==='school'){
      if(!state.examFormsOpen)return reply(400,{error:'Student registration / examination forms are currently closed by the Board.'});const name=String(data.name||'').trim(),cls=String(data.classLevel||''),dob=String(data.dob||'').trim();if(!name||!['10','12'].includes(cls)||!dob)return reply(400,{error:'Name, class and date of birth are required.'});
      const student={id:'stu-'+crypto.randomUUID(),studentId:'ISCE-'+state.nextStudent++,schoolId:user.schoolId,schoolName:user.name,name,fatherName:String(data.fatherName||''),dob,classLevel:cls,stream:cls==='12'?String(data.stream||'Arts'):'N/A',status:'registered',examFormStatus:'pending',admitCardIssued:false,marks:{},resultStatus:'not-published',createdAt:new Date().toISOString()};state.students.push(student);await saveState(state);return reply(200,{student});
    }
    if(path.startsWith('/school/students/')&&method==='PATCH'&&user.role==='school'){
      const st=state.students.find(x=>x.id===path.split('/').pop()&&x.schoolId===user.schoolId);if(!st)return reply(404,{error:'Student not found in your school.'});if(data.action==='exam-form'){if(!state.examFormsOpen)return reply(400,{error:'Examination forms are closed.'});st.examFormStatus='submitted';}else if(data.action==='marks'){const vals=Object.values(data.marks||{}).map(Number);if(vals.some(v=>!Number.isFinite(v)||v<0||v>100))return reply(400,{error:'Marks must be between 0 and 100.'});st.marks={...st.marks,...data.marks};st.resultStatus='submitted';}await saveState(state);return reply(200,{student:st});
    }
    return reply(403,{error:'You do not have permission for this action.'});
  } catch(e) { return reply(500,{error:e.message||'Unexpected server error.'}); }
};
