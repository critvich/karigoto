// const sidebarLinks = document.querySelectorAll('.sidebar-link');
// sidebarLinks.forEach(link => {
//     link.addEventListener('click', function(event) {
//         event.preventDefault(); // Prevent default anchor behavior
//         const targetId = this.getAttribute('data-target');
//         const targetSection = document.getElementById(targetId);
//         if (targetSection) {
//             // Hide all sections
//             const sections = document.querySelectorAll('.content section');
//             sections.forEach(section => {
//                 section.style.display = 'none';
//             });
//             // Show the target section
//             targetSection.style.display = 'block';
//         }
//     });
// });

// // Show Section 1 by default
// document.getElementById('section1').style.display = 'block';

// const dropdownBtns = document.querySelectorAll('.dropdown-btn');
// dropdownBtns.forEach(btn => {
//     btn.addEventListener('click', function(event) {
//         event.preventDefault();
//         const dropdownContent = this.nextElementSibling;
//         if (dropdownContent.style.display === 'none') {
//             dropdownContent.style.display = 'block';
//         } else {
//             dropdownContent.style.display = 'none';
//         }
//     });
// });

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('imgund').style.display = 'none';

    const sidebarLinks = document.querySelectorAll('.sidebarl');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault(); 
            const targetId = this.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                const sections = document.querySelectorAll('.base section');
                sections.forEach(section => {
                    section.style.display = 'none';
                });
                targetSection.style.display = 'block';
            }
        });
    });
    const hash = window.location.hash.substring(1); 
    if (hash) {
        const targetLink = document.querySelector(`.sidebarl[data-target="${hash}"]`);
        console.log(targetLink)
        if (targetLink) {
            targetLink.click();
        }
    } else {
        const defaultLink = document.querySelector('.sidebarl.defaultopen');
        if (defaultLink) {
            defaultLink.click();
        }
    }

    const dropdownsb = document.querySelectorAll('.dropdownsb');
    dropdownsb.forEach(btn => {
        btn.addEventListener('click', function(event) {
            event.preventDefault();
            const dropdownContent = this.nextElementSibling;
            if (dropdownContent.style.display === 'none') {
                dropdownContent.style.display = 'block';
                this.querySelector('ion-icon').setAttribute('name', 'chevron-down-outline');
            } else {
                dropdownContent.style.display = 'none';
                this.querySelector('ion-icon').setAttribute('name', 'chevron-back-outline');
            }
        });
    });

    const dropdownhm = document.querySelectorAll('.dropdownhm');
    dropdownhm.forEach(btn => {
        btn.addEventListener('click', function(event) {
            event.preventDefault();
            const dropdownContent = this.nextElementSibling;
            if (dropdownContent.style.display === 'none') {
                dropdownContent.style.display = 'block';
                this.querySelector('ion-icon').setAttribute('name', 'chevron-down-outline');
            } else {
                dropdownContent.style.display = 'none';
                this.querySelector('ion-icon').setAttribute('name', 'chevron-back-outline');
            }
        });
    });

    const codehmbutton = document.getElementById('codehmbutton');
    const hmtext = document.getElementById('hmtxt');

    codehmbutton.addEventListener('click', () => {
        console.log("poop")
        if (hmtext) {
            hmtext.classList.toggle('fullscreen');
        } else {
            console.error("hmText element not found");
        }
    });


    var copyElements = document.querySelectorAll(".copytext");
    copyElements.forEach(function(element) {
        element.addEventListener("click", function() {
            var textarea = document.createElement("textarea");
            textarea.value = this.innerText;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand("copy");
                this.style.backgroundColor = "#131A23"; 
                setTimeout(() => {
                    this.style.backgroundColor = ""; 
                }, 200);
            } catch (err) {
                console.error("Failed to copy text: ", err);
            } finally {
                document.body.removeChild(textarea);
            }
        });
    });

    var fsund = document.querySelectorAll(".imgfs");
    fsund.forEach(function(element) {
        var fsund = document.getElementById('imgund');
        element.addEventListener("click", function() {
            this.classList.toggle('fs');
            if (this.classList.contains('images')) { 
                this.classList.remove('images'); 
                this.classList.add('placeholder'); 
            } else if (this.classList.contains('placeholder')) {
                this.classList.remove('placeholder'); 
                this.classList.add('images'); 
            }
            if (fsund.style.display === 'none') {
                fsund.style.display = 'block';
            } else {
                fsund.style.display = 'none';
            }
        });

    });
    


    var player = videojs('showcase', {
        controls: true,
        autoplay: false,
        fluid: true
    });

    // Example event handling
    player.on('play', function() {
        console.log('Video is playing');
    });




});