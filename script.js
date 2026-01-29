import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
apiKey:"AIzaSyDKmg8OT4hdG_bNIWTapfY5cP9dM2kyGps",
authDomain:"mwaniki-scholars.firebaseapp.com",
projectId:"mwaniki-scholars",
appId:"1:383333905328:web:082e968df7bf4093999c75"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const authSection=document.getElementById("authSection");
const courseArea=document.getElementById("courseArea");
const adminPanel=document.getElementById("adminPanel");
const message=document.getElementById("message");

////////////////////////////////////////////////////
// AUTH
////////////////////////////////////////////////////
window.signUp=()=>createUserWithEmailAndPassword(auth,email.value,password.value).catch(e=>alert(e.message));
window.login=()=>signInWithEmailAndPassword(auth,email.value,password.value).catch(e=>alert(e.message));
window.logout=()=>signOut(auth);

onAuthStateChanged(auth,user=>{
if(user){
authSection.style.display="none";
courseArea.style.display="block";
if(user.email==="admin@mwaniki.com") adminPanel.style.display="block";
generateCourseButtons();
}else{
authSection.style.display="block";
courseArea.style.display="none";
adminPanel.style.display="none";
}
});

////////////////////////////////////////////////////
// COURSE DATA (REAL NOTES)
////////////////////////////////////////////////////
const courses={
"Anatomy":{
units:[
{title:"Upper Limb",notes:"Brachial plexus, nerve injuries, surgical neck fractures...",pdf:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
{title:"Thorax",notes:"Coronary circulation, lung hilum, mediastinum...",pdf:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"}
]},
"Physiology":{
units:[
{title:"Cardiac Physiology",notes:"Action potentials, Frank-Starling law, cardiac cycle...",pdf:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
{title:"Respiratory Physiology",notes:"Gas exchange, V/Q ratio, oxygen dissociation curve...",pdf:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"}
]},
"Pathology":{
units:[
{title:"Inflammation",notes:"Acute vs chronic inflammation, mediators, healing...",pdf:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
{title:"Neoplasia",notes:"Oncogenes, tumor suppressor genes, grading, staging...",pdf:"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"}
]}
};

document.getElementById("courseCount").innerText=Object.keys(courses).length;

////////////////////////////////////////////////////
// SEARCH + BUTTONS
////////////////////////////////////////////////////
function generateCourseButtons(){
const container=document.getElementById("courseButtons");
container.innerHTML="";
Object.keys(courses).forEach(c=>{
let btn=document.createElement("button");
btn.textContent=c;
btn.className="courseBtn";
btn.onclick=()=>loadCourse(c);
container.appendChild(btn);
});
}

searchInput.oninput=()=>{
let val=searchInput.value.toLowerCase();
document.querySelectorAll(".courseBtn").forEach(b=>{
b.style.display=b.textContent.toLowerCase().includes(val)?"inline-block":"none";
});
};

////////////////////////////////////////////////////
// LOAD COURSE
////////////////////////////////////////////////////
function loadCourse(name){
courseContent.innerHTML=`<h2>${name}</h2>`;
courses[name].units.forEach(u=>{
let div=document.createElement("div");
div.className="unitCard";
div.innerHTML=`<h3>${u.title}</h3><p>${u.notes}</p>
<a href="${u.pdf}" download>📥 Download Notes</a>
<button onclick="startQuiz('${name}')">Start Quiz</button>`;
courseContent.appendChild(div);
});
}

////////////////////////////////////////////////////
// QUESTION BANK
////////////////////////////////////////////////////
const questionBank={
"Anatomy":[
{q:"Surgical neck fracture injures?",opts:["Radial","Axillary","Median","Ulnar"],ans:1},
{q:"Structure in foramen magnum?",opts:["ICA","Vertebral artery","Facial","Optic"],ans:1}
],
"Physiology":[
{q:"Plateau phase ion?",opts:["Na","K","Ca","Cl"],ans:2},
{q:"Stimulus for EPO?",opts:["Hypercapnia","Hypoxia","Alkalosis","Acidosis"],ans:1}
],
"Pathology":[
{q:"Caseous necrosis seen in?",opts:["TB","MI","Fat","Gangrene"],ans:0},
{q:"Marker for HCC?",opts:["CEA","AFP","PSA","CA125"],ans:1}
]
};

////////////////////////////////////////////////////
// QUIZ
////////////////////////////////////////////////////
window.startQuiz=(course)=>{
quizArea.innerHTML=`<h3>${course} Quiz</h3><div class="timer">Time Left: <span id="time">120</span>s</div>`;
let time=120;
let timer=setInterval(()=>{time--;timeSpan.innerText=time;if(time<=0)clearInterval(timer)},1000);

let questions=questionBank[course];
questions.forEach((q,i)=>{
let p=document.createElement("p");
p.innerHTML=`${i+1}. ${q.q}`;
quizArea.appendChild(p);
q.opts.forEach((o,index)=>{
let b=document.createElement("button");
b.innerText=o;
b.onclick=()=>alert(index===q.ans?"Correct ✅":"Wrong ❌");
quizArea.appendChild(b);
});
});
};

console.log("UNIVERSITY SYSTEM READY 🎓");
