// Register GSAP ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

setupScrollAnimations();
setupDockAnimation();

function setupScrollAnimations() {
    // Initial entrance GSAP
    gsap.from('.headline', { y: 50, opacity: 0, duration: 1, delay: 0.2 });
    gsap.from('.subheadline', { y: 30, opacity: 0, duration: 1, delay: 0.4 });
    gsap.from('.cta-group', { y: 20, opacity: 0, duration: 1, delay: 0.6 });
    
    // How It Works Animation Trigger
    ScrollTrigger.create({
        trigger: '#how-it-works',
        start: 'top center',
        end: 'bottom center',
        onEnter: () => {
            // Animate steps
            gsap.utils.toArray('.step').forEach((step, i) => {
                setTimeout(() => step.classList.add('active'), i * 300);
            });
        }
    });
}

function setupDockAnimation() {
    const dockNav = document.querySelector('.dock-nav');
    const bubble = document.querySelector('.dock-bubble');
    const links = document.querySelectorAll('.dock-link');
    
    if (!dockNav || !bubble || links.length === 0) return;

    // Function to move bubble to a specific element
    function moveBubble(target, immediate = false) {
        if (!target) {
            gsap.to(bubble, { opacity: 0, duration: 0.3 });
            return;
        }
        
        // Get target coordinates relative to parent container
        const targetRect = target.getBoundingClientRect();
        const parentRect = dockNav.getBoundingClientRect();
        
        const left = targetRect.left - parentRect.left;
        const width = targetRect.width;
        const height = targetRect.height;
        const top = targetRect.top - parentRect.top;

        gsap.to(bubble, {
            left: left,
            top: top,
            width: width,
            height: height,
            opacity: 1,
            duration: immediate ? 0 : 0.4,
            ease: 'power2.out'
        });
    }

    // Find initially active link and place bubble
    const activeLink = document.querySelector('.dock-link.active');
    if (activeLink) {
        // Delay slightly to ensure layout rendering is complete
        setTimeout(() => moveBubble(activeLink, true), 150);
    }

    // Hover events for all dock links
    links.forEach(link => {
        link.addEventListener('mouseenter', () => {
            moveBubble(link);
        });
        
        link.addEventListener('click', (e) => {
            // Update active state class immediately on click
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Reset bubble back to active link when mouse leaves the entire nav dock container
    dockNav.addEventListener('mouseleave', () => {
        const currentActive = document.querySelector('.dock-link.active');
        moveBubble(currentActive);
    });

    // Scroll tracking to update active navigation item
    const sections = ['#hero', '#features', '#how-it-works', '#tech', '#gallery'];
    sections.forEach(selector => {
        const sec = document.querySelector(selector);
        if (!sec) return;
        
        ScrollTrigger.create({
            trigger: sec,
            start: 'top 40%',
            end: 'bottom 40%',
            onEnter: () => updateActiveLink(selector),
            onEnterBack: () => updateActiveLink(selector)
        });
    });

    function updateActiveLink(id) {
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href === id) {
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // If the user is not currently hovering over the dock, move the bubble to match
                const isHoveringAny = Array.from(links).some(l => l.matches(':hover'));
                if (!isHoveringAny) {
                    moveBubble(link);
                }
            }
        });
    }

    // Recalculate bubble position on window resize
    window.addEventListener('resize', () => {
        const currentActive = document.querySelector('.dock-link.active');
        moveBubble(currentActive, true);
    });
}
