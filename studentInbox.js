// =====================================
// MWANIKI SCHOLARS
// STUDENT TUTOR REPLY INBOX
// =====================================


import { supabase } from "./supabase.js";



// LOAD ANSWERS

window.loadStudentAnswers = async function(){



const email =

document.getElementById("checkEmail").value.trim();



const inbox =

document.getElementById("studentInbox");




if(email === ""){


inbox.innerHTML =

`
<p style="color:red">
❌ Enter your email first.
</p>
`;

return;

}





inbox.innerHTML =

"⏳ Loading tutor replies...";






const {data,error}=await supabase

.from("tutor_messages")

.select("*")

.eq("student_email",email)

.order("created_at",{ascending:false});






if(error){


console.log(error);


inbox.innerHTML =

`
<p style="color:red">
❌ Could not load messages.
</p>
`;

return;

}






if(!data || data.length===0){


inbox.innerHTML =

`
<p>
📭 No questions or replies found yet.
</p>
`;

return;

}







inbox.innerHTML="";





data.forEach(item=>{



inbox.innerHTML +=

`

<div class="unit-card">


<h3>

📚 ${item.topic}

</h3>



<p>

<b>Your Question:</b>

<br>

${item.message}

</p>




<hr>




<p>

<b>👨‍🏫 Tutor Response:</b>

<br>

${
item.reply

?

item.reply

:

"⏳ Waiting for tutor response..."

}

</p>




<p>

<b>Status:</b>

${item.status}

</p>




</div>


`;



});



};





console.log(
"✅ Student Inbox Connected"
);