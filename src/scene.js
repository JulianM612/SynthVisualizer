import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'stats.js';
import * as dat from 'dat.gui';

export class Visualizer {
    constructor(canvas) {
        console.log("Visualizer: constructor called with canvas:", canvas); // Added for debugging
        this.canvas = canvas;
        this.isAudioActive = false;

        if (!this.canvas) {
            console.error("Visualizer Constructor: Canvas element is null or undefined!");
            // Potentially throw an error or handle this gracefully
            // For now, we'll let it proceed and other parts might fail.
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
        // Check if stats.dom is already appended to prevent duplicates if constructor is called multiple times (should not happen)
        if (!document.body.contains(this.stats.dom)) {
            document.body.appendChild(this.stats.dom);
        }
    }

    setupSettingsAndGUI() {
        console.log("Visualizer: setupSettingsAndGUI");
        this.settings = {
            particleCount: 10000,
            particleSize: 2,
            rotationSpeed: 0.2,
            sphereRotationSpeed: 0.3,
            bloomStrength: 1.0,
            bloomRadius: 0.4,
            bloomThreshold: 0.85,
            audioBloomFactor: 1.5
        };

        // Check if a GUI instance already exists for this visualizer to prevent duplicates
        // This is a simple check; more robust solutions might involve a singleton GUI manager
        if (this.gui) {
            console.warn("Visualizer: GUI might already exist. Attempting to destroy old one.");
            try {
                this.gui.destroy();
            } catch(e) { /* ignore*/ }
        }
        this.gui = new dat.GUI();
        this.gui.add(this.settings, 'particleCount', 1000, 50000, 1000).onChange(() => this.recreateParticles());
        this.gui.add(this.settings, 'particleSize', 0.1, 5).name('Base Particle Size');
        this.gui.add(this.settings, 'rotationSpeed', 0, 1).name('Particle System Speed');
        this.gui.add(this.settings, 'sphereRotationSpeed', 0, 1).name('Sphere Speed');
        
        const bloomFolder = this.gui.addFolder('Bloom');
        bloomFolder.add(this.settings, 'bloomStrength', 0, 3).name('Base Strength');
        bloomFolder.add(this.settings, 'bloomRadius', 0, 1);
        bloomFolder.add(this.settings, 'bloomThreshold', 0, 1);
        bloomFolder.add(this.settings, 'audioBloomFactor', 0, 5).name('Audio Boost Factor');
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

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement); // Use renderer.domElement if canvas is directly passed
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    createSceneObjects() {
        console.log("Visualizer: createSceneObjects");
        const sphereGeometry = new THREE.IcosahedronGeometry(1, 6);
        this.sphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                bass: { value: 0 },
                lowMid: { value: 0 },
                mid: { value: 0 },
                highMid: { value: 0 },
                treble: { value: 0 },
                volume: { value: 0 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying vec3 vViewNormal;
                
                uniform float bass;
                uniform float time;

                void main() {
                    vWorldPosition = position;
                    
                    float displacement = bass * 0.4 * sin(position.y * 10.0 + time * 2.0 + position.x * 5.0);
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
                
                void main() {
                    vec3 baseColor = vec3(
                        0.5 + bass * 0.5,
                        0.3 + mid * 0.7,
                        0.4 + treble * 0.6
                    );
                    
                    float pulse = sin(time * 5.0 + vWorldPosition.y * 10.0) * volume * 0.5;
                    pulse = (pulse + 1.0) / 2.0;
                    vec3 color = mix(baseColor, vec3(1.0, 1.0, 1.0), pulse * 0.3);

                    float fresnelDot = dot(normalize(vViewNormal), normalize(vViewPosition));
                    float fresnel = pow(0.3 + abs(fresnelDot), 2.5);

                    color = mix(color, color * 1.5, fresnel * (0.5 + volume * 0.5));
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        this.sphere = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
        this.scene.add(this.sphere);
        console.log("Visualizer: Sphere created and added to scene");

        this.createParticles();
    }

    createParticles() {
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
        const sizes = new Float32Array(this.settings.particleCount); // These are base size factors
        const randomFactors = new Float32Array(this.settings.particleCount);

        for (let i = 0; i < this.settings.particleCount; i++) {
            const i3 = i * 3;
            const radius = 3 + Math.random() * 4;
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(Math.random() * 2 - 1);

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);

            colors[i3] = 0.5 + Math.random() * 0.5;
            colors[i3 + 1] = 0.5 + Math.random() * 0.5;
            colors[i3 + 2] = 0.5 + Math.random() * 0.5;

            sizes[i] = (0.5 + Math.random() * 0.5); // Store base random size factor
            randomFactors[i] = (Math.random() - 0.5) * 2.0;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1)); // These are base sizes
        particles.setAttribute('randomFactor', new THREE.BufferAttribute(randomFactors, 1));


        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pointTexture: { value: this.generateParticleTexture() },
                globalParticleSize: { value: this.settings.particleSize } // Global scale from GUI
                // Add audio uniforms here if you want shader to react directly
            },
            vertexShader: `
                attribute float size; // This is the base random size factor per particle
                attribute vec3 color;
                attribute float randomFactor;

                varying vec3 vColor;
                varying float vRandomFactor;

                uniform float time;
                uniform float globalParticleSize; // From GUI
                
                void main() {
                    vColor = color;
                    vRandomFactor = randomFactor;

                    vec3 pos = position;
                    
                    float angle = time * 0.1 * (1.0 + randomFactor * 0.5);
                    float s = sin(angle);
                    float c = cos(angle);
                    mat2 rotXZ = mat2(c, -s, s, c);
                    
                    pos.xz = rotXZ * pos.xz;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    // Final point size = (base random size) * (GUI global size) * (perspective scaling)
                    gl_PointSize = size * globalParticleSize * (80.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                varying float vRandomFactor;
                
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    float alpha = texColor.a * (0.7 + vRandomFactor * 0.3); // Modulate alpha slightly
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
        // console.log("Visualizer: generateParticleTexture"); // Can be noisy
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.9)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
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
            // console.log("Visualizer: resize event"); // Can be noisy
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animateScene(deltaTime, audioData) {
        // console.log("Visualizer: animateScene called"); // Very noisy, use with caution
        this.stats.begin();
        this.controls.update();

        const sphereRotSpeed = this.settings.sphereRotationSpeed * deltaTime;
        this.sphere.rotation.x += sphereRotSpeed * 0.5;
        this.sphere.rotation.y += sphereRotSpeed;

        this.sphereMaterial.uniforms.time.value += deltaTime;

        if (this.particleSystem) {
            this.particleSystem.rotation.y += this.settings.rotationSpeed * deltaTime * 0.5;
            this.particleSystem.material.uniforms.time.value += deltaTime;
            // Update global particle size from GUI settings
            this.particleSystem.material.uniforms.globalParticleSize.value = this.settings.particleSize;
        }
        
        this.bloomPass.radius = this.settings.bloomRadius;
        this.bloomPass.threshold = this.settings.bloomThreshold;
        let currentBloomStrength = this.settings.bloomStrength;

        this.isAudioActive = !!audioData;

        if (audioData) {
            this.sphereMaterial.uniforms.bass.value = audioData.frequencies.bass;
            this.sphereMaterial.uniforms.lowMid.value = audioData.frequencies.lowMid;
            this.sphereMaterial.uniforms.mid.value = audioData.frequencies.mid;
            this.sphereMaterial.uniforms.highMid.value = audioData.frequencies.highMid;
            this.sphereMaterial.uniforms.treble.value = audioData.frequencies.treble;
            this.sphereMaterial.uniforms.volume.value = audioData.volume;

            if (this.particleSystem) {
                const colors = this.particleSystem.geometry.attributes.color.array;
                // const sizes = this.particleSystem.geometry.attributes.size.array; // The 'size' attribute stores base random sizes

                for (let i = 0; i < this.settings.particleCount; i++) {
                    const i3 = i * 3;
                    
                    colors[i3] = 0.2 + audioData.frequencies.bass * 0.8;
                    colors[i3 + 1] = 0.2 + audioData.frequencies.mid * 0.8;
                    colors[i3 + 2] = 0.2 + audioData.frequencies.treble * 0.8;
                    
                    // Particle size is now primarily controlled by the 'size' attribute (base random size)
                    // multiplied by the 'globalParticleSize' uniform (from GUI) in the shader.
                    // If you want audio to *also* affect individual particle sizes beyond the global GUI control,
                    // you'd either:
                    // 1. Modify the 'size' attribute here (but this overwrites the base random size unless you store it separately).
                    // 2. Pass audio data (e.g., `audioData.volume`) as a new uniform to the particle shader and modulate size there.
                    // Option 2 is cleaner. For now, size is GUI controlled globally, with random base per particle.
                }
                this.particleSystem.geometry.attributes.color.needsUpdate = true;
                // this.particleSystem.geometry.attributes.size.needsUpdate = true; // Only if you modify sizes array here
            }
            currentBloomStrength += audioData.volume * this.settings.audioBloomFactor;
        } else {
            // Optional: Reset particle colors when no audio
            if (this.particleSystem && this.particleSystem.geometry.attributes.color.needsUpdate === false) { // Avoid constant updates
                const colors = this.particleSystem.geometry.attributes.color.array;
                 for (let i = 0; i < this.settings.particleCount; i++) {
                    const i3 = i * 3;
                    colors[i3] = 0.5 + Math.random() * 0.5; // Reset to initial random colors
                    colors[i3 + 1] = 0.5 + Math.random() * 0.5;
                    colors[i3 + 2] = 0.5 + Math.random() * 0.5;
                }
                this.particleSystem.geometry.attributes.color.needsUpdate = true;
            }
        }
        
        this.bloomPass.strength = currentBloomStrength;

        this.composer.render();
        this.stats.end();
    }

    recreateParticles() {
        console.log("Visualizer: recreateParticles called by GUI");
        this.createParticles();
    }
}
console.log("src/scene.js: Parsed and Visualizer class is exported."); // Top-level log