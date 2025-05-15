import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'stats.js';
import * as dat from 'dat.gui';

const LOCAL_STORAGE_KEY = 'visualizerPreset_v1'; // Added a version to key for future-proofing

export class Visualizer {
    constructor(canvas) {
        console.log("Visualizer: constructor called with canvas:", canvas);
        this.canvas = canvas;
        this.isAudioActive = false;
        this.initialSettings = {}; // To store a copy of the initial default settings

        if (!this.canvas) {
            console.error("Visualizer Constructor: Canvas element is null or undefined! App may not function.");
        }

        this.setupStats();
        this.setupSettingsAndGUI(); 
        this.setupRendererAndScene();
        this.createSceneObjects(); // This will use settings, potentially loaded ones
        this.addPostProcessing();
        this.addEventListeners();

        // Attempt to load a preset on startup AFTER GUI is initialized
        // so GUI can reflect loaded values.
        this.loadPreset(); 
        console.log("Visualizer: constructor finished.");
    }

    setupStats() {
        console.log("Visualizer: setupStats");
        this.stats = new Stats();
        if (!document.body.contains(this.stats.dom)) {
            document.body.appendChild(this.stats.dom);
        }
    }

    defineDefaultSettings() {
        return {
            particleCount: 6000,
            particleSize: 0.8,
            rotationSpeed: 0.1,
            sphereRotationSpeed: 0.15,
            bloomStrength: 0.8,     
            bloomRadius: 0.7,        
            bloomThreshold: 0.8,     
            audioBloomFactor: 1.2,
            sphereNoiseStrength: 0.15,
            sphereNoiseSpeed: 0.3,
            particleMinLife: 2.0, 
            particleMaxLife: 5.0
        };
    }

    setupSettingsAndGUI() {
        console.log("Visualizer: setupSettingsAndGUI");
        this.initialSettings = this.defineDefaultSettings();
        this.settings = { ...this.initialSettings }; 

        if (this.gui && typeof this.gui.destroy === 'function') { // Check if GUI exists and can be destroyed
            console.warn("Visualizer: GUI might already exist. Attempting to destroy old one.");
            try { this.gui.destroy(); } catch(e) { console.error("Error destroying old GUI", e); }
        }
        this.gui = new dat.GUI();

        this.presetControls = {
            savePreset: () => this.savePreset(),
            loadPreset: () => this.loadPreset(),
            resetToDefaults: () => this.resetToDefaults()
        };
        const presetFolder = this.gui.addFolder('Presets');
        presetFolder.add(this.presetControls, 'savePreset').name('Save Current');
        presetFolder.add(this.presetControls, 'loadPreset').name('Load Saved');
        presetFolder.add(this.presetControls, 'resetToDefaults').name('Reset Defaults');
        presetFolder.open();

        const particleFolder = this.gui.addFolder('Particles');
        particleFolder.add(this.settings, 'particleCount', 1000, 50000, 1000).name('Count').onChange(() => this.recreateParticles());
        particleFolder.add(this.settings, 'particleSize', 0.1, 5).name('Global Scale');
        particleFolder.add(this.settings, 'rotationSpeed', 0, 1).name('System Speed');
        particleFolder.add(this.settings, 'particleMinLife', 0.5, 10.0).name('Min Lifespan (s)');
        particleFolder.add(this.settings, 'particleMaxLife', 1.0, 20.0).name('Max Lifespan (s)');
        // particleFolder.open(); 

        const sphereFolder = this.gui.addFolder('Sphere');
        sphereFolder.add(this.settings, 'sphereRotationSpeed', 0, 1).name('Rotation Speed');
        sphereFolder.add(this.settings, 'sphereNoiseStrength', 0, 0.5, 0.01).name('Noise Strength');
        sphereFolder.add(this.settings, 'sphereNoiseSpeed', 0, 1, 0.01).name('Noise Speed');     

        const bloomFolder = this.gui.addFolder('Bloom');
        bloomFolder.add(this.settings, 'bloomStrength', 0, 5).name('Base Strength');
        bloomFolder.add(this.settings, 'bloomRadius', 0, 2).name('Radius');
        bloomFolder.add(this.settings, 'bloomThreshold', 0, 1).name('Threshold');
        bloomFolder.add(this.settings, 'audioBloomFactor', 0, 5).name('Audio Boost');
        // bloomFolder.open(); // Usually gets opened by presetFolder if it's the last one.
    }

    savePreset() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.settings));
            console.log("Preset saved to localStorage:", this.settings);
            alert("Preset Saved!");
        } catch (e) {
            console.error("Error saving preset to localStorage:", e);
            alert("Error saving preset. LocalStorage might be full or disabled.");
        }
    }

    loadPreset() {
        try {
            const savedPresetJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedPresetJSON) {
                const loadedSettings = JSON.parse(savedPresetJSON);
                console.log("Preset loaded from localStorage:", loadedSettings);

                const currentParticleCount = this.settings.particleCount;

                Object.keys(this.initialSettings).forEach(key => {
                    if (loadedSettings.hasOwnProperty(key)) {
                        this.settings[key] = loadedSettings[key];
                    } else {
                        this.settings[key] = this.initialSettings[key]; 
                    }
                });
                
                this.refreshGUI();
                
                if (this.settings.particleCount !== currentParticleCount) {
                    this.recreateParticles(); 
                }
                // Non-GUI related updates that depend on settings might need to be called here
                // For example, if bloom pass parameters were not directly tied to settings object
                // but were set once. However, our animateScene updates them.
                 alert("Preset Loaded!");
            } else {
                console.log("No preset found in localStorage. Using current/default settings.");
                // No alert here to avoid annoying pop-up on first load.
            }
        } catch (e) {
            console.error("Error loading preset from localStorage:", e);
            alert("Error loading preset. It might be corrupted. Resetting to defaults.");
            this.resetToDefaults();
        }
    }

    resetToDefaults() {
        console.log("Resetting settings to defaults.");
        const currentParticleCount = this.settings.particleCount;
        // Re-assign this.settings to a fresh copy of initialSettings
        Object.keys(this.initialSettings).forEach(key => {
            this.settings[key] = this.initialSettings[key];
        });
        
        this.refreshGUI();
        
        if (this.settings.particleCount !== currentParticleCount) {
            this.recreateParticles();
        }
        alert("Settings reset to defaults!");
    }

    refreshGUI() {
        if (this.gui && this.gui.__controllers) {
            this.gui.__controllers.forEach(controller => {
                if(typeof controller.updateDisplay === 'function') controller.updateDisplay();
            });
        }
        if (this.gui && this.gui.__folders) {
            Object.values(this.gui.__folders).forEach(folder => {
                if (folder.__controllers) {
                    folder.__controllers.forEach(controller => {
                        if(typeof controller.updateDisplay === 'function') controller.updateDisplay();
                    });
                }
            });
        }
        console.log("GUI refreshed.");
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
        const sphereGeometry = new THREE.IcosahedronGeometry(1.5, 15);
        this.sphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                bass: { value: 0 },
                lowMid: { value: 0 },
                mid: { value: 0 },
                highMid: { value: 0 },
                treble: { value: 0 },
                volume: { value: 0 },
                sphereNoiseStrength: { value: this.settings.sphereNoiseStrength },
                sphereNoiseSpeed: { value: this.settings.sphereNoiseSpeed }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying vec3 vViewNormal;
                varying float vNoise;
                uniform float bass;
                uniform float mid; 
                uniform float treble;
                uniform float time;
                uniform float sphereNoiseStrength;
                uniform float sphereNoiseSpeed;
                float rand(vec2 n) { 
                    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                }
                float fbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 2.0; 
                    for (int i = 0; i < 4; i++) { 
                        value += amplitude * rand(p.xy * frequency + time * sphereNoiseSpeed * 0.5); 
                        p.xy += vec2(10.0); 
                        amplitude *= 0.5; 
                        frequency *= 2.0; 
                    }
                    return value;
                }
                void main() {
                    vWorldPosition = position;
                    vNoise = fbm(position * 2.0); 
                    float audioDisplacement = bass * 0.45 * sin(position.y * 10.0 + time * 2.5 + position.x * 5.0);
                    audioDisplacement += mid * 0.25 * cos(position.x * 8.0 - time * 1.5 + position.z * 6.0);
                    audioDisplacement += treble * 0.15 * sin(position.z * 12.0 + time * 1.8 + position.y * 4.0);
                    float noiseDisplacement = (vNoise - 0.25) * sphereNoiseStrength * (1.0 + bass * 0.5); 
                    vec3 newPosition = position + normal * (audioDisplacement + noiseDisplacement);
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
                varying float vNoise; 
                uniform float bass;
                uniform float mid;
                uniform float treble;
                uniform float volume;
                uniform float time;
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
                    color *= (0.8 + vNoise * 0.6); 
                    float pulseStrength = (1.0 + sin(time * 5.0 + vWorldPosition.y * 4.0)) * 0.5; 
                    pulseStrength *= (volume * volume * 0.6 * (0.5 + vNoise)); 
                    color += vec3(0.25, 0.2, 0.15) * pulseStrength; 
                    float fresnelDot = abs(dot(normalize(vViewNormal), normalize(vViewPosition)));
                    float fresnelEffect = pow(1.0 - fresnelDot, 3.5); 
                    color += vec3(0.5, 0.6, 0.7) * fresnelEffect * (0.15 + volume * 0.5); 
                    color = clamp(color, 0.0, 1.3); 
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

    createParticles() {
        console.log("Visualizer: createParticles (re)called with lifespan logic");
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
        const life = new Float32Array(this.settings.particleCount);
        const maxLife = new Float32Array(this.settings.particleCount);
        const particleOuterRadius = 15; 
        const particleInnerRadius = 2.5; 
        for (let i = 0; i < this.settings.particleCount; i++) {
            this.resetParticle(i, positions, colors, baseSizes, randomFactors, life, maxLife);
        }
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('baseSize', new THREE.BufferAttribute(baseSizes, 1)); 
        particles.setAttribute('randomFactor', new THREE.BufferAttribute(randomFactors, 1));
        particles.setAttribute('life', new THREE.BufferAttribute(life, 1)); 
        particles.setAttribute('maxLife', new THREE.BufferAttribute(maxLife, 1)); 
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
                attribute float life;     
                attribute float maxLife;  
                varying vec3 vColor;
                varying float vAlpha; 
                uniform float time;
                uniform float globalParticleScale; 
                uniform float audioVolume;
                uniform float audioMid;
                void main() {
                    vColor = color;
                    float normalizedAge = 1.0 - (life / maxLife); 
                    float fadeInDuration = 0.2;
                    float fadeOutStartTime = 0.7;
                    if (normalizedAge < fadeInDuration) {
                        vAlpha = normalizedAge / fadeInDuration; 
                    } else if (normalizedAge > fadeOutStartTime) {
                        vAlpha = 1.0 - ((normalizedAge - fadeOutStartTime) / (1.0 - fadeOutStartTime)); 
                    } else {
                        vAlpha = 1.0; 
                    }
                    vAlpha = clamp(vAlpha, 0.0, 1.0) * (0.5 + randomFactor * 0.5); 
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
                    gl_PointSize *= vAlpha; 
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                varying float vAlpha; 
                void main() {
                    if (vAlpha < 0.01) discard; 
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    gl_FragColor = vec4(vColor * texColor.rgb, texColor.a * vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false 
        });
        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.particleSystem);
        console.log("Visualizer: New particle system created and added with lifespan attributes.");
    }

    resetParticle(index, positions, colors, baseSizes, randomFactors, life, maxLife) {
        const i3 = index * 3;
        const particleOuterRadius = 15; 
        const particleInnerRadius = 2.5; 
        const radius = particleInnerRadius + Math.random() * (particleOuterRadius - particleInnerRadius);
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        colors[i3] = 0.6 + Math.random() * 0.4; 
        colors[i3 + 1] = 0.6 + Math.random() * 0.4;
        colors[i3 + 2] = 0.6 + Math.random() * 0.4;
        baseSizes[index] = 0.5 + Math.random() * 1.0; 
        randomFactors[index] = Math.random(); 
        const lifeRange = this.settings.particleMaxLife - this.settings.particleMinLife;
        maxLife[index] = this.settings.particleMinLife + Math.random() * lifeRange;
        if (maxLife[index] <=0.1) maxLife[index] = Math.max(0.1, this.settings.particleMinLife); // Ensure positive & reasonable min
        life[index] = maxLife[index];
    }

    generateParticleTexture() {
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
        console.log("Visualizer: addEventListeners");
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            if (this.composer) { // Check if composer exists
                this.composer.setSize(window.innerWidth, window.innerHeight);
            }
            console.log("Visualizer: Resized");
        });
    }

    animateScene(deltaTime, audioData) {
        this.stats.begin();
        this.controls.update(); 

        this.sphereMaterial.uniforms.sphereNoiseStrength.value = this.settings.sphereNoiseStrength;
        this.sphereMaterial.uniforms.sphereNoiseSpeed.value = this.settings.sphereNoiseSpeed;

        const sphereRotSpeed = this.settings.sphereRotationSpeed * deltaTime;
        this.sphere.rotation.x += sphereRotSpeed * 0.3; 
        this.sphere.rotation.y += sphereRotSpeed * 0.5;
        this.sphere.rotation.z += sphereRotSpeed * 0.2;
        this.sphereMaterial.uniforms.time.value += deltaTime * (1.0 + (audioData ? audioData.volume * 2.0 : 0.0)); 

        if (this.particleSystem && this.particleSystem.geometry) { // Ensure particle system and geometry exist
            this.particleSystem.rotation.y += this.settings.rotationSpeed * deltaTime * 0.3;
            this.particleSystem.material.uniforms.time.value += deltaTime;
            this.particleSystem.material.uniforms.globalParticleScale.value = this.settings.particleSize;

            const positions = this.particleSystem.geometry.attributes.position.array;
            const colors = this.particleSystem.geometry.attributes.color.array;
            const baseSizes = this.particleSystem.geometry.attributes.baseSize.array;
            const randomFactors = this.particleSystem.geometry.attributes.randomFactor.array;
            const life = this.particleSystem.geometry.attributes.life.array;
            const maxLife = this.particleSystem.geometry.attributes.maxLife.array;
            let needsRespawnUpdate = false;

            for (let i = 0; i < this.settings.particleCount; i++) {
                life[i] -= deltaTime;
                if (life[i] <= 0) {
                    this.resetParticle(i, positions, colors, baseSizes, randomFactors, life, maxLife);
                    needsRespawnUpdate = true;
                }
            }
            this.particleSystem.geometry.attributes.life.needsUpdate = true;
            if (needsRespawnUpdate) {
                this.particleSystem.geometry.attributes.position.needsUpdate = true;
                this.particleSystem.geometry.attributes.color.needsUpdate = true; // Colors also reset on respawn
                this.particleSystem.geometry.attributes.baseSize.needsUpdate = true;
                this.particleSystem.geometry.attributes.randomFactor.needsUpdate = true;
                this.particleSystem.geometry.attributes.maxLife.needsUpdate = true;
            }
        }
        
        this.bloomPass.radius = this.settings.bloomRadius;
        this.bloomPass.threshold = this.settings.bloomThreshold;
        let currentBloomStrength = this.settings.bloomStrength; 

        this.isAudioActive = !!audioData;

        if (audioData) {
            this.sphereMaterial.uniforms.bass.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.bass.value, audioData.frequencies.bass, 0.2);
            this.sphereMaterial.uniforms.lowMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.lowMid.value, audioData.frequencies.lowMid, 0.2);
            this.sphereMaterial.uniforms.mid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.mid.value, audioData.frequencies.mid, 0.2);
            this.sphereMaterial.uniforms.highMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.highMid.value, audioData.frequencies.highMid, 0.2);
            this.sphereMaterial.uniforms.treble.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.treble.value, audioData.frequencies.treble, 0.2);
            this.sphereMaterial.uniforms.volume.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.volume.value, audioData.volume, 0.2);

            if (this.particleSystem && this.particleSystem.geometry) { // Ensure particle system and geometry exist
                this.particleSystem.material.uniforms.audioVolume.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioVolume.value, audioData.volume, 0.1);
                this.particleSystem.material.uniforms.audioMid.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioMid.value, audioData.frequencies.mid, 0.1);

                const particleColors = this.particleSystem.geometry.attributes.color.array;
                // Only update particle colors if they weren't just reset by a respawn
                if (!this.particleSystem.geometry.attributes.color.needsUpdate) { 
                    for (let i = 0; i < this.settings.particleCount; i++) {
                        const i3 = i * 3;
                        particleColors[i3] = THREE.MathUtils.lerp(particleColors[i3], 0.2 + audioData.frequencies.bass * 0.5, 0.1); 
                        particleColors[i3 + 1] = THREE.MathUtils.lerp(particleColors[i3 + 1], 0.2 + audioData.frequencies.mid * 0.5, 0.1);
                        particleColors[i3 + 2] = THREE.MathUtils.lerp(particleColors[i3 + 2], 0.2 + audioData.frequencies.treble * 0.5, 0.1);
                    }
                    this.particleSystem.geometry.attributes.color.needsUpdate = true;
                }
            }
            currentBloomStrength += audioData.volume * this.settings.audioBloomFactor;
        } else {
            this.sphereMaterial.uniforms.bass.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.bass.value, 0, 0.1);
            this.sphereMaterial.uniforms.mid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.mid.value, 0, 0.1);
            this.sphereMaterial.uniforms.lowMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.lowMid.value, 0, 0.1);
            this.sphereMaterial.uniforms.highMid.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.highMid.value, 0, 0.1);
            this.sphereMaterial.uniforms.treble.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.treble.value, 0, 0.1);
            this.sphereMaterial.uniforms.volume.value = THREE.MathUtils.lerp(this.sphereMaterial.uniforms.volume.value, 0, 0.1);

            if (this.particleSystem && this.particleSystem.geometry) {
                this.particleSystem.material.uniforms.audioVolume.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioVolume.value, 0, 0.05);
                this.particleSystem.material.uniforms.audioMid.value = THREE.MathUtils.lerp(this.particleSystem.material.uniforms.audioMid.value, 0, 0.05);
                 // Optionally fade particle colors back to their base when no audio
                if (!this.particleSystem.geometry.attributes.color.needsUpdate) {
                    const particleColors = this.particleSystem.geometry.attributes.color.array;
                    for (let i = 0; i < this.settings.particleCount; i++) {
                        const i3 = i * 3;
                        particleColors[i3] = THREE.MathUtils.lerp(particleColors[i3], 0.6 + Math.random() * 0.4, 0.02); 
                        particleColors[i3 + 1] = THREE.MathUtils.lerp(particleColors[i3 + 1], 0.6 + Math.random() * 0.4, 0.02);
                        particleColors[i3 + 2] = THREE.MathUtils.lerp(particleColors[i3 + 2], 0.6 + Math.random() * 0.4, 0.02);
                    }
                     this.particleSystem.geometry.attributes.color.needsUpdate = true;
                }
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