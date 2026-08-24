import {supabase} from "./supabase.js";



window.adminLogin = async function(){


let email =
document.getElementById("adminEmail").value;



let password =
document.getElementById("adminPassword").value;



let status =
document.getElementById("status");




const {data,error}=

await supabase.auth.signInWithPassword({

email:email,

password:password

});





if(error){

status.innerHTML="❌ "+error.message;

return;

}





status.innerHTML="✅ Welcome Admin";



setTimeout(()=>{

window.location.href="admin.html";


},1000);



}