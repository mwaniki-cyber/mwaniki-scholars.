// =================================
// AI TUTOR + CONSULTATION SYSTEM
// =================================



window.askAI=function(){


const question=

document.getElementById("aiQuestion").value;



const answer=

document.getElementById("aiAnswer");



if(!question){

answer.innerHTML=

"⚠️ Please enter a question.";

return;

}



answer.innerHTML=

`

<div class="unit-card">

<h3>
🤖 AI Tutor Response
</h3>


<p>

I received your question:

<b>${question}</b>

</p>


<p>

Your AI tutor connection is ready.
The advanced medical AI engine will be connected here.

</p>


</div>

`;



};








window.bookTutor=function(){


const name=

document.getElementById("studentName").value;


const topic=

document.getElementById("topic").value;


const time=

document.getElementById("preferredTime").value;



if(!name || !topic || !time){


document.getElementById("bookingResult").innerHTML=

"⚠️ Fill all consultation details.";


return;


}





let requests=

JSON.parse(

localStorage.getItem("tutorRequests")

)||[];



requests.push({

student:name,

topic:topic,

time:time,

date:new Date().toLocaleString()

});



localStorage.setItem(

"tutorRequests",

JSON.stringify(requests)

);



document.getElementById("bookingResult").innerHTML=

`

<div class="unit-card">

<h3>
✅ Request Submitted
</h3>


<p>

Tutor request received.

</p>


</div>

`;



};