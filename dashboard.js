console.log("Mwaniki Scholars Dashboard Loaded 🚀");


// ==============================
// COURSE BUTTONS
// ==============================

const courseButtons = document.querySelectorAll(".course-card button");


courseButtons.forEach(button => {

    button.addEventListener("click", () => {

        alert("Course page coming soon 🚀");

    });

});




// ==============================
// SIDEBAR ACTIVE MENU
// ==============================

const menuItems = document.querySelectorAll(".sidebar li");


menuItems.forEach(item => {

    item.addEventListener("click", () => {


        menuItems.forEach(menu => {

            menu.classList.remove("active");

        });


        item.classList.add("active");


    });

});




// ==============================
// COURSE SEARCH
// ==============================

const searchBox = document.querySelector(".search input");


if(searchBox){


    searchBox.addEventListener("keyup", () => {


        let searchValue = searchBox.value.toLowerCase();


        const cards = document.querySelectorAll(".course-card");


        cards.forEach(card => {


            let courseName = card.innerText.toLowerCase();


            if(courseName.includes(searchValue)){


                card.style.display = "block";


            }else{


                card.style.display = "none";


            }


        });


    });


}




// ==============================
// LOGOUT PLACEHOLDER
// ==============================

const menu = document.querySelectorAll(".sidebar li");


menu.forEach(item => {


    if(item.innerText.includes("Logout")){


        item.addEventListener("click",()=>{


            alert("Firebase logout will be connected here");


        });


    }


});
