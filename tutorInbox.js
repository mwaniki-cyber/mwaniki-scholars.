import { supabase } from "./supabase.js";



const requests =

document.getElementById("requests");





// ================================
// LOAD STUDENT QUESTIONS
// ================================


async function loadQuestions(){



const {data,error}=await supabase

.from("tutor_messages")

.select("*")

.order("created_at",{ascending:false});





if(error){

console.log(error);

requests.innerHTML=

"❌ Failed to load questions";

return;

}






if(!data || data.length===0){


requests.innerHTML=

"📭 No student requests yet";

return;


}






requests.innerHTML="";





data.forEach(item=>{



requests.innerHTML += `


<div class="request">


<h3>

👨‍🎓 ${item.student_name}

</h3>


<p>

📧 ${item.student_email}

</p>



<p>

<b>Topic:</b>

${item.topic}

</p>



<p>

<b>Question:</b>

${item.message}

</p>





<textarea

id="reply-${item.id}"

placeholder="Write tutor answer">

${item.reply || ""}

</textarea>





<button onclick="replyStudent('${item.id}')">

📤 Send Reply

</button>





<p id="result-${item.id}"></p>



</div>


`;



});



}








// ================================
// SEND REPLY
// ================================


window.replyStudent = async function(id){



const reply =

document.getElementById(

"reply-"+id

).value;





const result =

document.getElementById(

"result-"+id

);






const {error}=await supabase

.from("tutor_messages")

.update({

reply:reply,

status:"answered"

})

.eq("id",id);







if(error){


console.log(error);


result.innerHTML=

"❌ Failed";


return;


}






result.innerHTML=

"✅ Reply sent";



};






loadQuestions();



console.log(

"👨‍🏫 Tutor Inbox Connected"

);