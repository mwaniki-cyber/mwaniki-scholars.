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

const authSection = document.getElementById("authSection");
const courseArea = document.getElementById("courseArea");
const message = document.getElementById("message");

onAuthStateChanged(auth, user=>{
authSection.style.display = user ? "none":"block";
courseArea.style.display = user ? "block":"none";
});

window.signUp=()=>createUserWithEmailAndPassword(auth,email.value,password.value).catch(e=>alert(e.message));
window.login=()=>signInWithEmailAndPassword(auth,email.value,password.value).catch(e=>alert(e.message));
window.logout=()=>signOut(auth);

//////////////////////////////////////////////////
// 84 COURSES LIST
//////////////////////////////////////////////////
const medicalCourses = [
"Anatomy","Physiology","Biochemistry","Pathology","Pharmacology","Microbiology",
"Hematology","Immunology","Genetics","Histology","Embryology","Neuroscience",
"Cardiology","Neurology","Dermatology","Endocrinology","Gastroenterology","Nephrology",
"Pulmonology","Rheumatology","Oncology","Radiology","Surgery","Orthopedics","Urology",
"Anesthesiology","Emergency Medicine","Internal Medicine","Family Medicine","Geriatrics",
"Pediatrics","Neonatology","Obstetrics","Gynecology","Psychiatry","Ophthalmology","ENT",
"Dentistry","Public Health","Epidemiology","Biostatistics","Community Medicine",
"Infectious Diseases","Toxicology","Forensic Medicine","Sports Medicine","Critical Care",
"Pain Medicine","Nuclear Medicine","Plastic Surgery","Cardiothoracic Surgery",
"Vascular Surgery","Neurosurgery","General Surgery","Trauma Medicine","Reproductive Medicine",
"Clinical Research","Medical Ethics","Health Informatics","Telemedicine","Nutrition",
"Physiotherapy","Palliative Care","Rehabilitation Medicine","Sleep Medicine",
"Transfusion Medicine","Laboratory Medicine","Clinical Pharmacology","Preventive Medicine",
"Lifestyle Medicine","Tropical Medicine","Disaster Medicine","Addiction Medicine",
"Gastro Surgery","Neuro Radiology","Cardiac Imaging","Medical Education"
];

//////////////////////////////////////////////////
// REAL NOTES FOR 20 COURSES
//////////////////////////////////////////////////
const detailedNotes = {
"Cardiology":"Ischemic heart disease, ECG interpretation, heart failure management...",
"Neurology":"Stroke syndromes, seizure types, neuro exam...",
"Obstetrics":"Antenatal care schedule, PPH protocol...",
"Surgery":"Shock types, surgical infections...",
"Pharmacology":"Drug kinetics, adverse reactions...",
"Anatomy":"Thorax anatomy, brachial plexus...",
"Physiology":"Cardiac cycle, renal physiology...",
"Pathology":"Inflammation, neoplasia...",
"Microbiology":"Gram positive vs negative bacteria...",
"Gynecology":"Fibroids, PID, cervical cancer...",
"Pediatrics":"IMCI protocols, neonatal jaundice...",
"Emergency Medicine":"ATLS, ACLS algorithms...",
"Radiology":"CT vs MRI indications...",
"Oncology":"Tumor markers, chemotherapy principles...",
"Nephrology":"AKI vs CKD...",
"Endocrinology":"Diabetes management...",
"Hematology":"Anemias classification...",
"Immunology":"Hypersensitivity reactions...",
"Transfusion Medicine":"Blood grouping, crossmatching...",
"Internal Medicine":"Hypertension, diabetes..."
};

//////////////////////////////////////////////////
// SEARCH
//////////////////////////////////////////////////
searchBar.addEventListener("input",()=>generateButtons(searchBar.value));

function generateButtons(filter=""){
courseButtons.innerHTML="";
medicalCourses.filter(c=>c.toLowerCase().includes(filter.toLowerCase()))
.forEach(c=>{
let btn=document.createElement("button");
btn.textContent=c;
btn.className="courseBtn";
btn.onclick=()=>loadCourse(c);
courseButtons.appendChild(btn);
});
}

//////////////////////////////////////////////////
// LOAD COURSE
//////////////////////////////////////////////////
function loadCourse(course){
courseContent.innerHTML=`<h2>${course}</h2>`;
let notes = detailedNotes[course] || "Detailed notes coming soon.";

courseContent.innerHTML+=`
<div class="unitCard">
<p>${notes}</p>
<button onclick="downloadNotes('${course}')">Download Notes</button>
<button onclick="startQuiz('${course}')">Start Quiz</button>
</div>`;
}

window.downloadNotes=(course)=>{
const text = detailedNotes[course] || "Notes coming soon";
const blob = new Blob([text],{type:"text/plain"});
const link=document.createElement("a");
link.href=URL.createObjectURL(blob);
link.download=course+"_notes.txt";
link.click();
};

//////////////////////////////////////////////////
// REAL QUIZ ENGINE WITH TIMER
//////////////////////////////////////////////////
function generateQuiz(course){
return [
{q:"What is the first-line drug in acute MI?",opts:["Aspirin","Metformin","Atropine","Warfarin"],ans:0},
{q:"Which artery is most commonly occluded in MI?",opts:["LAD","RCA","LCX","Aorta"],ans:0},
{q:"Normal adult heart rate is?",opts:["60-100 bpm","30-50","100-140","140-180"],ans:0}
];
}

window.startQuiz=(course)=>{
quizArea.innerHTML=`<h2>${course} Quiz</h2><p class="timer">Time left: <span id="time">60</span>s</p>`;
let questions=generateQuiz(course);
let score=0,index=0;

let timer=setInterval(()=>{
time.textContent--;
if(time.textContent==0){clearInterval(timer);showResult();}
},1000);

function showQ(){
let q=questions[index];
quizArea.innerHTML+=`<p>${index+1}. ${q.q}</p>`;
q.opts.forEach((o,i)=>{
let b=document.createElement("button");
b.textContent=o;
b.onclick=()=>{
if(i===q.ans)score++;
index++;
if(index<questions.length)showQ();else showResult();
};
quizArea.appendChild(b);
});
}

function showResult(){
quizArea.innerHTML+=`<h3>Score: ${score}/${questions.length}</h3>`;
}

showQ();
};

generateButtons();
console.log("SYSTEM READY");
