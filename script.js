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





// ================= FIREBASE CONFIG =================


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





// ================= GET INPUTS =================


const emailInput =
document.getElementById("email");


const passwordInput =
document.getElementById("password");







// ================= REGISTER =================



window.signUp=function(){


const email=emailInput.value;

const password=passwordInput.value;



createUserWithEmailAndPassword(

auth,

email,

password

)


.then(()=>{


alert("✅ Account created successfully");


})


.catch(error=>{


alert(error.message);


});


};







// ================= STUDENT LOGIN =================



window.login=function(){


const email=emailInput.value;

const password=passwordInput.value;



signInWithEmailAndPassword(

auth,

email,

password

)


.then((result)=>{


const user=result.user;



alert("✅ Login successful");



window.location.href="dashboard.html";



})


.catch(error=>{


alert(error.message);


});


};








// ================= ADMIN LOGIN =================



window.adminLogin=function(){


const email=emailInput.value;

const password=passwordInput.value;



signInWithEmailAndPassword(

auth,

email,

password

)


.then((result)=>{


const user=result.user;



if(user.email==="admin@mwaniki.com"){


window.location.href="admin.html";


}

else{


alert("❌ This account is not an admin");


}



})


.catch(error=>{


alert(error.message);


});


};








// ================= TUTOR LOGIN =================



window.tutorLogin=function(){


const email=emailInput.value;

const password=passwordInput.value;



signInWithEmailAndPassword(

auth,

email,

password

)


.then((result)=>{


const user=result.user;



if(user.email.includes("tutor")){


window.location.href="tutor.html";


}

else{


alert("❌ Tutor account required");


}



})


.catch(error=>{


alert(error.message);


});


};







// ================= LOGOUT =================



window.logout=function(){


signOut(auth)


.then(()=>{


window.location.href="index.html";


});


};






// ================= CHECK USER =================



onAuthStateChanged(auth,(user)=>{


if(user){


console.log(

"Active user:",

user.email

);


}

else{


console.log(

"No active user"

);


}



});





console.log(
"🚀 Mwaniki Scholars Firebase Connected"
);