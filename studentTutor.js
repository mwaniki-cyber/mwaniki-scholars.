import { supabase } from "./supabase.js";


// =====================================
// BOOK / ASK TUTOR
// =====================================


window.bookTutor = async function(){


const name =

document.getElementById("studentName").value.trim();



const topic =

document.getElementById("topic").value.trim();



const time =

document.getElementById("preferredTime").value.trim();



const result =

document.getElementById("bookingResult");





if(
name==="" ||
topic==="" ||
time===""

){


result.innerHTML="❌ Fill all details";

return;


}






const {data:{user}}=

await supabase.auth.getUser();





const email = user ? user.email : "guest";







const {error}=await supabase

.from("tutor_messages")

.insert({

student_name:name,

student_email:email,

topic:topic,

message:"Student requested tutor consultation at "+time,

status:"pending"

});








if(error){


console.log(error);


result.innerHTML=

"❌ Failed: "+error.message;


return;

}







result.innerHTML=

"✅ Tutor request sent successfully";




document.getElementById("studentName").value="";

document.getElementById("topic").value="";

document.getElementById("preferredTime").value="";



};





console.log(

"📨 Student Tutor System Connected"

);