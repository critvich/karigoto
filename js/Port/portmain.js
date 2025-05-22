
document.addEventListener("DOMContentLoaded", function() {
    // const sidebarLinks = document.querySelectorAll('.sidebarl');
    // sidebarLinks.forEach(link => {
    //     link.addEventListener('click', function(event) {
    //         console.log("harry")
    //         event.preventDefault(); 
    //         const targetId = this.getAttribute('data-target');
    //         const targetSection = document.getElementById(targetId);
    //         if (targetSection) {

    //             const sections = document.querySelectorAll('.base section');
    //             sections.forEach(section => {
    //                 section.classList.remove('none');
    //                 section.classList.add('pagehidden');
    //             });
    //             console.log("sextopia")
  
    //             targetSection.classList.remove('pagehidden');
    //             targetSection.classList.add('slider')
    //             window.location.hash = targetId;

    //         }
    //     });
    // });



    const pages = document.querySelectorAll('.slider');
    let currentPage = 0;

    function updateTransforms() {
        pages.forEach((page, index) => {
            const offset = index - currentPage;
            page.style.transform = `translateX(${offset * 100}%)`;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll('.sidebarl').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetIndex = parseInt(link.getAttribute('data-target'), 10);
          if (!isNaN(targetIndex)) {
            currentPage = targetIndex;
            updateTransforms();
          }
        });
      });

    updateTransforms();

    const hash = window.location.hash.substring(1); 
    if (hash) {
        const targetLink = document.querySelector(`.sidebarl[data-target="${hash}"]`);
        console.log(targetLink)
        if (targetLink) {
            targetLink.click();
        }
    } 

    window.addEventListener('load', () => {
        if (window.location.hash) {
          history.replaceState(null, null, ' ');
        }
      });

    requestAnimationFrame(() => {
        document.querySelector('.base').classList.add('ready');
    });

    var copyElements = document.querySelectorAll(".copytext");
    copyElements.forEach(function(element) {
        element.addEventListener("click", function(event) {
            event.preventDefault();
            var textToCopy = this.getAttribute("data-target");
            if (!textToCopy) return;
    
            var textarea = document.createElement("textarea");
            textarea.value = textToCopy;
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
    

    // var fsund = document.querySelectorAll(".imgfs");
    // fsund.forEach(function(element) {
    //     var fsund = document.getElementById('imgund');
    //     element.addEventListener("click", function() {
    //         this.classList.toggle('fs');
    //         if (this.classList.contains('images')) { 
    //             this.classList.remove('images'); 
    //             this.classList.add('placeholder'); 
    //         } else if (this.classList.contains('placeholder')) {
    //             this.classList.remove('placeholder'); 
    //             this.classList.add('images'); 
    //         }
    //         if (fsund.style.display === 'none') {
    //             fsund.style.display = 'block';
    //         } else {
    //             fsund.style.display = 'none';
    //         }
    //     });

    // });

    const fullscreenimage = document.querySelectorAll('.imgfs');
    const imhead = document.getElementById('imghead')
    
    fullscreenimage.forEach(image => {
      image.addEventListener('click', () => {

        const duplicate = image.cloneNode(true);
        const underlay = document.getElementById('imgund')

        duplicate.classList.add('fs');
        duplicate.classList.remove('images');

        document.body.appendChild(duplicate);
        document.getElementById('imgund').style.display = 'block';

        duplicate.addEventListener('click', () => {
          document.body.removeChild(duplicate);
          document.getElementById('imgund').style.display = 'none';
          imhead.style.display = 'none'        
        });
        underlay.addEventListener('click', () => {
            document.body.removeChild(duplicate);
            document.getElementById('imgund').style.display = 'none';
            imhead.style.display = 'none'      
          });
      });
    });

    function openTtab(evt, tabName) {
        var i, ttabcontent, trainingtabs;
        ttabcontent = document.getElementsByClassName("ttabcontent");
        for (i = 0; i < ttabcontent.length; i++) {
            ttabcontent[i].style.display = "none";
        }
        trainingtabs = document.getElementsByClassName("ttabs");
        for (i = 0; i < trainingtabs.length; i++) {
            trainingtabs[i].className = trainingtabs[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    }

    function openRtab(evt, tabName) {
        var i, rtabcontent, runningtabs;
        rtabcontent = document.getElementsByClassName("rtabcontent");
        for (i = 0; i < rtabcontent.length; i++) {
            rtabcontent[i].style.display = "none";
        }
        runningtabs = document.getElementsByClassName("rtabs");
        for (i = 0; i < runningtabs.length; i++) {
            runningtabs[i].className = runningtabs[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    }

    const expandbutton = document.querySelectorAll('.expand');
    expandbutton.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent default anchor behavior
            const targetId = this.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.toggle('expanded');
            };
            const ionIcon = this.querySelector('ion-icon');
            if (ionIcon.getAttribute('name') === 'chevron-down-outline') {
                console.log('The ion-icon is a chevron down outline!');
                ionIcon.setAttribute('name', 'chevron-up-outline');
            } else {
                ionIcon.setAttribute('name', 'chevron-down-outline')
            };
            console.log("pee")
        });
    });

    var player = videojs('my-video', {
        autoplay: true,
        loop: true,
        muted: true, // Ensures autoplay works on all browsers
      });
      
});