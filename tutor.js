// =========================================
// MWANIKI SCHOLARS TUTOR PORTAL
// =========================================

// Load consultation requests
function loadRequests(){

    const requestsDiv = document.getElementById("requests");

    const requests =
        JSON.parse(localStorage.getItem("tutorRequests")) || [];

    if(requests.length === 0){

        requestsDiv.innerHTML =
        "<p>No consultation requests yet.</p>";

        document.getElementById("consultationCount").textContent = "0";

        return;
    }

    requestsDiv.innerHTML = "";

    requests.forEach((request,index)=>{

        const card = document.createElement("div");

        card.className = "request";

        card.innerHTML = `
            <h3>👨‍🎓 ${request.student}</h3>
            <p><b>Topic:</b> ${request.topic}</p>
            <p><b>Preferred Time:</b> ${request.time}</p>
            <p><b>Requested:</b> ${request.date}</p>
            <button onclick="acceptRequest(${index})">
                ✅ Accept
            </button>
        `;

        requestsDiv.appendChild(card);

    });

    document.getElementById("consultationCount").textContent =
        requests.length;
}



// Accept a request
window.acceptRequest = function(index){

    const requests =
        JSON.parse(localStorage.getItem("tutorRequests")) || [];

    if(requests[index]){

        alert(
            "Consultation accepted for " +
            requests[index].student
        );

    }

};



// Reply to a student
window.sendReply = function(){

    const email =
        document.getElementById("studentEmail").value;

    const reply =
        document.getElementById("replyText").value;

    if(email === "" || reply === ""){

        alert("Please fill in all fields.");

        return;
    }

    document.getElementById("replyStatus").innerHTML = `
        <div class="request">
            ✅ Reply prepared for:
            <b>${email}</b>
            <br><br>
            <b>Message:</b>
            <br>
            ${reply}
            <br><br>
            <small>
            (Email sending will be connected later.)
            </small>
        </div>
    `;

};



// Start page
loadRequests();

console.log("👨‍🏫 Tutor Portal Loaded");