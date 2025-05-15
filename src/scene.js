import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'stats.js';
import * as dat from 'dat.gui';

export class Visualizer {
    constructor(canvas) {
        console.log("Visualizer: constructor called with canvas:", canvas);
        this.canvas = canvas;
        this.isAudioActive = false;

        if (!this.canvas) {
            console.error("Visualizer Constructor: Canvas element is null or undefined! App may not function.");
        }

        this.setupStats();
        this.setupSettingsAndGUI();
        this.setupRendererAndScene();
        this.createSceneObjects();
        this.addPostProcessing();
        this.addEventListeners();
        console.log("Visualizer: constructor finished.");
    }

    setupStats() {
        console.log("Visualizer: setupStats");
        this.stats = new Stats();
        if (!document.body.contains(this.stats.dom)) {
            document.body.appendChild(this.stats.dom);
        }
    }

    setupSettingsAndGUI() {
        console.log("Visualizer: setupSettingsAndGUI");
        this.settings = {
            // Existing Particle Settings
            particleCount: 6000,
            particleSize: 0.8,
            rotationSpeed: 0.1,
            
            // Existing Sphere Settings (some will be repurposed or augmented)
            sphereRotationSpeed: 0.15,
            
            // --- NEW SPHERE SETTINGS ---
            sphereDetail: 15,                  // Initial detail for sphere geometry
            noiseTimeScale: 0.1,             // How fast the noise pattern animates (will be used in shader)
            baseDisplacementAmount: 0.15,      // Base amount of noise displacement (will be used in shader)
            audioDisplacementScale: 0.4,     // How much audio scales the base displacement (will be used in shader)
            
            // Sphere Color Settings (for new shader)
            colorA_R: 0.0, colorA_G: 0.2, colorA_B: 1.0, // Start of gradient (Blue)
            colorB_R: 0.8, colorB_G: 0.0, colorB_B: 0.8, // End of gradient (Purple/Magenta)
            colorBrightnessScale: 1.0,       // Base brightness of the sphere (for new shader)
            audioColorBrightnessScale: 1.5,  // How much audio boosts brightness (for new shader)
            // --- END NEW SPHERE SETTINGS ---

            // Existing Bloom Settings
            bloomStrength: 0.8,       
            bloomRadius: 0.7,         
            bloomThreshold: 0.8,      
            audioBloomFactor: 1.2     
        };

        if (this.gui) {
            console.warn("Visualizer: GUI might already exist. Attempting to destroy old one.");
            try { this.gui.destroy(); } catch(e) { /* ignore */ }
        }
        this.gui = new dat.GUI();

        const particleFolder = this.gui.addFolder('Particles');
        particleFolder.add(this.settings, 'particleCount', 1000, 50000, 1000).name('Count').onChange(() => this.recreateParticles());
        particleFolder.add(this.settings, 'particleSize', 0.1, 5).name('Global Scale');
        particleFolder.add(this.settings, 'rotationSpeed', 0, 1).name('System Speed');

        const sphereFolder = this.gui.addFolder('Sphere Visuals'); // Renamed for clarity
        sphereFolder.add(this.settings, 'sphereRotationSpeed', 0, 0.5, 0.01).name('Rotation Speed');
        sphereFolder.add(this.settings, 'sphereDetail', 5, 30, 1).name('Detail').onChange(() => this.recreateSphere());
        sphereFolder.add(this.settings, 'noiseTimeScale', 0.0, 1.0, 0.01).name('Noise Anim Speed');
        sphereFolder.add(this.settings, 'baseDisplacementAmount', 0.0, 0.5, 0.01).name('Base Displacement');
        sphereFolder.add(this.settings, 'audioDisplacementScale', 0.0, 1.0, 0.01).name('Audio Disp. Scale');
        sphereFolder.open(); // Open this by default to see new controls

        const sphereColorFolder = sphereFolder.addFolder('Colors');
        sphereColorFolder.add(this.settings, 'colorA_R', 0, 1, 0.01).name('Color A Red');
        sphereColorFolder.add(this.settings, 'colorA_G', 0, 1, 0.01).name('Color A Green');
        sphereColorFolder.add(this.settings, 'colorA_B', 0, 1, 0.01).name('Color A Blue');
        sphereColorFolder.add(this.settings, 'colorB_R', 0, 1, 0.01).name('Color B Red');
        sphereColorFolder.add(this.settings, 'colorB_G', 0, 1, 0.01).name('Color B Green');
        sphereColorFolder.add(this.settings, 'colorB_B', 0, 1, 0.01).name('Color B Blue');
        sphereColorFolder.add(this.settings, 'colorBrightnessScale', 0.1, 3.0, 0.05).name('Base Brightness');
        sphereColorFolder.add(this.settings, 'audioColorBrightnessScale', 0.0, 5.0, 0.05).name('Audio Brightness');
        // sphereColorFolder.open();

        const bloomFolder = this.gui.addFolder('Bloom');
        bloomFolder.add(this.settings, 'bloomStrength', 0, 5).name('Base Strength');
        bloomFolder.add(this.settings, 'bloomRadius', 0, 2).name('Radius');
        bloomFolder.add(this.settings, 'bloomThreshold', 0, 1, 0.01).name('Threshold');
        bloomFolder.add(this.settings, 'audioBloomFactor', 0, 5).name('Audio Boost');
        bloomFolder.open();
    }

    setupRendererAndScene() {
        console.log("Visualizer: setupRendererAndScene");
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 8;
        this.camera.lookAt(this.scene.position);
        console.log("Camera position:", this.camera.position.toArray().join(', '));


        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
    }

    createSceneObjects() {
        console.log("Visualizer: createSceneObjects");
        // Use initial sphereDetail setting for geometry
        const sphereGeometry = new THREE.IcosahedronGeometry(1.5, Math.floor(this.settings.sphereDetail)); 
        this.sphereMaterial = new THREE.ShaderMaterial({
            uniforms: { // Existing uniforms + new ones
                time: { value: 0 },
                bass: { value: 0 },
                lowMid: { value: 0 },
                mid: { value: 0 },
                highMid: { value: 0 },
                treble: { value: 0 },
                volume: { value: 0 },

                // New uniforms to be used by the overhauled shaders
                noiseTimeScale: { value: this.settings.noiseTimeScale },
                baseDisplacementAmount: { value: this.settings.baseDisplacementAmount },
                audioDisplacementScale: { value: this.settings.audioDisplacementScale },
                
                colorA: { value: new THREE.Color(this.settings.colorA_R, this.settings.colorA_G, this.settings.colorA_B) },
                colorB: { value: new THREE.Color(this.settings.colorB_R, this.settings.colorB_G, this.settings.colorB_B) },
                colorBrightnessScale: { value: this.settings.colorBrightnessScale },
                audioColorBrightnessScale: { value: this.settings.audioColorBrightnessScale },
            },
            // Shaders will be replaced in the next step; for now, keep the previous working ones
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying vec3 vViewNormal;
                
                uniform float bass;
                uniform float mid; 
                uniform float time;

                // These new uniforms won't be used by *this* old shader yet
                uniform float noiseTimeScale; 
                uniform float baseDisplacementAmount;
                uniform float audioDisplacementScale;


                void main() {
                    vWorldPosition = position;
                    
                    float displacement = bass * 0.5 * sin(position.y * 10.0 + time * 2.5 + position.x * 5.0);
                    displacement += mid * 0.2 * cos(position.x * 8.0 - time * 1.5 + position.z * 6.0);
                    vec3 newPosition = position + normal * displacement;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    vViewNormal = normalize(normalMatrix * normal);
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying vec3 vViewNormal;

                uniform float bass;
                uniform float lowMid; 
                uniform float mid;
                uniform float highMid; 
                uniform float treble;
                uniform float volume;
                uniform float time;

                // These new uniforms won't be used by *this* old shader yet
                uniform vec3 colorA;
                uniform vec3 colorB;
                uniform float colorBrightnessScale;
                uniform float audioColorBrightnessScale;
                
                float mySmoothstep(float edge0, float edge1, float x) {
                    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
                    return t * t * (3.0 - 2.0 * t);
                }

                void main() {
                    vec3 baseColor = vec3(0.02, 0.02, 0.04); 

                    vec3 bassColorContribution = vec3(0.7, 0.08, 0.08) * mySmoothstep(0.2, 0.9, bass); 
                    vec3 midColorContribution = vec3(0.08, 0.6, 0.15) * mySmoothstep(0.15, 0.8, mid);
                    vec3 trebleColorContribution = vec3(0.15, 0.2, 0.7) * mySmoothstep(0.2, 0.7, treble);
                    
                    vec3 audioColor = bassColorContribution + midColorContribution + trebleColorContribution;

                    vec3 color = baseColor + audioColor;
                    
                    float pulseStrength = (1.0 + sin(time * 5.0 + vWorldPosition.y * 4.0)) * 0.5; 
                    pulseStrength *= (volume * volume * 0.6); 

                    color += vec3(0.25, 0.2, 0.15) * pulseStrength; 
                    
                    float fresnelDot = abs(dot(normalize(vViewNormal), normalize(vViewPosition)));
                    float fresnelEffect = pow(1.0 - fresnelDot, 3.5); 

                    color += vec3(0.5, 0.6, 0.7) * fresnelEffect * (0.15 + volume * 0.5); 

                    color = clamp(color, 0.0, 1.2); 

                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        this.sphere = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
        this.scene.add(this.sphere);
        this.sphere.updateMatrixWorld(true);
        const sphereWorldPos = new THREE.Vector3();
        this.sphere.getWorldPosition(sphereWorldPos);
        console.log("Sphere added to scene. Calculated world position:", sphereWorldPos.toArray().join(', '));
        console.log("Sphere visible:", this.sphere.visible);


        this.createParticles();
    }

    recreateSphere() {
        console.log("Visualizer: Recreating sphere due to detail change.");
        if (this.sphere) {
            this.scene.remove(this.sphere);
            this.sphere.geometry.dispose(); // Dispose the old geometry
            // Material is reused, its uniforms are updated in animateScene
        }
    
        // Create new geometry with the updated detail
        const newSphereGeometry = new THREE.IcosahedronGeometry(1.5, Math.floor(this.settings.sphereDetail));
        
        // If material definition itself depends on something like #defines based on detail,
        // you might need to dispose and recreate this.sphereMaterial as well.
        // For now, assuming material structure is constant.
        this.sphere = new THREE.Mesh(newSphereGeometry, this.sphereMaterial);
        this.scene.add(this.sphere);
        console.log("Visualizer: Sphere recreated with detail:", this.settings.sphereDetail);
    }


    createParticles() {
        // ... (unchanged from previous full version) ...
        console.log("Visualizer: createParticles (re)called");
        if (this.particleSystem) {
            console.log("Visualizer: Disposing old particle system");
            this.scene.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            if (this.particleSystem.material.uniforms.pointTexture.value) {
                this.particleSystem.material.uniforms.pointTexture.value.dispose();
            }
            this.particleSystem.material.dispose();
            this.particleSystem = null;
        }

        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(this.settings.particleCount * 3);
        const colors = new Float32Array(this.settings.particleCount * 3);
        const baseSizes = new Float32Array(this.settings.particleCount); 
        const randomFactors = new Float32Array(this.settings.particleCount); 

        const particleOuterRadius = 15; 
        const particleInnerRadius = 2.5; 

        for (let i = 0; i < this.settings.particleCount; i++) {
            const i3 = i * 3;
            const radius = particleInnerRadius + Math.random() * (particleOuterRadius - particleInnerRadius);
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos((Math.random() * 2) - 1); 

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);

            colors[i3] = 0.6 + Math.random() * 0.4; 
            colors[i3 + 1] = 0.6 + Math.random() * 0.4;
            colors[i3 + 2] = 0.6 + Math.random() * 0.4;

            baseSizes[i] = 0.5 + Math.random() * 1.0; 
            randomFactors[i] = Math.random(); 
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes, 1)); 
        particles.setAttribute('randomFactor', new THREE.BufferAttribute(randomFactors, 1));


        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pointTexture: { value: this.generateParticleTexture() },
                globalParticleScale: { value: this.settings.particleSize }, 
                audioVolume: { value: 0.0 }, 
                audioMid: { value: 0.0 }      
            },
            vertexShader: `
                attribute float baseSize; 
                attribute vec3 color;
                attribute float randomFactor;

                varying vec3 vColor;
                varying float vAlphaRandom;

                uniform float time;
                uniform float globalParticleScale; 
                uniform float audioVolume;
                uniform float audioMid;
                
                void main() {
                    vColor = color;
                    vAlphaRandom = 0.5 + randomFactor * 0.5; 

                    vec3 pos = position;
                    
                    float angle = time * 0.05 * (1.0 + randomFactor * 0.8); 
                    float s = sin(angle + randomFactor * 6.28); 
                    float c = cos(angle + randomFactor * 6.28);
                    mat2 rotXZ = mat2(c, -s, s, c);
                    pos.xz = rotXZ * pos.xz;
                    pos.xy = rotXZ * pos.xy; 

                    pos.y += sin(time * 0.2 + randomFactor * 10.0) * 0.3 * (1.0 + audioMid * 2.0);


                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    float audioSizeFactor = 1.0 + audioVolume * 0.8 + audioMid * 1.2; 
                    gl_PointSize = baseSize * globalParticleScale * audioSizeFactor * (100.0 / -mvPosition.z); 
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                varying float vAlphaRandom; 
                
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    float alpha = texColor.a * vAlphaRandom; 
                    if (alpha < 0.01) discard; 
                    gl_FragColor = vec4(vColor * texColor.rgb, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false 
        });

        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.particleSystem);
        console.log("Visualizer: New particle system created and added");
    }

    generateParticleTexture() {
        // ... (unchanged) ...
        const canvas = document.createElement('canvas');
        canvas.width = 128; 
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const center = canvas.width / 2;

        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0,    'rgba(255,255,255,1)');
        gradient.addColorStop(0.15, 'rgba(255,255,255,0.95)'); 
        gradient.addColorStop(0.4,  'rgba(255,255,255,0.6)');
        gradient.addColorStop(0.8,  'rgba(255,255,255,0.1)');
        gradient.addColorStop(1,    'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        return new THREE.CanvasTexture(canvas);
    }

    addPostProcessing() {
        // ... (unchanged) ...
        console.log("Visualizer: addPostProcessing");
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.settings.bloomStrength, 
            this.settings.bloomRadius,   
            this.settings.bloomThreshold 
        );
        this.composer.addPass(this.bloomPass);
    }

    addEventListeners() {
        // ... (unchanged) ...
        console.log("Visualizer: addEventListeners");
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
            console.log("Visualizer: Resized");
        });
    }

    animateScene(deltaTime, audioData) {
        this.stats.begin();
        this.controls.update(); 

        // --- UPDATE NEW SPHERE UNIFORMS FROM GUI SETTINGS ---
        if (this.sphereMaterial) { // Ensure material exists
            this.sphereMaterial.uniforms.noiseTimeScale.value = this.settings.noiseTimeScale;
            this.sphereMaterial.uniforms.baseDisplacementAmount.value = this.settings.baseDisplacementAmount;
            this.sphereMaterial.uniforms.audioDisplacementScale.value = this.settings.audioDisplacementScale;
            this.sphereMaterial.uniforms.colorA.value.setRGB(this.settings.colorA_R, this.settings.colorA_G, this.settings.colorA_B);
            this.sphereMaterial.uniforms.colorB.value.setRGB(this.settings.colorB_R, this.settings.colorB_G, this.settings.colorB_B);
            this.sphereMaterial.uniforms.colorBrightnessScale.value = this.settings.colorBrightnessScale;
            this.sphereMaterial.uniforms.audioColorBrightnessScale.value = this.settings.audioColorBrightnessScale;
        }
        // --- END NEW UNIFORM UPDATES ---

        const sphereRotSpeed = this.settings.sphereRotationSpeed * deltaTime;
        if (this.sphere) { // Ensure sphere exists
            this.sphere.rotation.x += sphereRotSpeed * 0.3; 
            this.sphere.rotation.y += sphereRotSpeed * 0.5;
            this.sphere.rotation.z += sphereRotSpeed * 0.2;
            this.sphereMaterial.uniforms.time.value += deltaTime * (1.0 + (audioData ? audioData.volume * 2.0 : 0.0)); 
        }


        if (this.particleSystem) {
            this.particleSystem.rotation.y += this.settings.rotationSpeed * deltaTime * 0.3;
            this.particleSystem.material.uniforms.time.value += deltaTime;
            this.particleSystem.material.uniforms.globalParticleScale.value = this.settings.particleSize;
        }
        
        this.bloomPass.radius = this.settings.bloomRadius;
        this.bloomPass.threshold = this.settings.bloomThreshold;
        let currentBloomStrength = this.settings.bloomStrength; 

        this.isAudioActive = !!audioData;

        if (audioData) {
            // Update existing audio uniforms for sphere (still used by current old shader)
            if (this.sphereMaterial) {
                this.sphereMaterial.uniforms.bass.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.bass.value, audioData.frequencies.bass, 0.2);
                this.sphereMaterial.uniforms.lowMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.lowMid.value, audioData.frequencies.lowMid, 0.2);
                this.sphereMaterial.uniforms.mid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.mid.value, audioData.frequencies.mid, 0.2);
                this.sphereMaterial.uniforms.highMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.highMid.value, audioData.frequencies.highMid, 0.2);
                this.sphereMaterial.uniforms.treble.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.treble.value, audioData.frequencies.treble, 0.2);
                this.sphereMaterial.uniforms.volume.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.volume.value, audioData.volume, 0.2);
            }


            if (this.particleSystem) {
                this.particleSystem.material.uniforms.audioVolume.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioVolume.value, audioData.volume, 0.1);
                this.particleSystem.material.uniforms.audioMid.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioMid.value, audioData.frequencies.mid, 0.1);

                const colors = this.particleSystem.geometry.attributes.color.array;
                for (let i = 0; i < this.settings.particleCount; i++) {
                    const i3 = i * 3;
                    colors[i3] = THREE.MathUtils.lerp(colors[i3], 0.2 + audioData.frequencies.bass * 0.5, 0.1); 
                    colors[i3 + 1] = THREE.MathUtils.lerp(colors[i3 + 1], 0.2 + audioData.frequencies.mid * 0.5, 0.1);
                    colors[i3 + 2] = THREE.MathUtils.lerp(colors[i3 + 2], 0.2 + audioData.frequencies.treble * 0.5, 0.1);
                }
                this.particleSystem.geometry.attributes.color.needsUpdate = true;
            }
            currentBloomStrength += audioData.volume * this.settings.audioBloomFactor;
        } else {
            // Smoothly dampen audio uniforms when no audio
            if (this.sphereMaterial) {
                this.sphereMaterial.uniforms.bass.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.bass.value, 0, 0.1);
                this.sphereMaterial.uniforms.mid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.mid.value, 0, 0.1);
                this.sphereMaterial.uniforms.lowMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.lowMid.value, 0, 0.1);
                this.sphereMaterial.uniforms.highMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.highMid.value, 0, 0.1);
                this.sphereMaterial.uniforms.treble.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.treble.value, 0, 0.1);
                this.sphereMaterial.uniforms.volume.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.volume.value, 0, 0.1);
            }

            if (this.particleSystem) {
                this.particleSystem.material.uniforms.audioVolume.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioVolume.value, 0, 0.05);
                this.particleSystem.material.uniforms.audioMid.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioMid.value, 0, 0.05);
            }
        }
        
        this.bloomPass.strength = currentBloomStrength;

        this.composer.render(); 
        this.stats.end();
    }

    recreateParticles() {
        console.log("Visualizer: recreateParticles called by GUI change");
        this.createParticles();
    }
}
console.log("src/scene.js: Parsed and Visualizer class is exported.");