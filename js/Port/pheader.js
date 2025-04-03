document.addEventListener("DOMContentLoaded", function() {
    // var headerLink = "https://docs.ultralytics.com";
    // var headerText = headerLink.replace(/^(https?:\/\/)?/, '');
    // var headerText = "de/compile/port";

    // document.querySelector(".main-nav-link").href = headerLink;
    // document.getElementById("headerLink").textContent = headerText;



        const imhead = document.getElementById('imghead')

        console.log("penis")

        var fsund = document.querySelectorAll(".imgfs");
        fsund.forEach(function(element) {
            element.addEventListener("click", function() {
                imhead.style.display = 'flex';
                var srcvalue = this.getAttribute("src");
                document.getElementById("imghead").textContent = srcvalue;
            });
        
        });
    });