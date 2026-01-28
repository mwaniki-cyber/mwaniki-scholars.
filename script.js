import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKmg8OT4hdG_bNIWTapfY5cP9dM2kyGps",
  authDomain: "mwaniki-scholars.firebaseapp.com",
  projectId: "mwaniki-scholars",
  storageBucket: "mwaniki-scholars.appspot.com",
  messagingSenderId: "383333905328",
  appId: "1:383333905328:web:082e968df7bf4093999c75"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const courses = [
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
"Gastro Surgery","Neuro Radiology","Cardiac Imaging","Medical Education",
"Allergy & Clinical Immunology","Andrology","Audiology","Burns & Plastic Reconstruction",
"Clinical Neurophysiology","Colorectal Surgery","Diabetology","Fetal Medicine"
];

const authSection = document.getElementById("authSection");
const courseArea = document.getElementById("courseArea");
const adminPanel = document.getElementById("adminPanel");
const message = document.getElementById("message");

onAuthStateChanged(auth, user => {
  if (user) {
    authSection.style.display = "none";
    courseArea.style.display = "block";
    message.textContent = "Welcome " + user.email;
    if (user.email === "admin@mwaniki.com") adminPanel.style.display = "block";
    generateCourseButtons();
  } else {
    authSection.style.display = "block";
    courseArea.style.display = "none";
  }
});

window.signUp = () => {
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then(()=>alert("Account created"))
    .catch(e=>alert(e.message));
};

window.login = () => {
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(()=>alert("Logged in"))
    .catch(e=>alert(e.message));
};

window.logout = () => signOut(auth);

function generateCourseButtons(){
  const div = document.getElementById("courseButtons");
  div.innerHTML="";
  courses.forEach(c=>{
    const b=document.createElement("button");
    b.textContent=c;
    b.className="courseBtn";
    b.onclick=()=>loadCourse(c);
    div.appendChild(b);
  });
}

function loadCourse(course){
  const content=document.getElementById("courseContent");
  content.innerHTML=`<h2>${course}</h2>`;
  for(let i=1;i<=5;i++){
    content.innerHTML+=`
      <div class="unitCard">
        <h3>${course} Unit ${i}</h3>
        <p>University-level notes covering clinical principles, pathology, diagnostics and management.</p>
        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6e/Human_anatomy.png" width="200">
        <br>
        <a href="#" download>📥 Download Notes</a>
        <button onclick="startQuiz('${course}')">Start Quiz</button>
      </div>`;
  }
}

function generateQuiz(course){
  const q=[];
  const answers=["A","B","C","D"];
  for(let i=1;i<=10;i++){
    q.push({
      question:`${course} clinical question ${i}?`,
      options:["Option A","Option B","Option C","Option D"],
      answer:answers[i%4]
    });
  }
  return q;
}

window.startQuiz=(course)=>{
  const area=document.getElementById("quizArea");
  const quiz=generateQuiz(course);
  let score=0;
  let time=120;
  const timer=setInterval(()=>{
    time--;
    if(time<=0){clearInterval(timer); finish();}
  },1000);

  area.innerHTML=`<h2>${course} Quiz</h2><p>Time Left: <span id="t">${time}</span>s</p>`;
  const tSpan=area.querySelector("#t");

  quiz.forEach((q,i)=>{
    const p=document.createElement("p");
    p.textContent=(i+1)+". "+q.question;
    area.appendChild(p);
    q.options.forEach(opt=>{
      const b=document.createElement("button");
      b.textContent=opt;
      b.onclick=()=>{if(opt===q.options["ABCD".indexOf(q.answer)])score++;};
      area.appendChild(b);
    });
  });

  function finish(){
    area.innerHTML+=`<h3>Score: ${score}/${quiz.length}</h3>`;
  }
};
