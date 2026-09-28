/*
  Sister script for muffin-v2.html (cleaned copy of main.js).
  Changes from the original:
    - removed the unconditional videojs('my-video', ...) call: there is no
      #my-video element and video.js is never loaded on this page, so it
      threw "ReferenceError: videojs is not defined" on every load.
    - removed the large blocks of commented-out dead code.
    - sidebar navigation now resolves the target section by id
      (data-target="section0") instead of a raw array index, so it keeps
      working if sections are reordered or one is added/removed.
    - clicking a sidebar link now toggles a "current" class so the sidebar
      shows which page is active (styled in muffin-v2.css).
*/

document.addEventListener("DOMContentLoaded", function () {

    const pages = document.querySelectorAll('.slider');
    let currentPage = 0;

    function updateTransforms() {
        pages.forEach((page, index) => {
            const offset = index - currentPage;
            page.style.transform = `translateX(${offset * 100}%)`;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function setActiveLink(link) {
        document.querySelectorAll('.sidebarl').forEach(l => l.classList.remove('current'));
        link.classList.add('current');
    }

    document.querySelectorAll('.sidebarl').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (!targetSection) return;

            const targetIndex = Array.from(pages).indexOf(targetSection);
            if (targetIndex === -1) return;

            currentPage = targetIndex;
            updateTransforms();
            setActiveLink(link);
        });
    });

    updateTransforms();

    const defaultLink = document.querySelector('.sidebarl.defaultopen');
    if (defaultLink) {
        setActiveLink(defaultLink);
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
    copyElements.forEach(function (element) {
        element.addEventListener("click", function (event) {
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


    const fullscreenimage = document.querySelectorAll('.imgfs');
    const imhead = document.getElementById('imghead');

    fullscreenimage.forEach(image => {
        image.addEventListener('click', () => {

            const duplicate = image.cloneNode(true);
            const underlay = document.getElementById('imgund');

            duplicate.classList.add('fs');
            duplicate.classList.remove('images');

            document.body.appendChild(duplicate);
            document.getElementById('imgund').style.display = 'block';

            duplicate.addEventListener('click', () => {
                document.body.removeChild(duplicate);
                document.getElementById('imgund').style.display = 'none';
                imhead.style.display = 'none';
            });
            underlay.addEventListener('click', () => {
                document.body.removeChild(duplicate);
                document.getElementById('imgund').style.display = 'none';
                imhead.style.display = 'none';
            });
        });
    });


    const expandbutton = document.querySelectorAll('.expand');
    expandbutton.forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            const targetId = this.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.toggle('expanded');
            }
            const ionIcon = this.querySelector('ion-icon');
            if (ionIcon) {
                if (ionIcon.getAttribute('name') === 'chevron-down-outline') {
                    ionIcon.setAttribute('name', 'chevron-up-outline');
                } else {
                    ionIcon.setAttribute('name', 'chevron-down-outline');
                }
            }
        });
    });

});
