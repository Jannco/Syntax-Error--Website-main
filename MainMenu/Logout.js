function showLogoutPopup(){
    document.getElementById("logout-popup").classList.add("show");
}

function closeLogoutPopup(){
    document.getElementById("logout-popup").classList.remove("show");
}


function logoutUser() {
    // redirect to login page inside components folder
    window.location.href = "/components/login.html";
}   