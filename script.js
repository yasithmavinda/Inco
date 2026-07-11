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
    setupCarousel();
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
        solar: new THREE.Vector3(0, 1.12, 0),
        led: new THREE.Vector3(0, 0.5, 0.63),
        display: new THREE.Vector3(1.11, 0.1, 0.2),
        lock: new THREE.Vector3(-0.7, 0.1, 0.63),
        bracket: new THREE.Vector3(0, -0.52, 0)
    };

    function initScene() {
        scene = new THREE.Scene();

        // Camera: set field of view, aspect ratio, clipping planes
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0.2, 5.5);

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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        scene.add(ambientLight);

        // Main key light from upper-front-right
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
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
        ledPointLight.position.set(0, 0.5, 0.85);
        scene.add(ledPointLight);

        // Dynamic Textures
        createOledTexture();
        const solarTexture = createSolarTexture();

        // Materials (Anthracite / charcoal metal with balanced lighting parameters)
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x2d2f34, // Dark charcoal steel rather than pure black
            metalness: 0.65, // Balanced metallic sheen
            roughness: 0.38, // Moderate roughness to distribute specular reflections
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
        mailboxGroup.scale.set(1.25, 1.25, 1.25);
        mailboxGroup.rotation.set(0.2, -0.4, 0);
        scene.add(mailboxGroup);

        // 2A. Middle Body
        const middleBodyGroup = new THREE.Group();
        mailboxGroup.add(middleBodyGroup);

        const midBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.2), bodyMat);
        midBox.castShadow = true;
        midBox.receiveShadow = true;
        middleBodyGroup.add(midBox);

        const midCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 32, 1, false, 0, Math.PI), bodyMat);
        midCyl.rotation.z = -Math.PI / 2;
        midCyl.position.y = 0.5;
        midCyl.castShadow = true;
        midCyl.receiveShadow = true;
        middleBodyGroup.add(midCyl);

        // 2B. Left End Cap
        const leftCapGroup = new THREE.Group();
        leftCapGroup.position.x = -1.05;
        mailboxGroup.add(leftCapGroup);

        const leftBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.04, 1.24), capMat);
        leftBox.castShadow = true;
        leftBox.receiveShadow = true;
        leftCapGroup.add(leftBox);

        const leftCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 32, 1, false, 0, Math.PI), capMat);
        leftCyl.rotation.z = -Math.PI / 2;
        leftCyl.position.y = 0.52;
        leftCyl.castShadow = true;
        leftCyl.receiveShadow = true;
        leftCapGroup.add(leftCyl);

        // 2C. Right End Cap
        const rightCapGroup = new THREE.Group();
        rightCapGroup.position.x = 1.05;
        mailboxGroup.add(rightCapGroup);

        const rightBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.04, 1.24), capMat);
        rightBox.castShadow = true;
        rightBox.receiveShadow = true;
        rightCapGroup.add(rightBox);

        const rightCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 32, 1, false, 0, Math.PI), capMat);
        rightCyl.rotation.z = -Math.PI / 2;
        rightCyl.position.y = 0.52;
        rightCyl.castShadow = true;
        rightCyl.receiveShadow = true;
        rightCapGroup.add(rightCyl);

        // 2D. Solar Panel Strip
        const solarPanel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.8), solarMat);
        solarPanel.position.set(0, 1.11, 0);
        middleBodyGroup.add(solarPanel);

        // 2E. Electric LED Light Bar
        ledMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 16), ledMat);
        ledMesh.rotation.z = -Math.PI / 2;
        ledMesh.position.set(0, 0.5, 0.62);
        mailboxGroup.add(ledMesh);

        // 2F. OLED Screen Display
        const oledScreen = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.25, 0.45), oledTexture);
        oledScreen.position.set(1.11, 0.1, 0.2);
        mailboxGroup.add(oledScreen);

        // OLED Frame
        const oledFrame = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.29, 0.49), bracketMat);
        oledFrame.position.set(1.105, 0.1, 0.2);
        mailboxGroup.add(oledFrame);

        // 2G. Physical Lock & Camera Eye
        const lockBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), chromeMat);
        lockBezel.rotation.x = Math.PI / 2;
        lockBezel.position.set(-0.7, 0.1, 0.62);
        lockBezel.castShadow = true;
        mailboxGroup.add(lockBezel);

        const lockCore = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.022, 24), darkGlassMat);
        lockCore.rotation.x = Math.PI / 2;
        lockCore.position.set(-0.7, 0.1, 0.621);
        mailboxGroup.add(lockCore);

        // 2H. Bottom Mount Post & Flange
        const mountPost = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 0.15), bracketMat);
        mountPost.position.set(0, -1.3, 0);
        mountPost.castShadow = true;
        mailboxGroup.add(mountPost);

        const mountFlange = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), bracketMat);
        mountFlange.position.set(0, -0.52, 0);
        mountFlange.castShadow = true;
        mailboxGroup.add(mountFlange);

        // 2I. Flag/Lever mechanism (aesthetic right side detail)
        const flagBase = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.08), bracketMat);
        flagBase.position.set(1.11, 0.7, -0.3);
        mailboxGroup.add(flagBase);

        const flagArm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.35, 0.03), chromeMat);
        flagArm.position.set(1.125, 0.8, -0.3);
        mailboxGroup.add(flagArm);

        // Setup GSAP Scroll animations
        setupGSAPScroll();

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

    // 3. GSAP ScrollTrigger Sequence Coordinator
    function setupGSAPScroll() {
        // Base scroll progress listener
        let scrollProgress = 0;
        ScrollTrigger.create({
            trigger: 'body',
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: self => {
                scrollProgress = self.progress;
            }
        });

        // Hide/Show canvas overlay labels when leaving/entering the reveal section
        ScrollTrigger.create({
            trigger: '#reveal',
            start: 'top 60%',
            end: 'bottom 40%',
            onLeave: () => { activeStep = null; },
            onLeaveBack: () => { activeStep = null; }
        });

        // Track each step inside the sticky section
        const steps = document.querySelectorAll('.reveal-step');
        steps.forEach(step => {
            const stepName = step.getAttribute('data-step');
            ScrollTrigger.create({
                trigger: step,
                start: 'top 50%',
                end: 'bottom 50%',
                onEnter: () => {
                    activeStep = stepName;
                    updateOledScreen(stepName);
                },
                onEnterBack: () => {
                    activeStep = stepName;
                    updateOledScreen(stepName);
                }
            });
        });

        // 3D Reveal Timeline (Animates mailbox position/rotation through the sticky section)
        const revealTL = gsap.timeline({
            scrollTrigger: {
                trigger: '#reveal',
                start: 'top top',
                end: 'bottom bottom',
                scrub: 1.0,
            }
        });

        // Transition from Hero (right) to Reveal Section Step 1 (Solar Panel focus on the left)
        revealTL.to(mailboxGroup.position, { x: -1.2, y: -0.4, z: 0.1, duration: 1.5 })
                .to(mailboxGroup.scale, { x: 0.95, y: 0.95, z: 0.95, duration: 1.5 }, 0)
                .to(mailboxGroup.rotation, { x: 0.8, y: 0.45, z: 0, duration: 1.5 }, 0)
                .to(camera.position, { z: 5.0, duration: 1.5 }, 0);

        // Step 1 to Step 2 (Front LED accent focus on the left)
        revealTL.to(mailboxGroup.rotation, { x: 0.05, y: 0.15, z: 0, duration: 1.5 })
                .to(mailboxGroup.position, { x: -1.2, y: 0, z: 0.1, duration: 1.5 }, "<")
                .to(camera.position, { z: 5.2, duration: 1.5 }, "<");

        // Step 2 to Step 3 (Right OLED Display focus on the left)
        revealTL.to(mailboxGroup.rotation, { x: 0.1, y: 1.6, z: 0, duration: 1.5 })
                .to(mailboxGroup.position, { x: -1.05, y: -0.1, z: 0.4, duration: 1.5 }, "<")
                .to(camera.position, { z: 4.8, duration: 1.5 }, "<");

        // Step 3 to Step 4 (Front-Left Security Lock focus on the left)
        revealTL.to(mailboxGroup.rotation, { x: 0.05, y: -0.55, z: 0, duration: 1.5 })
                .to(mailboxGroup.position, { x: -1.2, y: 0, z: 0.1, duration: 1.5 }, "<")
                .to(camera.position, { z: 5.0, duration: 1.5 }, "<");

        // Step 4 to Step 5 (Bottom Mount Flange / Bracket focus on the left)
        revealTL.to(mailboxGroup.rotation, { x: -0.25, y: 3.14, z: 0, duration: 1.5 })
                .to(mailboxGroup.position, { x: -1.2, y: 0.5, z: 0, duration: 1.5 }, "<")
                .to(camera.position, { z: 5.2, duration: 1.5 }, "<");

        // --- SUBSEQUENT SECTIONS POSITION MAPS ---
        
        // Solar Feature Section ScrollTrigger
        ScrollTrigger.create({
            trigger: '#features',
            start: 'top 80%',
            end: 'bottom 20%',
            onEnter: () => {
                activeStep = null;
                gsap.to(mailboxGroup.position, { x: 1.25, y: -0.38, z: 0, duration: 1.2, overwrite: 'auto' });
                gsap.to(mailboxGroup.rotation, { x: 0.75, y: 0.35, z: 0, duration: 1.2, overwrite: 'auto' });
                gsap.to(mailboxGroup.scale, { x: 0.95, y: 0.95, z: 0.95, duration: 1.2, overwrite: 'auto' });
                gsap.to(camera.position, { z: 5.0, duration: 1.2, overwrite: 'auto' });
                updateOledCanvasText("SOLAR STRENGTH", "GRID STATUS: 100%", "SOLAR: ACTIVE");
            }
        });

        // Proximity Phone Notification Section ScrollTrigger
        ScrollTrigger.create({
            trigger: '.notifications-section',
            start: 'top 70%',
            end: 'bottom 30%',
            onEnter: () => {
                activeStep = null;
                // Move mailbox left, next to the phone mockup
                gsap.to(mailboxGroup.position, { x: -0.45, y: -0.15, z: 0.1, duration: 1.2, overwrite: 'auto' });
                gsap.to(mailboxGroup.rotation, { x: 0.05, y: 0.25, z: 0, duration: 1.2, overwrite: 'auto' });
                gsap.to(mailboxGroup.scale, { x: 0.95, y: 0.95, z: 0.95, duration: 1.2, overwrite: 'auto' });
                gsap.to(camera.position, { z: 5.2, duration: 1.2, overwrite: 'auto' });
                updateOledCanvasText("LED PULSE TEST", "STATUS: BLUE", "MAIL DETECTED");

                // Pulse LED and light brightness
                gsap.to(ledPointLight, { intensity: 4.5, duration: 0.6, yoyo: true, repeat: 3 });

                // Trigger phone notification banner
                const banner = document.getElementById('notif-1');
                if (banner) banner.classList.add('animate');
            },
            onLeaveBack: () => {
                const banner = document.getElementById('notif-1');
                if (banner) banner.classList.remove('animate');
            }
        });

        // Physical Security Section ScrollTrigger
        ScrollTrigger.create({
            trigger: '.security-section',
            start: 'top 70%',
            end: 'bottom 30%',
            onEnter: () => {
                activeStep = null;
                // Zoom in on lock (left-front angle)
                gsap.to(mailboxGroup.position, { x: 1.15, y: 0, z: 0.5, duration: 1.2, overwrite: 'auto' });
                gsap.to(mailboxGroup.rotation, { x: 0.0, y: -0.45, z: 0, duration: 1.2, overwrite: 'auto' });
                gsap.to(mailboxGroup.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 1.2, overwrite: 'auto' });
                gsap.to(camera.position, { z: 4.8, duration: 1.2, overwrite: 'auto' });
                updateOledCanvasText("LID SECURITY", "LOCK CORE: ENGAGED", "TAMPER SENSOR: ON");
            }
        });

        // Carousel Section (Shift to center background and scale down)
        ScrollTrigger.create({
            trigger: '#audience',
            start: 'top 80%',
            end: 'bottom 20%',
            onEnter: () => {
                activeStep = null;
                gsap.to(mailboxGroup.position, { x: 0, y: -0.6, z: -1.0, duration: 1.5, overwrite: 'auto' });
                gsap.to(mailboxGroup.rotation, { x: 0.15, y: -0.5, z: 0, duration: 1.5, overwrite: 'auto' });
                gsap.to(mailboxGroup.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 1.5, overwrite: 'auto' });
                gsap.to(camera.position, { z: 5.5, duration: 1.5, overwrite: 'auto' });
                updateOledCanvasText("INCO ACTIVE", "CAROUSEL DOCK", "SYS: OPTIMIZED");
            }
        });

        // FAQ Section (Slow rotation on the left side)
        ScrollTrigger.create({
            trigger: '#faq',
            start: 'top 80%',
            end: 'bottom 20%',
            onEnter: () => {
                activeStep = null;
                gsap.to(mailboxGroup.position, { x: -1.25, y: -0.2, z: -0.4, duration: 1.5, overwrite: 'auto' });
                gsap.to(mailboxGroup.rotation, { x: 0.1, y: 0.5, z: 0, duration: 1.5, overwrite: 'auto' });
                gsap.to(mailboxGroup.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 1.5, overwrite: 'auto' });
                gsap.to(camera.position, { z: 5.2, duration: 1.5, overwrite: 'auto' });
            }
        });

        // Final CTA Section (Fade out opacity behind center copy)
        ScrollTrigger.create({
            trigger: '.final-cta-section',
            start: 'top 80%',
            end: 'bottom bottom',
            onEnter: () => {
                activeStep = null;
                gsap.to(mailboxGroup.position, { x: 0, y: -0.4, z: -1.2, duration: 1.5, overwrite: 'auto' });
                gsap.to(mailboxGroup.rotation, { x: 0.15, y: -0.3, z: 0, duration: 1.5, overwrite: 'auto' });
                gsap.to(mailboxGroup.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 1.5, overwrite: 'auto' });
                gsap.to(camera.position, { z: 5.5, duration: 1.5, overwrite: 'auto' });
                container.style.opacity = '0.35';
            },
            onLeaveBack: () => {
                container.style.opacity = '1.0';
            }
        });
    }

    // Coordinate projection from 3D to 2D screen coordinates
    function updateProjectedLabels() {
        const anchorsMap = {
            solar: anchors.solar,
            led: anchors.led,
            display: anchors.display,
            lock: anchors.lock,
            bracket: anchors.bracket
        };

        for (const [key, localVector] of Object.entries(anchorsMap)) {
            const tooltip = document.getElementById(`tooltip-${key}`);
            if (!tooltip) continue;

            if (activeStep === key) {
                tooltip.classList.add('active');
            } else {
                tooltip.classList.remove('active');
                continue;
            }

            // Project local mesh vector into absolute world coordinates
            const worldVector = localVector.clone();
            mailboxGroup.localToWorld(worldVector);
            
            // Project into Camera view space NDC
            worldVector.project(camera);

            // Convert NDC coordinates (-1 to 1) to screen pixels (0 to width/height)
            const x = (worldVector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(worldVector.y * 0.5) + 0.5) * window.innerHeight;

            // Apply style positions
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }
    }

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

        // 1. Gentle float breathing rotation (Only active in Hero Section, where scroll = 0)
        const currentScroll = window.scrollY;
        if (currentScroll < 50) {
            mailboxGroup.rotation.y = -0.4 + Math.sin(time * 0.6) * 0.04;
            mailboxGroup.rotation.x = 0.2 + Math.cos(time * 0.6) * 0.02;
            mailboxGroup.position.y = -0.25 + Math.sin(time * 1.2) * 0.025;
            mailboxGroup.position.x = 1.35;
            mailboxGroup.scale.set(1.25, 1.25, 1.25);
        }

        // 2. Pulse emissive LED light bar strip and PointLight intensity
        if (ledMesh) {
            const pulse = Math.sin(time * 3.0) * 0.3 + 0.7; // 0.4 to 1.0
            ledMesh.material.emissiveIntensity = 2.5 + pulse * 1.5;
            if (currentScroll < 50 || activeStep === 'led') {
                ledPointLight.intensity = 1.2 + pulse * 0.8;
            }
        }

        // 3. Update coordinate tooltips overlay
        if (activeStep) {
            updateProjectedLabels();
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
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    dockNav.addEventListener('mouseleave', () => {
        const currentActive = document.querySelector('.dock-link.active');
        moveBubble(currentActive);
    });

    // Update active nav dot as user scrolls page
    const sections = ['#hero', '#reveal', '#features', '#audience', '#faq'];
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

// 7. Audience Carousel Scrolling
function setupCarousel() {
    const track = document.querySelector('.carousel-track');
    const leftBtn = document.getElementById('carousel-left');
    const rightBtn = document.getElementById('carousel-right');

    if (!track || !leftBtn || !rightBtn) return;

    leftBtn.addEventListener('click', () => {
        track.scrollBy({ left: -350, behavior: 'smooth' });
    });

    rightBtn.addEventListener('click', () => {
        track.scrollBy({ left: 350, behavior: 'smooth' });
    });
}
