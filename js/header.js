document.addEventListener("DOMContentLoaded", function() {
    var headerLink = "https://docs.ultralytics.com";
    // var headerText = headerLink.replace(/^(https?:\/\/)?/, '');
    var headerText = "de/compile";

    // var headerhaslink = document.getElementById("headerLink");
    // if (headerhaslink) {
    //     headerLink.textContent = headerText;
    // }
    document.querySelector(".main-nav-link").href = headerLink;
    document.getElementById("headerLink").textContent = headerText;



    document.addEventListener("DOMContentLoaded", function() {
        const codehmbutton = document.getElementById('codehmbutton');
        const hmhead = document.getElementById('hmhead');
        const bluehead = document.getElementById('bluehead')


        codehmbutton.addEventListener('click', () => {
            console.log("poop")
            if (hmhead) {
                hmhead.classList.toggle('fullscreen');
            } else {
                console.error("hmText element not found");
            }
            if (hmhead.style.display === 'none') {
                hmhead.style.display = 'flex';
            } else {
                hmhead.style.display = 'none';
            }
        });

        var fsund = document.querySelectorAll(".imgfs");
        fsund.forEach(function(element) {
            element.addEventListener("click", function() {
                if (bluehead.style.display === 'none') {
                    bluehead.style.display = 'flex';
                } else {
                    bluehead.style.display = 'none';
                }
                var srcvalue = this.getAttribute("src");
                document.getElementById("bluehead").textContent = srcvalue;
            });
        });
    });
});