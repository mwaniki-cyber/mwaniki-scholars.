import { initializeApp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {

getAuth,

createUserWithEmailAndPassword,

signInWithEmailAndPassword,

signOut,

onAuthStateChanged

}

from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";



/* =========================
   FIREBASE CONFIG
========================= */


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




console.log("Firebase connected");




/* =========================
   PAGE ELEMENTS
========================= */


const authSection = document.getElementById("authSection");

const courseArea = document.getElementById("courseArea");

const adminPanel = document.getElementById("adminPanel");


const searchInput = document.getElementById("searchInput");

const courseButtons = document.getElementById("courseButtons");

const courseContent = document.getElementById("courseContent");

const quizArea = document.getElementById("quizArea");






/* =========================
   COURSES
========================= */


const medicalCourseNames = [

"Anatomy",

"Physiology",

"Biochemistry",

"Pathology",

"Pharmacology",

"Microbiology",

"Hematology",

"Immunology",

"Genetics",

"Histology",

"Embryology",

"Neuroscience",

"Cardiology",

"Neurology",

"Dermatology",

"Endocrinology",

"Gastroenterology",

"Nephrology",

"Pulmonology",

"Rheumatology",

"Oncology",

"Radiology",

"Surgery",

"Orthopedics",

"Urology",

"Anesthesiology",

"Emergency Medicine",

"Internal Medicine",

"Family Medicine",

"Geriatrics",

"Pediatrics",

"Neonatology",

"Obstetrics",

"Gynecology",

"Psychiatry",

"Ophthalmology",

"ENT",

"Dentistry",

"Public Health",

"Epidemiology",

"Biostatistics",

"Community Medicine",

"Infectious Diseases",

"Toxicology",

"Forensic Medicine",

"Sports Medicine",

"Critical Care",

"Pain Medicine",

"Nuclear Medicine",

"Plastic Surgery",

"Cardiothoracic Surgery",

"Vascular Surgery",

"Neurosurgery",

"General Surgery",

"Trauma Medicine",

"Reproductive Medicine",

"Clinical Research",

"Medical Ethics",

"Health Informatics",

"Telemedicine",

"Nutrition",

"Physiotherapy",

"Palliative Care",

"Rehabilitation Medicine",

"Sleep Medicine",

"Transfusion Medicine",

"Laboratory Medicine",

"Clinical Pharmacology",

"Preventive Medicine",

"Lifestyle Medicine",

"Tropical Medicine",

"Disaster Medicine",

"Addiction Medicine",

"Gastro Surgery",

"Neuro Radiology",

"Cardiac Imaging",

"Medical Education"

];




const courses = {};



medicalCourseNames.forEach(course=>{


courses[course]={

units:[]

};



for(let i=1;i<=5;i++){


courses[course].units.push({

title:`${course} Unit ${i}`,

notes:`${course} study materials`,

file:`${course.replaceAll(" ","_")}_Unit${i}.pdf`

});


}


});





/* =========================
   AUTH STATE
========================= */


onAuthStateChanged(auth,(user)=>{


if(user){


if(authSection)

authSection.style.display="none";


if(courseArea)

courseArea.style.display="block";



if(user.email==="admin@mwaniki.com"){


if(adminPanel)

adminPanel.style.display="block";


loadAdminCourses();


}


generateCourseButtons();


}

else{


if(authSection)

authSection.style.display="block";


if(courseArea)

courseArea.style.display="none";


if(adminPanel)

adminPanel.style.display="none";


}


});





/* =========================
   SIGN UP
========================= */


window.signUp=function(){


const email =
document.getElementById("email").value;


const password =
document.getElementById("password").value;



createUserWithEmailAndPassword(

auth,

email,

password

)

.then(()=>{


alert("Account created successfully");


})


.catch(error=>{


alert(error.message);


});


};






/* =========================
   LOGIN
========================= */


window.login=function(){


const email =
document.getElementById("email").value;



const password =
document.getElementById("password").value;



signInWithEmailAndPassword(

auth,

email,

password

)

.then(()=>{


alert("Login successful");


})


.catch(error=>{


alert(error.message);


});


};






/* =========================
   LOGOUT
========================= */


window.logout=function(){


signOut(auth);


};
/* =========================
   COURSE SEARCH
========================= */


if(searchInput){

searchInput.addEventListener(

"input",

generateCourseButtons

);

}





function generateCourseButtons(){


if(!courseButtons) return;


courseButtons.innerHTML="";


const filter =

searchInput ?

searchInput.value.toLowerCase()

:

"";



Object.keys(courses)

.filter(course =>

course.toLowerCase().includes(filter)

)

.forEach(course=>{


const button=document.createElement("button");


button.textContent=course;


button.className="courseBtn";


button.onclick=()=>loadCourse(course);


courseButtons.appendChild(button);



});


}






/* =========================
   LOAD COURSE
========================= */


function loadCourse(courseName){


if(!courseContent) return;



courseContent.innerHTML=

`

<h2>${courseName}</h2>

`;



courses[courseName].units.forEach(unit=>{


courseContent.innerHTML+=


`

<div class="unitCard">


<h3>${unit.title}</h3>


<p>${unit.notes}</p>



<button onclick="downloadNotes('${unit.file}')">

📥 Download Notes

</button>



<button onclick="startQuiz('${courseName}')">

📝 Start Quiz

</button>



</div>

`;


});


}







/* =========================
   GITHUB NOTES DOWNLOAD
========================= */


window.downloadNotes=function(file){


const githubURL=

"https://mwaniki-cyber.github.io/mwaniki-scholars/notes/";



window.open(

githubURL + file,

"_blank"

);


};







/* =========================
   ADMIN COURSE LIST
========================= */


function loadAdminCourses(){


const select =

document.getElementById("courseSelect");



if(!select) return;



select.innerHTML="";



medicalCourseNames.forEach(course=>{


const option=document.createElement("option");


option.value=course;


option.textContent=course;


select.appendChild(option);



});


}






/* =========================
   GITHUB UPLOAD SYSTEM
========================= */


window.uploadNotes = async function(){



const fileInput =

document.getElementById("noteFile");



const courseSelect =

document.getElementById("courseSelect");



const unitSelect =

document.getElementById("unitSelect");



const status =

document.getElementById("uploadStatus");



const progress =

document.getElementById("uploadProgress");




if(!fileInput || !courseSelect || !unitSelect){


alert("Upload section missing");


return;


}





const file = fileInput.files[0];



if(!file){


alert("Choose a file first");


return;


}




status.innerHTML="⏳ Uploading...";





const data = new FormData();



data.append(

"file",

file

);



data.append(

"course",

courseSelect.value

);



data.append(

"unit",

unitSelect.value

);





try{



const response = await fetch(

"http://localhost:5000/upload",

{

method:"POST",

body:data

}

);





const result = await response.json();





if(result.success){



status.innerHTML=

`

✅ Upload successful

<br>

${result.file}

`;



if(progress)

progress.innerHTML="100%";



}

else{


status.innerHTML=

"❌ "+result.error;


}



}



catch(error){


console.error(error);



status.innerHTML=

`

❌ Upload failed.

<br>

Start the upload server first.

`;



}


};







/* =========================
   QUIZ SYSTEM
========================= */


window.startQuiz=function(course){


if(!quizArea) return;



quizArea.innerHTML=

`

<h2>${course} Quiz</h2>

`;



for(let i=1;i<=10;i++){



quizArea.innerHTML+=


`

<div class="unitCard">


<p>

${i}. ${course} examination question ${i}

</p>


<button onclick="this.style.background='green'">

Correct Answer

</button>



<button onclick="this.style.background='red'">

Wrong Answer

</button>



</div>

`;



}



};







console.log("Mwaniki Scholars Loaded Successfully 🚀");