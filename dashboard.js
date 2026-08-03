import { courses } from "./courses.js";


// ================================
// ELEMENTS
// ================================


const courseList =
document.getElementById("courseList");


const search =
document.getElementById("courseSearch");


const notesArea =
document.getElementById("notesArea");


const quizArea =
document.getElementById("quizArea");





// ================================
// LOAD COURSES
// ================================


function loadCourses(filter=""){


courseList.innerHTML="";



Object.keys(courses)

.filter(course=>

course.toLowerCase()

.includes(filter.toLowerCase())

)


.forEach(course=>{


const div=document.createElement("div");


div.className="course-item";


div.innerHTML=

`
<h3>📚 ${course}</h3>

<p>
${courses[course].units.length} Units Available
</p>
`;



div.onclick=()=>{


showUnits(course);


};



courseList.appendChild(div);



});



}




// ================================
// SHOW UNITS
// ================================



function showUnits(course){


notesArea.innerHTML=

`

<h3>
${course} Notes
</h3>

`;



quizArea.innerHTML=

`

<h3>
${course} Quiz
</h3>

<p>
Select a unit to start questions.
</p>

`;





courses[course].units.forEach(unit=>{



const card=document.createElement("div");


card.className="unit-card";



card.innerHTML=

`

<h4>
📖 ${unit.title}
</h4>


<p>
${unit.notes}
</p>


<button>

📄 Open Notes

</button>


<button>

📝 Quiz

</button>

`;





const buttons=card.querySelectorAll("button");




// NOTES BUTTON


buttons[0].onclick=()=>{


const url=

"https://mwaniki-cyber.github.io/mwaniki-scholars/notes/"

+

unit.file;



window.open(url,"_blank");


};




// QUIZ BUTTON


buttons[1].onclick=()=>{


quizArea.innerHTML=

`

<h3>
📝 ${unit.title} Quiz
</h3>


<p>
Quiz system loading...
</p>

`;



};



notesArea.appendChild(card);



});



}





// ================================
// SEARCH
// ================================


search.addEventListener(

"input",

()=>{


loadCourses(search.value);


}

);





// ================================
// START
// ================================


loadCourses();



console.log(
"🎓 Student dashboard loaded"
);