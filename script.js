import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ================= FIREBASE ================= */
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

/* ================= UI ELEMENTS ================= */
const authSection = document.getElementById("authSection");
const courseArea = document.getElementById("courseArea");
const message = document.getElementById("message");
const adminPanel = document.getElementById("adminPanel");

/* ================= AUTH STATE ================= */
onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.style.display = "none";
    courseArea.style.display = "block";
    message.textContent = "Welcome " + user.email;
    generateCourseButtons();

    if (user.email === "admin@mwaniki.com") {
      adminPanel.style.display = "block";
    }
  } else {
    authSection.style.display = "block";
    courseArea.style.display = "none";
    adminPanel.style.display = "none";
    message.textContent = "";
  }
});

/* ================= AUTH FUNCTIONS ================= */
window.signUp = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Account created successfully"))
    .catch(err => alert(err.message));
};

window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => alert("Login successful"))
    .catch(err => alert(err.message));
};

window.logout = function () {
  signOut(auth);
};

/* ================= COURSES ================= */
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
"Neuro Radiology","Cardiac Imaging","Medical Education"
];

const courses = {};
medicalCourseNames.forEach(c => {
  courses[c] = {
    units: Array.from({ length: 5 }, (_, i) => ({
      title: `${c} Unit ${i + 1}`,
      notes: `${c} clinical concepts, diagnostics, and management at university level.`,
      image: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Human_anatomy.png"
    }))
  };
});

/* ================= COURSE BUTTONS ================= */
function generateCourseButtons() {
  const box = document.getElementById("courseButtons");
  box.innerHTML = "";
  Object.keys(courses).forEach(c => {
    const btn = document.createElement("button");
    btn.textContent = c;
    btn.className = "courseBtn";
    btn.onclick = () => loadCourse(c);
    box.appendChild(btn);
  });
}

/* ================= LOAD COURSE ================= */
function loadCourse(name) {
  const content = document.getElementById("courseContent");
  content.innerHTML = `<h2>${name}</h2>`;
  courses[name].units.forEach(u => {
    content.innerHTML += `
      <div class="unitCard">
      <h3>${u.title}</h3>
      <p>${u.notes}</p>
      <img src="${u.image}" width="200">
      <button onclick="startQuiz('${name}')">Start Quiz</button>
      </div>`;
  });
}

/* ================= QUIZ ================= */
function generateQuiz(course) {
  const answers = ["A", "B", "C", "D"];
  return Array.from({ length: 20 }, (_, i) => ({
    question: `${course} clinical question ${i + 1}?`,
    options: ["A", "B", "C", "D"],
    answer: answers[Math.floor(Math.random() * 4)]
  }));
}

window.startQuiz = function (course) {
  const area = document.getElementById("quizArea");
  let score = 0;
  let time = 300;

  const quiz = generateQuiz(course);
  area.innerHTML = `<h2>${course} Quiz</h2><div class="timer">Time: <span id="time">${time}</span>s</div>`;

  const timer = setInterval(() => {
    time--;
    document.getElementById("time").textContent = time;
    if (time <= 0) {
      clearInterval(timer);
      alert("Time up! Score: " + score);
    }
  }, 1000);

  quiz.forEach((q, i) => {
    area.innerHTML += `<p>${i + 1}. ${q.question}</p>`;
    q.options.forEach(opt => {
      const b = document.createElement("button");
      b.textContent = opt;
      b.onclick = () => { if (opt === q.answer) score++; };
      area.appendChild(b);
    });
    area.innerHTML += "<hr>";
  });
};

/* ================= ADMIN ================= */
window.addCourse = function () {
  const name = document.getElementById("newCourseName").value;
  courses[name] = {
    units: [{ title: name + " Intro", notes: "Admin added course.", image: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Human_anatomy.png" }]
  };
  generateCourseButtons();
};

console.log("SYSTEM STABLE ✅");
