/*
  Sister script for muffin-v2.html (cleaned copy of header.js).
  Only change: removed the leftover console.log debug statement
  that fired on every page load.
*/

document.addEventListener("DOMContentLoaded", function () {

    const imhead = document.getElementById('imghead');

    var fsund = document.querySelectorAll(".imgfs");
    fsund.forEach(function (element) {
        element.addEventListener("click", function () {
            imhead.style.display = 'flex';
            var srcvalue = this.getAttribute("src");
            document.getElementById("imghead").textContent = srcvalue;
        });
    });
});
