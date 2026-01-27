import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { notes } from "./notes.js";
import { quizBank } from "./quizbank.js";
import { books } from "./books.js";

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

window.signUp = () => createUserWithEmailAndPassword(auth,email.value,password.value);
window.login = () => signInWithEmailAndPassword(auth,email.value,password.value);
window.logout = () => signOut(auth);

onAuthStateChanged(auth,user=>{
  if(user){
    authSection.style.display="none";
    courseArea.style.display="block";
    generateCourseButtons();
  } else {
    authSection.style.display="block";
    courseArea.style.display="none";
  }
});

function generateCourseButtons(){
  const container=document.getElementById("courseButtons");
  container.innerHTML="";
  Object.keys(notes).forEach(course=>{
    const btn=document.createElement("button");
    btn.textContent=course;
    btn.className="courseBtn";
    btn.onclick=()=>loadCourse(course);
    container.appendChild(btn);
  });
}

function loadCourse(course){
  const content=document.getElementById("courseContent");
  content.innerHTML=`<h2>${course}</h2>`;

  notes[course].forEach(unit=>{
    content.innerHTML+=`
      <div class="unitCard">
        <h3>${unit.title}</h3>
        <p>${unit.text}</p>
        <img src="${unit.image}" width="250">
        <button onclick="startQuiz('${course}')">Take Quiz</button>
      </div>`;
  });

  loadBooks(course);
}

window.startQuiz=(course)=>{
  const quizArea=document.getElementById("quizArea");
  quizArea.innerHTML=`<h2>${course} Quiz</h2>`;
  quizBank[course].forEach(q=>{
    quizArea.innerHTML+=`<p>${q.q}</p>`;
  });
};

function loadBooks(course){
  const area=document.getElementById("booksArea");
  area.innerHTML="<h2>Books</h2>";
  books[course]?.forEach(b=>{
    area.innerHTML+=`<a href="${b.link}" target="_blank">${b.title}</a><br>`;
  });
}
export const notes = {
Anatomy: [
  {
    title:"Skeletal System",
    text:"The human skeleton has 206 bones providing support and protection.",
    image:"https://upload.wikimedia.org/wikipedia/commons/3/3d/Human_skeleton_front_en.svg"
  },
  {
    title:"Muscular System",
    text:"Muscles produce movement via contraction.",
    image:"https://upload.wikimedia.org/wikipedia/commons/2/2c/Muscular_system.svg"
  }
],
Physiology: [
  {
    title:"Cardiac Physiology",
    text:"The heart pumps blood via coordinated electrical impulses.",
    image:"https://upload.wikimedia.org/wikipedia/commons/0/0b/Heart_diagram-en.svg"
  }
]
};
export const quizBank = {
Anatomy: [
  { q:"How many bones in adult human body?" },
  { q:"Which bone protects the brain?" }
],
Physiology: [
  { q:"What controls heart rhythm?" }
]
};
export const books = {
Anatomy:[
  { title:"Gray's Anatomy", link:"https://example.com/grays" }
],
Physiology:[
  { title:"Guyton Physiology", link:"https://example.com/guyton" }
]
};
