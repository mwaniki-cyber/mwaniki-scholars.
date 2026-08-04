import { supabase } from "./supabase.js";



window.tutorLogin = async function(){



const email =

document.getElementById("tutorEmail").value;



const password =

document.getElementById("tutorPassword").value;



const status =

document.getElementById("loginStatus");





const {data,error}=await supabase.auth.signInWithPassword({

email:email,

password:password

});





if(error){


status.innerHTML=

"❌ "+error.message;


return;


}





status.innerHTML=

"✅ Login successful";




setTimeout(()=>{


window.location.href="tutor.html";


},1000);



};