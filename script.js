import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ---------------- FIREBASE ---------------- */
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

/* ---------------- UI ---------------- */
const authSection = document.getElementById("authSection");
const courseArea = document.getElementById("courseArea");
const adminPanel = document.getElementById("adminPanel");
const searchInput = document.getElementById("searchInput");

/* ---------------- COURSES (84) ---------------- */
const medicalCourseNames = [
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

const courses = {};
medicalCourseNames.forEach(course=>{
  courses[course]={units:Array.from({length:5},(_,i)=>({
    title:`${course} Unit ${i+1}`,
    notes:`University-level ${course} concepts, diagnostics, and clinical practice.`,
    file:`${course.replace(/\s/g,"_")}_Unit${i+1}.txt`
  }))};
});

/* ---------------- AUTH ---------------- */
onAuthStateChanged(auth,user=>{
  if(user){
    authSection.style.display="none";
    courseArea.style.display="block";
    if(user.email==="admin@mwaniki.com") adminPanel.style.display="block";
    generateCourseButtons();
  } else {
    authSection.style.display="block";
    courseArea.style.display="none";
    adminPanel.style.display="none";
  }
});

window.signUp=()=>createUserWithEmailAndPassword(auth,email.value,password.value);
window.login=()=>signInWithEmailAndPassword(auth,email.value,password.value);
window.logout=()=>signOut(auth);

/* ---------------- SEARCH ---------------- */
searchInput.addEventListener("input",generateCourseButtons);

/* ---------------- COURSE BUTTONS ---------------- */
function generateCourseButtons(){
  const container=document.getElementById("courseButtons");
  container.innerHTML="";
  const filter=searchInput.value.toLowerCase();
  Object.keys(courses).filter(c=>c.toLowerCase().includes(filter)).forEach(course=>{
    const btn=document.createElement("button");
    btn.textContent=course;
    btn.className="courseBtn";
    btn.onclick=()=>loadCourse(course);
    container.appendChild(btn);
  });
}

/* ---------------- LOAD COURSE ---------------- */
function loadCourse(courseName){
  const content=document.getElementById("courseContent");
  content.innerHTML=`<h2>${courseName}</h2>`;
  courses[courseName].units.forEach((unit,idx)=>{
    content.innerHTML+=`
    <div class="unitCard">
      <h3>${unit.title}</h3>
      <p>${unit.notes}</p>
      <button onclick="downloadNotes('${unit.file}')">Download Notes</button>
      <button onclick="startQuiz('${courseName}',${idx})">Start Quiz</button>
    </div>`;
  });
}

/* ---------------- DOWNLOAD NOTES ---------------- */
window.downloadNotes=file=>{
  const blob=new Blob([file+" study notes"],{type:"text/plain"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=file;
  a.click();
};

/* ---------------- QUIZ ENGINE ---------------- */
function generateQuiz(course,unit){
  return Array.from({length:40},(_,i)=>{
    const answers=["A","B","C","D"];
    const correct=answers[Math.floor(Math.random()*4)];
    return {
      question:`${course} Unit ${unit+1} clinical exam question ${i+1}: What is the correct concept?`,
      options:{A:"Option A",B:"Option B",C:"Option C",D:"Option D"},
      answer:correct
    };
  });
}

window.startQuiz=(course,unit)=>{
  const quizArea=document.getElementById("quizArea");
  const quiz=generateQuiz(course,unit);
  let score=0;
  let time=1200;
  quizArea.innerHTML=`<div class="timer">Time Left: <span id="t">${time}</span>s</div><h3>${course} Quiz</h3>`;

  const timer=setInterval(()=>{
    time--; document.getElementById("t").textContent=time;
    if(time<=0){clearInterval(timer);finish();}
  },1000);

  quiz.forEach((q,i)=>{
    const div=document.createElement("div");
    div.innerHTML=`<p>${i+1}. ${q.question}</p>`;
    Object.keys(q.options).forEach(k=>{
      const btn=document.createElement("button");
      btn.textContent=`${k}. ${q.options[k]}`;
      btn.onclick=()=>{
        if(btn.disabled)return;
        if(k===q.answer){score++;btn.style.background="green";}
        else btn.style.background="red";
        Array.from(div.querySelectorAll("button")).forEach(b=>b.disabled=true);
      };
      div.appendChild(btn);
    });
    quizArea.appendChild(div);
  });

  const submit=document.createElement("button");
  submit.textContent="Submit Quiz";
  submit.onclick=finish;
  quizArea.appendChild(submit);

  function finish(){
    quizArea.innerHTML+=`<div class="resultBox">Score: ${score}/40 (${Math.round(score/40*100)}%)</div>`;
  }
};

console.log("APP FULLY LOADED 🚀");
