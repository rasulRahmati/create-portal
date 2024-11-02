import React, {useCallback, useEffect, useRef} from "react";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import * as dat from 'dat.gui';
import { gsap } from "gsap";
import CANNON from "cannon";
import typeFaceFont from 'three/examples/fonts/helvetiker_regular.typeface.json'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import Stats from 'stats.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import firefliesVertexShader from './shaders/fireflies/vertex.glsl'
import firefliesFragmentShader from './shaders/fireflies/fragment.glsl'
import portalVertexShader from './shaders/portal/vertex.glsl'
import portalFragmentShader from './shaders/portal/fragment.glsl'

const Three = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    /**
     * Stats
     */
    const stats = new Stats()
    stats.showPanel(0)
    document.body.appendChild(stats.dom)

    /**
     * Debug
     */
    const gui = new dat.GUI();
    const debugObject = {
      clearColor: '#201919',
      portalColorStart: '#000000',
      portalColorEnd: '#ffffff'
    }
    
    /**
     * Scene
     */
    const scene = new THREE.Scene();

    /**
     * Loaders
     */
    // Texture loader
    const textureLoader = new THREE.TextureLoader()
    const bakedTexture = textureLoader.load('./backed.jpg')
    bakedTexture.flipY = false
    bakedTexture.colorSpace = THREE.SRGBColorSpace;
    bakedTexture.needsUpdate = true;

    // Draco loader
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('draco/')

    // GLTF loader
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    /**
     * Material
     */
    //  Backed material
    const bakedMaterial = new THREE.MeshBasicMaterial({ map: bakedTexture })
    
    //  Pole light material
    const poleLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe5 })

    //  Portal light material
    const portalLightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorStart: { value: new THREE.Color(debugObject.portalColorStart) },
        uColorEnd: { value: new THREE.Color(debugObject.portalColorEnd) }
      },
      vertexShader: portalVertexShader,
      fragmentShader: portalFragmentShader
    })

    /**
     * Models
     */
    gltfLoader.load(
      './portal.glb',
      (gltf) =>
      {
        // gltf.scene.traverse((child) => {
        //   child.material = bakedMaterial
        // })

        const bakedMesh = gltf.scene.children.find((child) => child.name === 'baked')
        const portalLightMesh = gltf.scene.children.find((child) => child.name === 'portalLight')
        const poleLightAMesh = gltf.scene.children.find((child) => child.name === 'portalLightA')
        const poleLightBMesh = gltf.scene.children.find((child) => child.name === 'portalLightB')

        bakedMesh.material = bakedMaterial
        portalLightMesh.material = portalLightMaterial
        poleLightAMesh.material = poleLightMaterial
        poleLightBMesh.material = poleLightMaterial

        scene.add(gltf.scene)
      }
    )

    /**
     * Fireflies
     */
    // Geometry
    const firefliesGeometry = new THREE.BufferGeometry()
    const firefliesCount = 30
    const positionArray = new Float32Array(firefliesCount * 3)
    const scaleArray = new Float32Array(firefliesCount * 1)

    for (let i = 0; i < firefliesCount; i++) {
      positionArray[i * 3 + 0] = (Math.random() - 0.5) * 4      
      positionArray[i * 3 + 1] = Math.random() * 1.5      
      positionArray[i * 3 + 2] = (Math.random() - 0.5) * 4 
      
      scaleArray[i] = Math.random()
    }
    firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
    firefliesGeometry.setAttribute('aScale', new THREE.BufferAttribute(scaleArray, 1))

    // Material
    const firefliesMaterial = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending, //  To make them more can of shiny
      depthWrite: false, // Important for disable angles clipping issues
      uniforms: {
        uPixelRatio: {
          value: Math.min(window.devicePixelRatio, 2)
        },
        uSize: { value: 200 },
        uTime: { value: 0 }
      },
      vertexShader: firefliesVertexShader,
      fragmentShader: firefliesFragmentShader
    })

    // const firefliesMaterial = new THREE.PointsMaterial({
    //   size: 0.1,
    //   sizeAttenuation: true
    // })

    // Mesh
    const fireflies = new THREE.Points(firefliesGeometry, firefliesMaterial)
    scene.add(fireflies)
    
    /**
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance', // Best GPU to handle your webgl
      antialias: true
    });

    renderer.colorManagement = true;
    // renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(debugObject.clearColor)

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    /**
     * GUI
     */
    gui
    .addColor(debugObject, 'clearColor')
    .onChange(() => {
      renderer.setClearColor(debugObject.clearColor)
    })

    gui.add(firefliesMaterial.uniforms.uSize, 'value').min(0).max(500).step(1).name('fireFliesSize')

    gui
    .addColor(debugObject, 'portalColorStart')
    .onChange(() => {
      portalLightMaterial.uniforms.uColorStart.value.set(debugObject.portalColorStart)
    })

    gui
    .addColor(debugObject, 'portalColorEnd')
    .onChange(() => {
      portalLightMaterial.uniforms.uColorStart.value.set(debugObject.portalColorEnd)
    })

    //  Axes helper
    // const axesHelper = new THREE.AxesHelper(2);
    // scene.add(axesHelper);

    //  Camera
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(4, 2, 4)
    scene.add(camera)
 
    // Helper
    // const pointLightCameraHelper = new THREE.CameraHelper(pointLight.shadow.camera);
    // pointLightCameraHelper.visible = false;
    // scene.add(pointLightCameraHelper);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Resize
    const handleResize = () => {
        //  Update camera
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        //  Update renderer
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        //  Update fireflies
        firefliesMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
    window.addEventListener('resize', handleResize)

    // Clock
    const clock = new THREE.Clock();
    let previousTime = 0;

    //  Animation
    const animate = () => {
      stats.begin()

      const elapsedTime = clock.getElapsedTime();
      const deltaTime = elapsedTime - previousTime;
      previousTime = elapsedTime;

      //  Update materials
      portalLightMaterial.uniforms.uTime.value = elapsedTime
      firefliesMaterial.uniforms.uTime.value = elapsedTime

      //  Update controls for damping
      controls.update();

      renderer.render(scene, camera);
      requestAnimationFrame(animate);

      stats.end()
    };

    animate();

    return () => {
        window.removeEventListener('resize', handleResize);
        containerRef.current.removeChild(renderer.domElement);
        gui.destroy();
    };
  },[]);

  return (
    <>
      <div className="webgl" ref={containerRef}/>
    </>
  );
}

export default Three