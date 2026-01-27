// ================= Firebase Imports =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ================= Firebase Config =================
const firebaseConfig = {
  apiKey: "AIzaSyDKmg8OT4hdG_bNIWTapfY5cP9dM2kyGps",
  authDomain: "mwaniki-scholars.firebaseapp.com",
  projectId: "mwaniki-scholars",
  storageBucket: "mwaniki-scholars.firebasestorage.app",
  messagingSenderId: "383333905328",
  appId: "1:383333905328:web:082e968df7bf4093999c75"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ================= UI Elements =================
const authSection = document.querySelector(".auth-box");
const courseArea = document.getElementById("courseArea");
const message = document.getElementById("message");

// ================= Courses Data =================
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

// Generate dummy content for each course
medicalCourseNames.forEach(course => {
  courses[course] = {
    units: Array.from({ length: 5 }, (_, i) => ({
      title: `${course} Unit ${i+1}`,
      notes: `${course} is a vital medical subject focusing on patient care, disease understanding, and clinical practice.`,
      image: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Human_anatomy.png"
    }))
  };
});

// ================= Auth State =================
onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.style.display = "none";
    courseArea.style.display = "block";
    message.textContent = `Welcome, ${user.email}`;
    generateCourseButtons();
  } else {
    authSection.style.display = "block";
    courseArea.style.display = "none";
    message.textContent = "";
  }
});

// ================= Sign Up =================
window.signUp = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Account created! ✅"))
    .catch(err => alert(err.message));
};

// ================= Login =================
window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => alert("Login successful 🎉"))
    .catch(err => alert(err.message));
};

// ================= Logout =================
window.logout = function () {
  signOut(auth)
    .then(() => alert("Logged out 👋"))
    .catch(err => alert(err.message));
};

// ================= Generate Course Buttons =================
function generateCourseButtons() {
  const container = document.getElementById("courseButtons");
  container.innerHTML = "";

  Object.keys(courses).forEach(course => {
    const btn = document.createElement("button");
    btn.textContent = course;
    btn.className = "courseBtn";
    btn.addEventListener("click", () => loadCourse(course));
    container.appendChild(btn);
  });
}

// ================= Load Course Content =================
function loadCourse(courseName) {
  const content = document.getElementById("courseContent");
  content.innerHTML = `<h2>${courseName}</h2>`;

  courses[courseName].units.forEach(unit => {
    const unitDiv = document.createElement("div");
    unitDiv.className = "unitCard";

    const titleEl = document.createElement("h3");
    titleEl.textContent = unit.title;

    const notesEl = document.createElement("p");
    notesEl.textContent = unit.notes;

    const imgEl = document.createElement("img");
    imgEl.src = unit.image;
    imgEl.width = 250;

    const quizBtn = document.createElement("button");
    quizBtn.textContent = "Start Quiz";
    quizBtn.addEventListener("click", () => startQuiz(courseName));

    unitDiv.append(titleEl, notesEl, imgEl, quizBtn);
    content.appendChild(unitDiv);
  });
}

// ================= Generate Dummy Quiz =================
function generateQuiz(course) {
  return Array.from({ length: 20 }, (_, i) => ({
    question: `${course} Question ${i+1}`,
    options: ["A", "B", "C", "D"],
    answer: "A"
  }));
}

// ================= Start Quiz =================
window.startQuiz = function(course) {
  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `<h2>${course} Quiz</h2>`;

  const quiz = generateQuiz(course);

  quiz.forEach((q, index) => {
    const questionEl = document.createElement("p");
    questionEl.textContent = `${index + 1}. ${q.question}`;

    quizArea.appendChild(questionEl);

    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        if (opt === q.answer) alert("Correct ✅"); 
        else alert("Wrong ❌");
      });
      quizArea.appendChild(btn);
    });

    const hr = document.createElement("hr");
    quizArea.appendChild(hr);
  });
};

console.log("SCRIPT LOADED ✅");
