// ==============================
// FIREBASE CONNECTION
// ==============================


import { initializeApp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";


import {

getAuth,
onAuthStateChanged,
signOut

} 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";




// FIREBASE CONFIG

const firebaseConfig = {

apiKey: "AIzaSyDKmg8OT4hdG_bNIWTapfY5cP9dM2kyGps",

authDomain: "mwaniki-scholars.firebaseapp.com",

projectId: "mwaniki-scholars",

storageBucket: "mwaniki-scholars.firebasestorage.app",

messagingSenderId: "383333905328",

appId: "1:383333905328:web:082e968df7bf4093999c75"

};




// INITIALIZE FIREBASE

const app = initializeApp(firebaseConfig);


const auth = getAuth(app);




// CHECK LOGIN STATUS

onAuthStateChanged(auth,(user)=>{


if(user){


console.log(
"Logged in:",
user.email
);


// show student email

const profile =
document.querySelector(".profile");


if(profile){

profile.innerHTML =
"👤 " + user.email;

}



}

else{


// if not logged in return home

window.location.href="index.html";


}


});




// LOGOUT FUNCTION


window.logoutUser=function(){


signOut(auth)

.then(()=>{


window.location.href="index.html";


})


.catch(error=>{


console.log(error);


});


};
