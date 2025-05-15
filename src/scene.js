import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Visualizer {
    constructor(canvas) {
        this.setup(canvas);
        this.createScene();
        this.addPostProcessing();
    }

    setup(canvas) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;
    }

    createScene() {
        // Create main sphere with custom shader material
        const sphereGeometry = new THREE.IcosahedronGeometry(1, 4);
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
                varying vec3 vNormal;
                varying vec3 vPosition;
                uniform float bass;
                uniform float volume;
                uniform float time;
                
                void main() {
                    vNormal = normal;
                    vPosition = position;
                    
                    // Create dynamic displacement based on audio
                    float displacement = bass * 0.3 * sin(position.y * 10.0 + time);
                    vec3 newPosition = position + normal * displacement;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                uniform float bass;
                uniform float lowMid;
                uniform float mid;
                uniform float highMid;
                uniform float treble;
                uniform float volume;
                uniform float time;
                
                void main() {
                    // Create dynamic color based on audio frequencies
                    vec3 color = vec3(
                        0.5 + bass * 0.5,
                        0.3 + mid * 0.7,
                        0.4 + treble * 0.6
                    );
                    
                    // Add pulsing glow
                    float pulse = sin(time * 2.0) * volume;
                    color += pulse * 0.2;
                    
                    // Add fresnel effect
                    float fresnel = pow(1.0 + dot(vNormal, normalize(vPosition)), 2.0);
                    color *= fresnel;
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        this.sphere = new THREE.Mesh(sphereGeometry, this.sphereMaterial);
        this.scene.add(this.sphere);

        // Add particle system
        this.createParticles();
    }

    createParticles() {
        const particleCount = 5000;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 10;
            positions[i + 1] = (Math.random() - 0.5) * 10;
            positions[i + 2] = (Math.random() - 0.5) * 10;

            colors[i] = Math.random();
            colors[i + 1] = Math.random();
            colors[i + 2] = Math.random();
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
        });

        this.particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.particleSystem);
    }

    addPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // intensity
            0.4, // radius
            0.85 // threshold
        );
        this.composer.addPass(this.bloomPass);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.sphereMaterial.uniforms.time.value += 0.01;

        this.sphere.rotation.x += 0.005;
        this.sphere.rotation.y += 0.005;

        this.particleSystem.rotation.y += 0.0005;

        this.composer.render();
    }

    update(audioData) {
        if (!audioData) return;

        // Update shader uniforms
        const uniforms = this.sphereMaterial.uniforms;
        uniforms.time.value += 0.016;
        uniforms.bass.value = audioData.frequencies.bass;
        uniforms.lowMid.value = audioData.frequencies.lowMid;
        uniforms.mid.value = audioData.frequencies.mid;
        uniforms.highMid.value = audioData.frequencies.highMid;
        uniforms.treble.value = audioData.frequencies.treble;
        uniforms.volume.value = audioData.volume;

        // Rotate sphere based on mid frequencies
        this.sphere.rotation.y += 0.003 * (1 + audioData.frequencies.mid);
        this.sphere.rotation.x += 0.002 * (1 + audioData.frequencies.highMid);

        // Update particle system
        if (this.particleSystem) {
            const positions = this.particleSystem.geometry.attributes.position.array;
            const colors = this.particleSystem.geometry.attributes.color.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                // Move particles based on audio
                positions[i + 1] += Math.sin(i + audioData.frequencies.bass) * 0.01;
                
                // Reset particles that go too far
                if (Math.abs(positions[i + 1]) > 5) {
                    positions[i + 1] = -5;
                }

                // Update colors based on audio frequencies
                colors[i] = Math.min(1, audioData.frequencies.bass);
                colors[i + 1] = Math.min(1, audioData.frequencies.mid);
                colors[i + 2] = Math.min(1, audioData.frequencies.treble);
            }

            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            this.particleSystem.geometry.attributes.color.needsUpdate = true;
        }

        // Update post-processing
        this.bloomPass.strength = 0.5 + audioData.volume * 2;

        // Render the scene
        this.composer.render();
    }
}