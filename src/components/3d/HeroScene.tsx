"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float, Stars } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere() {
    const meshRef = useRef<THREE.Mesh>(null!);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        meshRef.current.rotation.x = t * 0.2;
        meshRef.current.rotation.y = t * 0.3;
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <Sphere args={[1.5, 64, 64]} ref={meshRef}>
                <MeshDistortMaterial
                    color="#3b82f6" // Blue-500
                    attach="material"
                    distort={0.4}
                    speed={2}
                    roughness={0.2}
                    metalness={0.8}
                />
            </Sphere>
        </Float>
    );
}

function Particles() {
    const count = 200;
    const mesh = useRef<THREE.InstancedMesh>(null!);
    const dummy = new THREE.Object3D();

    // Generate random positions
    const particles = useRef(new Array(count).fill(0).map(() => ({
        position: [
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        ],
        speed: Math.random() * 0.02
    })));

    useFrame(() => {
        particles.current.forEach((particle, i) => {
            let { position, speed } = particle;
            position[1] += speed;
            if (position[1] > 5) position[1] = -5; // Reset height

            dummy.position.set(position[0] as number, position[1] as number, position[2] as number);
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <circleGeometry args={[0.05]} />
            <meshBasicMaterial color="#93c5fd" transparent opacity={0.6} />
        </instancedMesh>
    );
}

export function HeroScene() {
    return (
        <div className="absolute inset-0 z-0 h-full w-full opacity-60">
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} color="blue" intensity={0.5} />

                <AnimatedSphere />
                <Particles />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            </Canvas>
        </div>
    );
}
