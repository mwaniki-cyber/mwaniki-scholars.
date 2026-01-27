import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

// UI
const authSection = document.getElementById("authSection");
const courseArea = document.getElementById("courseArea");
const message = document.getElementById("message");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// AUTH STATE
onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.style.display = "none";
    courseArea.style.display = "block";
    message.textContent = `Welcome ${user.email}`;
    generateCourseButtons();
  } else {
    authSection.style.display = "block";
    courseArea.style.display = "none";
  }
});

// AUTH
window.signUp = () =>
  createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
    .then(() => alert("Account created!"))
    .catch(err => alert(err.message));

window.login = () =>
  signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
    .then(() => alert("Login successful"))
    .catch(err => alert(err.message));

window.logout = () => signOut(auth);

// 🧠 FULL MEDICAL COURSE LIST
const medicalCourseNames = [
"Anatomy","Physiology","Biochemistry","Pathology","Pharmacology","Microbiology","Hematology",
"Immunology","Genetics","Histology","Embryology","Neuroscience","Cardiology","Neurology",
"Dermatology","Endocrinology","Gastroenterology","Nephrology","Pulmonology","Rheumatology",
"Oncology","Radiology","Surgery","Orthopedics","Urology","Anesthesiology","Emergency Medicine",
"Internal Medicine","Family Medicine","Geriatrics","Pediatrics","Neonatology","Obstetrics",
"Gynecology","Psychiatry","Ophthalmology","ENT","Dentistry","Public Health","Epidemiology",
"Biostatistics","Community Medicine","Infectious Diseases","Toxicology","Forensic Medicine",
"Sports Medicine","Critical Care","Pain Medicine","Nuclear Medicine","Plastic Surgery",
"Cardiothoracic Surgery","Vascular Surgery","Neurosurgery","General Surgery","Trauma Medicine",
"Reproductive Medicine","Clinical Research","Medical Ethics","Health Informatics",
"Telemedicine","Nutrition","Physiotherapy","Palliative Care","Rehabilitation Medicine",
"Sleep Medicine","Transfusion Medicine","Laboratory Medicine","Clinical Pharmacology",
"Preventive Medicine","Lifestyle Medicine","Tropical Medicine","Disaster Medicine",
"Addiction Medicine","Gastro Surgery","Neuro Radiology","Cardiac Imaging","Medical Education"
];

// COURSE CONTENT
const courses = {};
medicalCourseNames.forEach(course => {
  courses[course] = {
    units: Array.from({ length: 5 }, (_, i) => ({
      title: `${course} Unit ${i+1}`,
      notes: `Detailed clinical concepts and exam-focused notes for ${course}.`,
      image: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Human_anatomy.png"
    }))
  };
});

// BUTTONS
function generateCourseButtons() {
  const container = document.getElementById("courseButtons");
  container.innerHTML = "";
  Object.keys(courses).forEach(course => {
    const btn = document.createElement("button");
    btn.textContent = course;
    btn.className = "courseBtn";
    btn.onclick = () => loadCourse(course);
    container.appendChild(btn);
  });
}

// LOAD COURSE
function loadCourse(courseName) {
  const content = document.getElementById("courseContent");
  content.innerHTML = `<h2>${courseName}</h2>`;
  courses[courseName].units.forEach(unit => {
    content.innerHTML += `
      <div class="unitCard">
        <h3>${unit.title}</h3>
        <p>${unit.notes}</p>
        <img src="${unit.image}" width="200">
        <button onclick="startQuiz('${courseName}')">Start Quiz</button>
      </div>`;
  });
}

// QUIZ
function generateQuiz(course) {
  return Array.from({length:10}, (_,i)=>({
    question:`${course} clinical exam question ${i+1}?`,
    options:["A","B","C","D"],
    answer:"A"
  }));
}

window.startQuiz = (course) => {
  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `<h2>${course} Quiz</h2>`;
  generateQuiz(course).forEach((q,i)=>{
    quizArea.innerHTML += `<p><b>${i+1}. ${q.question}</b></p>`;
    q.options.forEach(opt=>{
      quizArea.innerHTML += `<button onclick="alert('${opt===q.answer?"Correct":"Wrong"}')">${opt}</button>`;
    });
    quizArea.innerHTML += "<hr>";
  });
};

console.log("FULL SYSTEM LOADED ✅");
