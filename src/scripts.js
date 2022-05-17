function force_wait() {
    let loading_time = setTimeout(showPage, 3000);
}

function showPage() {
    document.getElementById("loading").style.display = "none";
    document.getElementById("main").style.display = "block";
}