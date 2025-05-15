import * as dat from 'dat.gui';

export function setupGUI(sceneManager, audioManager) {
    const gui = new dat.GUI();
    
    const cameraFolder = gui.addFolder('Camera');
    cameraFolder.add(sceneManager.camera.position, 'z', 2, 10).name('Distance');
    
    const visualsFolder = gui.addFolder('Visuals');
    const visualParams = {
        sphereColor: '#44aa88',
        emissiveColor: '#2288cc',
        bloomStrength: 1.5,
        bloomRadius: 0.4,
        particleSize: 0.05
    };

    visualsFolder.addColor(visualParams, 'sphereColor').onChange((value) => {
        sceneManager.sphere.material.color.setStyle(value);
    });
    
    visualsFolder.addColor(visualParams, 'emissiveColor').onChange((value) => {
        sceneManager.sphere.material.emissive.setStyle(value);
    });
    
    visualsFolder.add(visualParams, 'bloomStrength', 0, 3).onChange((value) => {
        sceneManager.bloomPass.strength = value;
    });
    
    visualsFolder.add(visualParams, 'bloomRadius', 0, 1).onChange((value) => {
        sceneManager.bloomPass.radius = value;
    });
    
    visualsFolder.add(visualParams, 'particleSize', 0.01, 0.2).onChange((value) => {
        sceneManager.particleSystem.material.size = value;
    });

    cameraFolder.open();
    visualsFolder.open();
}