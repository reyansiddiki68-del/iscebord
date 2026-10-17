const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem('isceToken') || '';
let currentUser = JSON.parse(localStorage.getItem('isceUser') || 'null');
function demoDB(){
  let d; try{d=JSON.parse(localStorage.getItem('isceDemoDB')||'null')}catch{}
  if(!d){d={users:[{id:'admin-1',role:'board',username:'admin',password:'Board@123',name:'Board Administrator'},{id:'school-1',role:'school',username:'SCHOOL1001',password:'School@123',name:'Demo Senior Secondary School',schoolId:'ISCE-SCH-1001',status:'approved',address:'Patna, Bihar',contact:'Demo account'}],applications:[],students:[],notices:[{id:'notice-1',title:'Welcome to ISCE Board Portal',body:'Independent demo portal only; not affiliated with an existing examination board.',date:new Date().toISOString().slice(0,10)}],examFormsOpen:true,resultsPublished:false,nextSchool:1002,nextStudent:10001};localStorage.setItem('isceDemoDB',JSON.stringify(d));}return d;
}
function saveDemoDB(d){localStorage.setItem('isceDemoDB',JSON.stringify(d));}
function demoUser(){try{return JSON.parse(localStorage.getItem('isceUser')||'null')}catch{return null}}
async function api(path, method='GET', data=null) {
  const headers={'content-type':'application/json'};
  if(token) headers.authorization='Bearer '+token;
  const response=await fetch('/.netlify/functions/api'+path,{method,headers,body:data?JSON.stringify(data):undefined});
  let result={}; try{result=await response.json()}catch{}
  if(!response.ok) throw new Error(result.error||'Request failed.');
  return result;
}
function message(el, text, kind='notice'){ if(!el)return; el.className='notice '+kind; el.textContent=text; el.classList.remove('hidden'); }
function logout(){token='';currentUser=null;localStorage.removeItem('isceToken');localStorage.removeItem('isceUser');location.reload();}
function saveLogin(j){token=j.token;currentUser=j.user;localStorage.setItem('isceToken',token);localStorage.setItem('isceUser',JSON.stringify(currentUser));}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function statusPill(s){let k=['approved','published'].includes(String(s).toLowerCase())?'approved':['rejected'].includes(String(s).toLowerCase())?'rejected':'pending';return `<span class="pill ${k}">${esc(s||'pending')}</span>`;}
function show(id){$$('[data-panel]').forEach(p=>p.classList.add('hidden'));const el=$(`[data-panel="${id}"]`);if(el)el.classList.remove('hidden');}
async function initBoard(){
 const login=$('#boardLogin'), dash=$('#boardDashboard'), note=$('#boardMessage');
 if(currentUser?.role==='board'){login.classList.add('hidden');dash.classList.remove('hidden');await loadBoard();} 
 $('#boardLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const j=await api('/login','POST',{username:$('#boardUsername').value,password:$('#boardPassword').value});if(j.user.role!=='board')throw new Error('This is not a Board Admin account.');saveLogin(j);login.classList.add('hidden');dash.classList.remove('hidden');await loadBoard();}catch(err){message(note,err.message,'error');}});
 $('#boardLogout')?.addEventListener('click',logout);
 $('#boardSettingsForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/board/settings','PATCH',{examFormsOpen:$('#formsOpen').checked,resultsPublished:$('#resultsPublished').checked,noticeTitle:$('#noticeTitle').value.trim(),noticeBody:$('#noticeBody').value.trim()});$('#noticeTitle').value='';$('#noticeBody').value='';message($('#boardSettingsMessage'),'Settings saved.','success');await loadBoard();}catch(err){message($('#boardSettingsMessage'),err.message,'error');}});
}
async function loadBoard(){
 const d=await api('/board/summary');$('#boardSchoolCount').textContent=d.schools;$('#boardPendingCount').textContent=d.pending;$('#boardStudentCount').textContent=d.students;$('#boardFormsState').textContent=d.formsOpen?'Open':'Closed';$('#formsOpen').checked=d.formsOpen;$('#resultsPublished').checked=d.resultsPublished;
 $('#applicationsTable').innerHTML=d.applications.length?d.applications.map(a=>`<tr><td>${esc(a.name)}<div class="muted small">${esc(a.address)}</div></td><td>${esc(a.contact)}</td><td>${statusPill(a.status)}</td><td>${a.status==='pending'?`<button data-approve="${a.id}">Approve</button> <button class="danger" data-reject="${a.id}">Reject</button>`:esc(a.schoolId||'—')}</td></tr>`).join(''):'<tr><td colspan="4">No school applications yet.</td></tr>';
 $('#schoolsTable').innerHTML=d.schoolsList.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.schoolId)}</td><td>${esc(s.username)}</td><td>${statusPill(s.status)}</td></tr>`).join('')||'<tr><td colspan="4">No approved schools.</td></tr>';
 $('#boardNotices').innerHTML=d.notices.map(n=>`<div class="notice"><strong>${esc(n.title)}</strong><div>${esc(n.body)}</div><small>${esc(n.date)}</small></div>`).join('');
 $$('[data-approve]').forEach(b=>b.onclick=()=>decision(b.dataset.approve,'approve'));$$('[data-reject]').forEach(b=>b.onclick=()=>decision(b.dataset.reject,'reject'));
}
async function decision(id,action){try{const j=await api('/board/applications/'+id,'PATCH',{action});if(j.school){alert(`School approved!\nSchool ID: ${j.school.schoolId}\nLogin ID: ${j.school.username}\nTemporary password: ${j.school.password}\nPlease save these credentials now.`);}await loadBoard();}catch(e){alert(e.message);}}
async function initSchool(){
 const login=$('#schoolLogin'), dash=$('#schoolDashboard'), note=$('#schoolMessage');
 $('#schoolLoginForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const j=await api('/login','POST',{username:$('#schoolUsername').value,password:$('#schoolPassword').value});if(j.user.role!=='school')throw new Error('Use the Board Admin website for this account.');saveLogin(j);login.classList.add('hidden');dash.classList.remove('hidden');await loadSchool();}catch(err){message(note,err.message,'error');}});
 $('#schoolLogout')?.addEventListener('click',logout);
 $('#applyForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const j=await api('/apply-school','POST',{name:$('#applyName').value,address:$('#applyAddress').value,contact:$('#applyContact').value,principal:$('#applyPrincipal').value});message($('#applyMessage'),j.message,'success');e.target.reset();}catch(err){message($('#applyMessage'),err.message,'error');}});
 $('#studentForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const j=await api('/school/students','POST',{name:$('#studentName').value,fatherName:$('#fatherName').value,dob:$('#studentDob').value,classLevel:$('#classLevel').value,stream:$('#stream').value});message($('#studentMessage'),`Student registered. Student ID: ${j.student.studentId}`,'success');e.target.reset();await loadSchool();}catch(err){message($('#studentMessage'),err.message,'error');}});
}
async function loadSchool(){
 const d=await api('/school/dashboard');$('#schoolWelcome').textContent=d.school.name;$('#schoolIdLabel').textContent=d.school.schoolId;$('#schoolStudentCount').textContent=d.students.length;$('#schoolFormsState').textContent=d.formsOpen?'Open':'Closed';$('#schoolResultsState').textContent=d.resultsPublished?'Published':'Not published';
 $('#studentTable').innerHTML=d.students.length?d.students.map(s=>`<tr><td>${esc(s.studentId)}</td><td>${esc(s.name)}</td><td>Class ${esc(s.classLevel)} ${s.classLevel==='12'?'· '+esc(s.stream):''}</td><td>${statusPill(s.examFormStatus)}</td><td><div class="actions"><button class="secondary" data-exam="${s.id}">Submit exam form</button><button class="secondary" data-marks="${s.id}">Upload marks</button></div><small>Admit card: ${s.admitCardIssued?'Issued':'Awaiting Board'}</small></td></tr>`).join(''):'<tr><td colspan="5">No students registered yet.</td></tr>';
 $('#schoolNotices').innerHTML=d.notices.map(n=>`<div class="notice"><strong>${esc(n.title)}</strong><div>${esc(n.body)}</div><small>${esc(n.date)}</small></div>`).join('');
 $$('[data-exam]').forEach(b=>b.onclick=async()=>{try{await api('/school/students/'+b.dataset.exam,'PATCH',{action:'exam-form'});await loadSchool();alert('Examination form submitted.');}catch(e){alert(e.message);}});
 $$('[data-marks]').forEach(b=>b.onclick=async()=>{const math=prompt('Enter marks for Subject 1 (0–100):');if(math===null)return;const science=prompt('Enter marks for Subject 2 (0–100):');if(science===null)return;try{await api('/school/students/'+b.dataset.marks,'PATCH',{action:'marks',marks:{subject1:math,subject2:science}});await loadSchool();alert('Marks submitted to Board for review.');}catch(e){alert(e.message);}});
}
async function initResult(){
 $('#resultForm')?.addEventListener('submit',async e=>{e.preventDefault();const box=$('#resultMessage');try{const j=await api('/student/result','POST',{studentId:$('#resultStudentId').value,dob:$('#resultDob').value});const s=j.student;const vals=Object.values(s.marks||{}).map(Number).filter(Number.isFinite);const total=vals.reduce((a,b)=>a+b,0);$('#resultCard').innerHTML=`<div class="notice success"><strong>ISCE Board Examination Result</strong><p>${esc(s.name)} · Student ID: ${esc(s.studentId)}</p><p>School: ${esc(s.schoolName)} · Class ${esc(s.classLevel)}</p><p>Marks entered: ${vals.length?vals.map((v,i)=>`Subject ${i+1}: ${v}`).join(' | '):'Marks not available'}</p><strong>Total (entered subjects): ${total}</strong></div><button onclick="window.print()">Print / Save PDF</button>`;$('#resultCard').classList.remove('hidden');box.classList.add('hidden');}catch(err){message(box,err.message,'error');$('#resultCard').classList.add('hidden');}});
}
document.addEventListener('DOMContentLoaded',()=>{if(document.body.dataset.page==='board')initBoard();if(document.body.dataset.page==='school')initSchool();if(document.body.dataset.page==='result')initResult();});