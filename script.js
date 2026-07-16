// Register GSAP ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

// Global state variables
let activeStep = null;
let oledCanvas, oledCtx, oledTexture;
let ledMesh, ledPointLight;
let mailboxGroup;

// Initialize functions on load
window.addEventListener('DOMContentLoaded', () => {
    initLenisSmoothScroll();
    initThreeJSMailbox();
    setupDockAnimation();
    setupThemeToggle();
    setupFAQAccordion();
    setupOrderModal();
    setupSpotlightCards();
    setupScrollAnimations();
    setupLoadAnimations();
});

// 1. Lenis Smooth Scroll Integration
function initLenisSmoothScroll() {
    const lenis = new Lenis({
        duration: 1.4,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
        direction: 'vertical',
        smooth: true,
        mouseMultiplier: 1.0,
        smoothTouch: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
}

// 2. High-Fidelity Three.js 3D Mailbox Scene
function initThreeJSMailbox() {
    const container = document.getElementById('mailbox-canvas-container');
    if (!container) return;

    let scene, camera, renderer;
    let clock = new THREE.Clock();

    // 3D Anchor Vectors for HTML Label Projection
    const anchors = {
        solar: new THREE.Vector3(0, 0.5, 0.2),
        led: new THREE.Vector3(0, 0.74, 0.23),
        display: new THREE.Vector3(0.32, -0.5, 0.2),
        lock: new THREE.Vector3(-0.35, -0.5, 0.21),
        bracket: new THREE.Vector3(0.48, 0, -0.22)
    };

    function initScene() {
        scene = new THREE.Scene();

        // Camera: set field of view, aspect ratio, clipping planes
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0.2, 6.0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // Environment reflections mapping (important for metal/dark materials)
        const envCanvas = document.createElement('canvas');
        envCanvas.width = 128;
        envCanvas.height = 128;
        const envCtx = envCanvas.getContext('2d');
        const grad = envCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, '#ffffff');      // bright light source highlight
        grad.addColorStop(0.3, '#7ab8ff');    // soft blue accent
        grad.addColorStop(0.6, '#181a20');    // room dark
        grad.addColorStop(1.0, '#06070a');    // deep dark floor
        envCtx.fillStyle = grad;
        envCtx.fillRect(0, 0, 128, 128);

        const envTexture = new THREE.CanvasTexture(envCanvas);
        envTexture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = envTexture;

        // Lighting System
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.28);
        scene.add(ambientLight);

        // Main key light from upper-front-right
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
        dirLight.position.set(5, 5, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 25;
        scene.add(dirLight);

        // Blue-tinted fill light from left-back
        const fillLight = new THREE.DirectionalLight(0x2DB2FF, 0.7);
        fillLight.position.set(-5, 2, -5);
        scene.add(fillLight);

        // Proximity/rim point light from top
        const topPointLight = new THREE.PointLight(0xffffff, 1.0, 8);
        topPointLight.position.set(0, 3, 2);
        scene.add(topPointLight);

        // Blue PointLight (casts glowing blue LED on front mailbox shell)
        ledPointLight = new THREE.PointLight(0x2DB2FF, 2.0, 4);
        ledPointLight.position.set(0, 0.7, 0.4);
        scene.add(ledPointLight);

        // Dynamic Textures
        createOledTexture();
        const solarTexture = createSolarTexture();

        // Materials (Anthracite / charcoal metal with balanced lighting parameters)
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x5a7fa3, // Matte slate blue
            metalness: 0.2, // Powder-coated steel finish
            roughness: 0.55,
            name: "bodyMat"
        });

        const capMat = new THREE.MeshStandardMaterial({
            color: 0x1d1e22, // Recessed caps slightly darker
            metalness: 0.68,
            roughness: 0.42,
            name: "capMat"
        });

        const solarMat = new THREE.MeshStandardMaterial({
            color: 0x0a0c12,
            map: solarTexture,
            metalness: 0.95,
            roughness: 0.08
        });

        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x2db2ff,
            emissive: 0x2db2ff,
            emissiveIntensity: 3.5
        });

        const chromeMat = new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            metalness: 0.98,
            roughness: 0.05
        });

        const darkGlassMat = new THREE.MeshStandardMaterial({
            color: 0x050508,
            metalness: 0.9,
            roughness: 0.1
        });

        const bracketMat = new THREE.MeshStandardMaterial({
            color: 0x22252a,
            metalness: 0.85,
            roughness: 0.4
        });

        // 3D Mailbox Model Hierarchy Setup
        mailboxGroup = new THREE.Group();
        mailboxGroup.position.set(1.35, -0.25, 0);
        mailboxGroup.scale.set(1.45, 1.45, 1.45);
        mailboxGroup.rotation.set(0.2, -0.4, 0);
        scene.add(mailboxGroup);

        // 2A. Main Body
        const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.4), bodyMat);
        mainBody.castShadow = true;
        mainBody.receiveShadow = true;
        mailboxGroup.add(mainBody);

        // 2B. Angled Top Lid
        const lidGroup = new THREE.Group();
        lidGroup.position.set(0, 0.75, 0.03); // Top edge, slightly forward
        lidGroup.rotation.x = 0.08; // Slight angle forward
        mailboxGroup.add(lidGroup);

        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.06, 0.5), bodyMat);
        lid.position.set(0, 0.03, 0); 
        lid.castShadow = true;
        lid.receiveShadow = true;
        lidGroup.add(lid);

        // 2C. Back Mounting Bracket (Wall mount flange)
        const mountBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), bracketMat);
        mountBracket.position.set(0.48, 0, -0.22);
        mountBracket.castShadow = true;
        mailboxGroup.add(mountBracket);

        const mountFlange1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), bracketMat);
        mountFlange1.position.set(0.48, 0.4, -0.25);
        mailboxGroup.add(mountFlange1);
        
        const mountFlange2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), bracketMat);
        mountFlange2.position.set(0.48, -0.4, -0.25);
        mailboxGroup.add(mountFlange2);

        // 2D. Recessed Solar Panel (Mail Slot shape)
        const slotRecess = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.04), bracketMat);
        slotRecess.position.set(0, 0.5, 0.19);
        mailboxGroup.add(slotRecess);

        const solarPanel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.02), solarMat);
        solarPanel.position.set(0, 0.5, 0.20);
        mailboxGroup.add(solarPanel);

        // 2E. Electric LED Light Bar (Under lid seam)
        ledMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 16), ledMat);
        ledMesh.rotation.z = -Math.PI / 2;
        ledMesh.position.set(0, 0.74, 0.22);
        mailboxGroup.add(ledMesh);

        // 2F. OLED Screen Display
        const oledScreen = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.01), oledTexture);
        oledScreen.position.set(0.32, -0.5, 0.2);
        mailboxGroup.add(oledScreen);

        const oledFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.015), bracketMat);
        oledFrame.position.set(0.32, -0.5, 0.195);
        mailboxGroup.add(oledFrame);

        // 2G. Physical Lock
        const lockBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), chromeMat);
        lockBezel.rotation.x = Math.PI / 2;
        lockBezel.position.set(-0.35, -0.5, 0.2);
        lockBezel.castShadow = true;
        mailboxGroup.add(lockBezel);

        const lockCore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 24), darkGlassMat);
        lockCore.rotation.x = Math.PI / 2;
        lockCore.position.set(-0.35, -0.5, 0.201);
        mailboxGroup.add(lockCore);

        // 2H. Brand Wordmark (VISIONIX)
        const wordmarkTexture = createWordmarkTexture();
        const wordmarkMat = new THREE.MeshStandardMaterial({
            map: wordmarkTexture,
            transparent: true,
            roughness: 0.6,
            metalness: 0.1
        });
        const wordmarkPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), wordmarkMat);
        wordmarkPlane.position.set(0.35, -0.65, 0.201);
        mailboxGroup.add(wordmarkPlane);



        // Listen for Window Resize
        window.addEventListener('resize', onWindowResize);

        // Start animation loop
        renderer.setAnimationLoop(animate);
    }

    // Canvas solar texture creation
    function createSolarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Base solar blue gradient
        ctx.fillStyle = '#080a10';
        ctx.fillRect(0, 0, 128, 128);

        // Draw cells lines
        ctx.strokeStyle = '#1e2434';
        ctx.lineWidth = 1.5;
        for (let i = 8; i < 128; i += 16) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i, 128);
            ctx.stroke();
        }
        for (let j = 16; j < 128; j += 32) {
            ctx.beginPath();
            ctx.moveTo(0, j); ctx.lineTo(128, j);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    // Dynamic OLED display canvas creation
    function createOledTexture() {
        oledCanvas = document.createElement('canvas');
        oledCanvas.width = 128;
        oledCanvas.height = 64;
        oledCtx = oledCanvas.getContext('2d');

        // Draw initial screen state
        updateOledCanvasText("SYSTEM ARMED", "WIFI: CONNECTED", "BATTERY: 100%");

        const canvasTexture = new THREE.CanvasTexture(oledCanvas);
        canvasTexture.minFilter = THREE.LinearFilter;
        
        // Wrap screen in standard material
        oledTexture = new THREE.MeshStandardMaterial({
            map: canvasTexture,
            emissiveMap: canvasTexture,
            emissive: 0x2db2ff,
            emissiveIntensity: 1.8
        });
    }

    // Dynamic Wordmark texture creation
    function createWordmarkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = '#b0c4de'; // Light metal text color
        ctx.font = 'bold 36px "Inter", "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        if (ctx.letterSpacing !== undefined) {
            ctx.letterSpacing = '4px';
        }
        ctx.fillText('VISIONIX', 240, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        return texture;
    }

    // Function to draw text on OLED Canvas dynamically
    function updateOledCanvasText(title, line1, line2) {
        if (!oledCtx) return;
        
        // Clear background (pitch black OLED)
        oledCtx.fillStyle = '#000000';
        oledCtx.fillRect(0, 0, 128, 64);

        // Draw thin blue border
        oledCtx.strokeStyle = 'rgba(45, 178, 255, 0.4)';
        oledCtx.lineWidth = 2;
        oledCtx.strokeRect(2, 2, 124, 60);

        // Title text
        oledCtx.fillStyle = '#2db2ff';
        oledCtx.font = 'bold 10px Courier New';
        oledCtx.textAlign = 'center';
        oledCtx.fillText(title, 64, 20);

        // Details lines
        oledCtx.fillStyle = '#8e8e93';
        oledCtx.font = '7px Courier New';
        oledCtx.fillText(line1, 64, 38);
        oledCtx.fillText(line2, 64, 48);

        // Notify Three.js that texture needs upload
        if (oledTexture && oledTexture.map) {
            oledTexture.map.needsUpdate = true;
        }
    }

    // Expose OLED updates to global scope
    window.updateOledScreen = function(stepName) {
        switch(stepName) {
            case 'solar':
                updateOledCanvasText("SOLAR CHARGING", "POWER: 15.2W IN", "CORE BATT: 100%");
                break;
            case 'led':
                updateOledCanvasText("LED LIGHTBAR", "STATUS: BLUE", "MAIL DETECTED");
                break;
            case 'display':
                updateOledCanvasText("OLED ACTIVE", "COURIER NAV ON", "TAP FOR HELP");
                break;
            case 'lock':
                updateOledCanvasText("SECURITY LOCK", "PIN STATUS: OK", "ENCRYPTED BT");
                break;
            case 'bracket':
                updateOledCanvasText("MOUNT ALIGNED", "SECURE DOCK: ON", "TAMPER: ACTIVE");
                break;
            default:
                updateOledCanvasText("SYSTEM ARMED", "WIFI: CONNECTED", "BATTERY: 100%");
                break;
        }
    };



    // Window Resize Adjuster
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Animation Loop
    function animate() {
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // 1. Continuous rotation & gentle float
        const isMobile = window.innerWidth <= 768;
        
        mailboxGroup.rotation.y = time * 0.4;
        mailboxGroup.rotation.x = 0.15 + Math.cos(time * 0.6) * 0.02;
        
        if (isMobile) {
            mailboxGroup.position.x = 0;
            mailboxGroup.position.y = 0.8 + Math.sin(time * 1.2) * 0.025;
            mailboxGroup.scale.set(1.1, 1.1, 1.1);
        } else {
            mailboxGroup.position.x = 1.35;
            mailboxGroup.position.y = -0.25 + Math.sin(time * 1.2) * 0.025;
            mailboxGroup.scale.set(1.45, 1.45, 1.45);
        }

        // 2. Pulse emissive LED light bar strip and PointLight intensity
        if (ledMesh) {
            const pulse = Math.sin(time * 3.0) * 0.3 + 0.7; // 0.4 to 1.0
            ledMesh.material.emissiveIntensity = 2.5 + pulse * 1.5;
            ledPointLight.intensity = 1.2 + pulse * 0.8;
        }

        renderer.render(scene, camera);
    }

    initScene();
}

// 4. Floating Dock bubble & navigation transitions
function setupDockAnimation() {
    const dockNav = document.querySelector('.dock-nav');
    const bubble = document.querySelector('.dock-bubble');
    const links = document.querySelectorAll('.dock-link');
    
    if (!dockNav || !bubble || links.length === 0) return;

    function moveBubble(target, immediate = false) {
        if (!target) {
            gsap.to(bubble, { opacity: 0, duration: 0.3 });
            return;
        }
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

    const activeLink = document.querySelector('.dock-link.active');
    if (activeLink) {
        setTimeout(() => moveBubble(activeLink, true), 150);
    }

    links.forEach(link => {
        link.addEventListener('mouseenter', () => {
            moveBubble(link);
        });
        link.addEventListener('click', () => {
            if (link.id === 'open-order-modal-nav') return;
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    dockNav.addEventListener('mouseleave', () => {
        const currentActive = document.querySelector('.dock-link.active');
        moveBubble(currentActive);
    });

    // Update active nav dot as user scrolls page
    const sections = ['#hero', '#features', '#feedback', '#faq', '#pricing'];
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
                
                const isHoveringAny = Array.from(links).some(l => l.matches(':hover'));
                if (!isHoveringAny) {
                    moveBubble(link);
                }
            }
        });
    }

    window.addEventListener('resize', () => {
        const currentActive = document.querySelector('.dock-link.active');
        moveBubble(currentActive, true);
    });
}

// 5. Theme Toggle Logic
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    // Default to dark theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateToggleIcon(savedTheme);

    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateToggleIcon(newTheme);
    });

    function updateToggleIcon(theme) {
        const icon = toggleBtn.querySelector('i');
        if (theme === 'light') {
            icon.className = 'fa-solid fa-sun';
            icon.style.color = '#ff9500';
        } else {
            icon.className = 'fa-solid fa-moon';
            icon.style.color = '#2db2ff';
        }
    }
}

// 6. FAQ Accordion Height GSAP Transitions
function setupFAQAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const trigger = item.querySelector('.faq-trigger');
        const content = item.querySelector('.faq-content');
        
        trigger.addEventListener('click', () => {
            const isOpen = item.classList.contains('active');
            
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                    gsap.to(otherItem.querySelector('.faq-content'), { height: 0, duration: 0.3, ease: 'power2.out' });
                }
            });
            
            if (isOpen) {
                item.classList.remove('active');
                gsap.to(content, { height: 0, duration: 0.3, ease: 'power2.out' });
            } else {
                item.classList.add('active');
                // Calculate height dynamically
                gsap.set(content, { height: 'auto' });
                const height = content.clientHeight;
                gsap.set(content, { height: 0 }); // reset
                gsap.to(content, { height: height, duration: 0.3, ease: 'power2.out' });
            }
        });
    });
}


// 8. Order Modal & Form Submission
function setupOrderModal() {
    const modal = document.getElementById('order-modal');
    const openBtns = [];
    const closeBtns = [document.getElementById('close-order-modal'), document.getElementById('close-success-btn')];
    const form = document.getElementById('order-form');
    const formContainer = document.getElementById('order-form-container');
    const successContainer = document.getElementById('order-success');
    const submitBtn = document.getElementById('submit-order-btn');

    if (!modal || !form) return;

    openBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                formContainer.style.display = 'block';
                successContainer.style.display = 'none';
            });
        }
    });

    closeBtns.forEach(btn => {
        if(btn) {
            btn.addEventListener('click', () => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        const formData = new FormData(form);

        try {
            const res = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData,
            });
            const result = await res.json();

            if (result.success) {
                formContainer.style.display = 'none';
                successContainer.style.display = 'block';
                form.reset();
            } else {
                alert("Something went wrong. Please try again.");
            }
        } catch (error) {
            console.error(error);
            alert("Network error. Please try again.");
        } finally {
            submitBtn.innerHTML = originalBtnHTML;
            submitBtn.disabled = false;
        }
    });
}

// 9. Spotlight Glow Hover Effect
function setupSpotlightCards() {
    const cards = document.querySelectorAll('.feature-card, .pricing-card');
    if (cards.length === 0) return;

    document.addEventListener('pointermove', (e) => {
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            // Calculate mouse position relative to the card
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Normalize xp and yp (0 to 1) within the card
            const xp = (x / rect.width).toFixed(2);
            const yp = (y / rect.height).toFixed(2);

            card.style.setProperty('--x', x.toFixed(2));
            card.style.setProperty('--y', y.toFixed(2));
            card.style.setProperty('--xp', xp);
            card.style.setProperty('--yp', yp);
        });
    });
}

// 10. Scroll Reveal Animations
function setupScrollAnimations() {
    // Animate section headers
    const headers = document.querySelectorAll('.section-title, .eyebrow');
    headers.forEach(header => {
        gsap.from(header, {
            scrollTrigger: {
                trigger: header,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out"
        });
    });

    // Stagger feature cards
    if (document.querySelector('.features-grid')) {
        gsap.from('.feature-card', {
            scrollTrigger: {
                trigger: '.features-grid',
                start: "top 80%",
                toggleActions: "play none none reverse"
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out"
        });
    }

    // Stagger stats
    if (document.querySelector('.stats-grid')) {
        gsap.from('.stat-item', {
            scrollTrigger: {
                trigger: '.stats-grid',
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out"
        });
    }

    // Stagger pricing cards
    if (document.querySelector('.pricing-grid')) {
        gsap.from('.pricing-card', {
            scrollTrigger: {
                trigger: '.pricing-grid',
                start: "top 80%",
                toggleActions: "play none none reverse"
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out"
        });
    }

    // Stagger testimonials
    if (document.querySelector('.testimonials-grid')) {
        gsap.from('.testimonial-card', {
            scrollTrigger: {
                trigger: '.testimonials-grid',
                start: "top 80%",
                toggleActions: "play none none reverse"
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out"
        });
    }

    // Stagger FAQ items
    if (document.querySelector('.faq-list')) {
        gsap.from('.faq-item', {
            scrollTrigger: {
                trigger: '.faq-list',
                start: "top 80%",
                toggleActions: "play none none reverse"
            },
            y: 30,
            opacity: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out"
        });
    }
}

// 11. Initial Page Load Animations
function setupLoadAnimations() {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Hide elements initially via GSAP
    gsap.set('.floating-header, .top-right-bar', { y: -50, opacity: 0 });
    gsap.set('.hero-content .eyebrow, .hero-content .headline, .hero-content .subheadline, .hero-content .cta-group', { y: 30, opacity: 0 });
    gsap.set('#mailbox-canvas-container', { opacity: 0, scale: 0.95 });

    // Animate Nav bars down
    tl.to('.floating-header, .top-right-bar', {
        y: 0,
        opacity: 1,
        duration: 1,
        stagger: 0.1
    }, "+=0.2")
    
    // Animate Hero text up
    .to('.hero-content .eyebrow, .hero-content .headline, .hero-content .subheadline, .hero-content .cta-group', {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.15
    }, "-=0.6")
    
    // Fade in 3D Mailbox
    .to('#mailbox-canvas-container', {
        opacity: 1,
        scale: 1,
        duration: 1.5,
        ease: "power2.out"
    }, "-=0.6");
}
