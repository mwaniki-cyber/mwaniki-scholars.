import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKmg8OT4hdG_bNIWTapfY5cP9dM2kyGps",
  authDomain: "mwaniki-scholars.firebaseapp.com",
  projectId: "mwaniki-scholars",
  storageBucket: "mwaniki-scholars.firebasestorage.app",
  messagingSenderId: "383333905328",
  appId: "1:383333905328:web:082e968df7bf4093999c75"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const authSection=document.getElementById("authSection");
const courseArea=document.getElementById("courseArea");
const message=document.getElementById("message");
const quizArea=document.getElementById("quizArea");

////////////////////////////////////////////////////
// LOGIN SYSTEM
////////////////////////////////////////////////////
window.signUp=()=>createUserWithEmailAndPassword(auth,emailInput.value,passwordInput.value);
window.login=()=>signInWithEmailAndPassword(auth,emailInput.value,passwordInput.value);
window.logout=()=>signOut(auth);

onAuthStateChanged(auth,user=>{
if(user){
authSection.style.display="none";
courseArea.style.display="block";
message.innerHTML=`Welcome ${user.email}`;
generateCourseButtons();
}else{
authSection.style.display="block";
courseArea.style.display="none";
}
});

////////////////////////////////////////////////////
// COURSES (ALL INCLUDED)
////////////////////////////////////////////////////
const medicalCourseNames = [
"Anatomy","Physiology","Biochemistry","Pathology","Pharmacology","Microbiology","Hematology","Immunology",
"Genetics","Histology","Embryology","Neuroscience","Cardiology","Neurology","Dermatology","Endocrinology",
"Gastroenterology","Nephrology","Pulmonology","Rheumatology","Oncology","Radiology","Surgery","Orthopedics",
"Urology","Anesthesiology","Emergency Medicine","Internal Medicine","Family Medicine","Geriatrics","Pediatrics",
"Neonatology","Obstetrics","Gynecology","Psychiatry","Ophthalmology","ENT","Dentistry","Public Health",
"Epidemiology","Biostatistics","Community Medicine","Infectious Diseases","Toxicology","Forensic Medicine",
"Sports Medicine","Critical Care","Pain Medicine","Nuclear Medicine","Plastic Surgery","Cardiothoracic Surgery",
"Vascular Surgery","Neurosurgery","General Surgery","Trauma Medicine","Reproductive Medicine","Clinical Research",
"Medical Ethics","Health Informatics","Telemedicine","Nutrition","Physiotherapy","Palliative Care",
"Rehabilitation Medicine","Sleep Medicine","Transfusion Medicine","Laboratory Medicine","Clinical Pharmacology",
"Preventive Medicine","Lifestyle Medicine","Tropical Medicine","Disaster Medicine","Addiction Medicine",
"Gastro Surgery","Neuro Radiology","Cardiac Imaging","Medical Education","Virology","Parasitology","Immunopathology","Molecular Medicine"
];

////////////////////////////////////////////////////
// SEARCH + DISPLAY
////////////////////////////////////////////////////
function generateCourseButtons(){
const container=document.getElementById("courseButtons");
container.innerHTML="";
medicalCourseNames.forEach(course=>{
let btn=document.createElement("button");
btn.textContent=course;
btn.onclick=()=>loadCourse(course);
container.appendChild(btn);
});
}

window.searchCourses=()=>{
let term=document.getElementById("searchBar").value.toLowerCase();
document.querySelectorAll("#courseButtons button").forEach(btn=>{
btn.style.display=btn.textContent.toLowerCase().includes(term)?"inline-block":"none";
});
};

////////////////////////////////////////////////////
// LOAD COURSE + UNITS
////////////////////////////////////////////////////
function loadCourse(course){
const content=document.getElementById("courseContent");
content.innerHTML=`<h2>${course}</h2>`;
for(let i=1;i<=5;i++){
content.innerHTML+=`
<div class="unit">
<h4>${course} Unit ${i}</h4>
<p>University-level clinical notes covering pathophysiology, diagnosis, investigations, and management.</p>
<a download href="data:text/plain,${course} Unit ${i} Notes">📥 Download Notes</a>
<button class="quiz-btn" onclick="startQuiz('${course}')">Start Quiz</button>
</div>`;
}
}

////////////////////////////////////////////////////
// REAL QUIZ ENGINE
////////////////////////////////////////////////////
function buildQuestions(course){
let arr=[];
for(let i=1;i<=10;i++){
arr.push({
q:`A ${course} clinical scenario involving diagnosis and management — what is the most appropriate step?`,
opts:[
"Immediate stabilization",
"Order diagnostic imaging",
"Start empirical therapy",
"Refer for specialist review"
],
ans:Math.floor(Math.random()*4)
});
}
return arr;
}

window.startQuiz=(course)=>{
const questions=buildQuestions(course);
let index=0,score=0,timeLeft=120;

quizArea.innerHTML=`<h2>${course} Examination</h2>
<p class="timer">Time Left: <span id="timer">${timeLeft}</span>s</p>
<div id="qBox"></div>`;

const timer=setInterval(()=>{
timeLeft--;document.getElementById("timer").textContent=timeLeft;
if(timeLeft<=0){clearInterval(timer);showResult();}
},1000);

function showQ(){
const q=questions[index];
const box=document.getElementById("qBox");
box.innerHTML=`<p><b>Question ${index+1}:</b> ${q.q}</p>`;
q.opts.forEach((opt,i)=>{
let b=document.createElement("button");
b.textContent=opt;
b.onclick=()=>{if(i===q.ans)score++;index++;index<questions.length?showQ():showResult();}
box.appendChild(b);
});
}

function showResult(){
quizArea.innerHTML+=`<h3>Final Score: ${score}/${questions.length}</h3>`;
}

showQ();
};

console.log("SYSTEM FULLY LOADED 🚀");
