// ======================================
// MWANIKI SCHOLARS QUIZ ENGINE
// ======================================


const quizQuestions = {


"Anatomy Unit 1":[

{
question:"What is the study of body structures called?",
options:[
"Physiology",
"Anatomy",
"Pharmacology",
"Pathology"
],
answer:"Anatomy"
},


{
question:"The basic structural unit of the human body is:",
options:[
"Organ",
"Tissue",
"Cell",
"System"
],
answer:"Cell"
},


{
question:"The anatomical position describes the body:",
options:[
"Standing upright facing forward",
"Sitting down",
"Lying down",
"Running"
],
answer:"Standing upright facing forward"
}


],




"Physiology Unit 1":[


{
question:"The process of maintaining internal balance is called:",
options:[
"Homeostasis",
"Metabolism",
"Respiration",
"Digestion"
],
answer:"Homeostasis"
},


{
question:"The powerhouse of the cell is:",
options:[
"Nucleus",
"Mitochondria",
"Ribosome",
"Golgi body"
],
answer:"Mitochondria"
}



],





"Microbiology Unit 1":[


{
question:"Microbiology is the study of:",
options:[
"Human bones",
"Microorganisms",
"Drugs",
"Organs"
],
answer:"Microorganisms"
},


{
question:"Bacteria are classified as:",
options:[
"Prokaryotes",
"Eukaryotes",
"Viruses",
"Fungi"
],
answer:"Prokaryotes"
}


]


};




// ======================================
// OPEN QUIZ
// ======================================


window.openQuiz=function(unitName){



const quizArea=

document.getElementById("quizArea");



const questions=

quizQuestions[unitName];



if(!questions){


quizArea.innerHTML=

`

<h3>
📝 Quiz Coming Soon
</h3>

<p>
Questions are being prepared.
</p>

`;


return;


}




let score=0;



quizArea.innerHTML=

`

<h2>
📝 ${unitName}
</h2>

<div id="questionBox"></div>

<button id="submitQuiz">
Submit Quiz
</button>

`;



const box=

document.getElementById("questionBox");





questions.forEach((q,index)=>{


box.innerHTML+=


`

<div class="unit-card">

<h4>

${index+1}. ${q.question}

</h4>


${q.options.map(option=>


`

<label>

<input

type="radio"

name="q${index}"

value="${option}">

${option}

</label>

<br>


`

).join("")}


</div>


`;



});





document

.getElementById("submitQuiz")

.onclick=function(){



score=0;



questions.forEach((q,index)=>{


const selected=

document.querySelector(

`input[name="q${index}"]:checked`

);



if(selected && selected.value===q.answer){

score++;

}


});




quizArea.innerHTML=

`

<div class="unit-card">


<h2>
🎉 Quiz Complete
</h2>


<h3>

Score: ${score}/${questions.length}

</h3>


<p>

Keep learning and improving.

</p>


</div>

`;





saveProgress(score,questions.length);



};



};





// ======================================
// SAVE PROGRESS
// ======================================


function saveProgress(score,total){


let progress=

JSON.parse(

localStorage.getItem("progress")

)||[];



progress.push({

score:score,

total:total,

date:new Date().toLocaleDateString()

});



localStorage.setItem(

"progress",

JSON.stringify(progress)

);



const progressBox=

document.getElementById("progress");


if(progressBox){


progressBox.innerHTML=

`

${score}/${total}

`;

}


}




console.log(

"📝 Quiz engine loaded"

);