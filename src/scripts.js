function myFunction() {
    var element = document.body;
    element.classList.toggle("dark-mode");
}


var myVar;

function fun1() {
    myVar = setTimeout(showPage, 3000);
}

function showPage() {
    document.getElementById("loader").style.display = "none";
    document.getElementById("myDiv").style.display = "block";
}