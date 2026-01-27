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
  apiKey: "YOUR_API_KEY",
  authDomain: "mwaniki-scholars.firebaseapp.com",
  projectId: "mwaniki-scholars",
  storageBucket: "mwaniki-scholars.firebasestorage.app",
  messagingSenderId: "383333905328",
  appId: "1:383333905328:web:082e968df7bf4093999c75"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ================= UI Elements =================
const authSection = document.querySelector(".auth-box");
const courseArea = document.getElementById("courseArea");
const message = document.getElementById("message");

// ================= Courses =================
const medicalCourseNames = [
  "Anatomy","Physiology","Biochemistry","Pathology","Pharmacology","Microbiology",
  "Pediatrics","Obstetrics","Gynecology","Surgery","Psychiatry","Radiology"
];

const courses = {};
medicalCourseNames.forEach(course => {
  courses[course] = {
    units: Array.from({ length: 3 }, (_, i) => ({
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
  }
});

// ================= Auth Functions =================
window.signUp = () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  createUserWithEmailAndPassword(auth, email, password)
    .then(() => alert("Account created!"))
    .catch(err => alert(err.message));
};

window.login = () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  signInWithEmailAndPassword(auth, email, password)
    .then(() => alert("Login successful"))
    .catch(err => alert(err.message));
};

window.logout = () => signOut(auth);

// ================= Generate Course Buttons =================
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

// ================= Load Course =================
function loadCourse(courseName) {
  const content = document.getElementById("courseContent");
  content.innerHTML = `<h2>${courseName}</h2>`;

  courses[courseName].units.forEach(unit => {
    const div = document.createElement("div");
    div.className = "unitCard";
    div.innerHTML = `
      <h3>${unit.title}</h3>
      <p>${unit.notes}</p>
      <img src="${unit.image}" width="200">
      <button onclick="startQuiz('${courseName}')">Start Quiz</button>
    `;
    content.appendChild(div);
  });
}

// ================= REAL EXAM STYLE QUIZ =================
function generateQuiz(course) {
  return Array.from({ length: 10 }, (_, i) => ({
    question: `${course} clinical question ${i+1}: Choose the correct answer.`,
    options: [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    answer: 0
  }));
}

window.startQuiz = function(course) {
  const quizArea = document.getElementById("quizArea");
  quizArea.innerHTML = `<h2>${course} Exam Quiz</h2>`;

  const quiz = generateQuiz(course);
  let score = 0;

  quiz.forEach((q, index) => {
    const qDiv = document.createElement("div");
    qDiv.innerHTML = `<p><b>${index+1}. ${q.question}</b></p>`;

    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.textContent = opt;
      btn.onclick = () => {
        if (i === q.answer) {
          btn.style.background = "green";
          score++;
        } else {
          btn.style.background = "red";
        }
        btn.disabled = true;
      };
      qDiv.appendChild(btn);
    });

    quizArea.appendChild(qDiv);
    quizArea.appendChild(document.createElement("hr"));
  });

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Submit Exam";
  submitBtn.onclick = () => {
    quizArea.innerHTML += `<h3>Your Score: ${score}/${quiz.length}</h3>`;
  };
  quizArea.appendChild(submitBtn);
};

console.log("APP FULLY LOADED 🚀");
