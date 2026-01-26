'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { P5CanvasInstance, ReactP5Wrapper } from '@p5-wrapper/react';
import { useTheme } from '@/contexts/ThemeContext';

// Dynamically import ReactP5Wrapper to avoid SSR issues
const P5Wrapper = dynamic(
    () => import('@p5-wrapper/react').then((mod) => mod.ReactP5Wrapper),
    { ssr: false }
);

interface Particle {
    pos: any; // p5.Vector
    vel: any; // p5.Vector
    acc: any; // p5.Vector
    maxSpeed: number;
    prevPos: any; // p5.Vector
    update: () => void;
    follow: (vectors: any[]) => void;
    applyForce: (force: any) => void;
    show: (p5: P5CanvasInstance) => void;
    edges: (p5: P5CanvasInstance) => void;
}

const BackgroundCanvas = () => {
    const { theme } = useTheme();
    // We need to track the actual coloring based on theme
    // We can't access CSS variables easily inside p5 setup without some tricks
    // So we'll pass the theme string to the sketch and handle colors there

    // Define the sketch
    const sketch = (p5: P5CanvasInstance) => {
        let cols: number, rows: number;
        let scl = 40; // Scale of the grid
        let zoff = 0; // Z-axis offset for 3D noise (time)
        let flowfield: any[];
        let particles: Particle[] = [];
        let flowColors: any;

        // Theme configuration
        let isDark = theme === 'dark';

        p5.updateWithProps = (props: any) => {
            if (props.theme) {
                isDark = props.theme === 'dark';
            }
        };

        p5.setup = () => {
            const canvas = p5.createCanvas(window.innerWidth, window.innerHeight);
            canvas.position(0, 0);
            canvas.style('z-index', '-1');
            canvas.style('position', 'fixed');
            canvas.style('top', '0');
            canvas.style('left', '0');

            cols = p5.floor(window.innerWidth / scl);
            rows = p5.floor(window.innerHeight / scl);

            flowfield = new Array(cols * rows);

            // Initialize particles
            // Fewer particles for Zen feel, not too chaotic
            const particleCount = window.innerWidth < 768 ? 100 : 300;
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles[i] = new Particle(p5);
            }
        };

        p5.draw = () => {
            // Clear background with very high transparency for trail effect
            // Or just clear completely for cleaner look?
            // For "Zen", trails might be nice but let's prevent muddying
            if (isDark) {
                p5.background(13, 17, 23, 20); // Deep void with slight trail
            } else {
                p5.background(242, 240, 233, 40); // Warm paper with slight trail
            }

            let yoff = 0;
            for (let y = 0; y < rows; y++) {
                let xoff = 0;
                for (let x = 0; x < cols; x++) {
                    let index = x + y * cols;
                    // 4D noise: x, y, z(time), and a 4th dimension for extra subtlety? 
                    // Just 3D is enough.
                    let angle = p5.noise(xoff, yoff, zoff) * p5.TWO_PI * 2;
                    // let v = p5.Vector.fromAngle(angle); // Typescript error on wrapper
                    let v = p5.createVector(p5.cos(angle), p5.sin(angle));
                    v.setMag(0.5); // Very gentle force
                    flowfield[index] = v;
                    xoff += 0.1;

                    // Debug: show field
                    // p5.stroke(0, 50);
                    // p5.push();
                    // p5.translate(x * scl, y * scl);
                    // p5.rotate(v.heading());
                    // p5.strokeWeight(1);
                    // p5.line(0, 0, scl, 0);
                    // p5.pop();
                }
                yoff += 0.1;
                zoff += 0.0003; // Very slow evolution
            }

            for (let i = 0; i < particles.length; i++) {
                particles[i].follow(flowfield);
                particles[i].update();
                particles[i].edges(p5);
                particles[i].show(p5);
            }
        };

        p5.windowResized = () => {
            p5.resizeCanvas(window.innerWidth, window.innerHeight);
            cols = p5.floor(window.innerWidth / scl);
            rows = p5.floor(window.innerHeight / scl);
            flowfield = new Array(cols * rows);
        };

        class Particle {
            pos: any;
            vel: any;
            acc: any;
            maxSpeed: number;
            prevPos: any;
            p5: P5CanvasInstance;

            constructor(p5Instance: P5CanvasInstance) {
                this.p5 = p5Instance;
                this.pos = this.p5.createVector(this.p5.random(this.p5.width), this.p5.random(this.p5.height));
                this.vel = this.p5.createVector(0, 0);
                this.acc = this.p5.createVector(0, 0);
                this.maxSpeed = 1.5; // Slow movement
                this.prevPos = this.pos.copy();
            }

            update() {
                this.vel.add(this.acc);
                this.vel.limit(this.maxSpeed);
                this.pos.add(this.vel);
                this.acc.mult(0);
            }

            follow(vectors: any[]) {
                let x = this.p5.floor(this.pos.x / scl);
                let y = this.p5.floor(this.pos.y / scl);
                let index = x + y * cols;
                let force = vectors[index];
                this.applyForce(force);
            }

            applyForce(force: any) {
                if (force) {
                    this.acc.add(force);
                }
            }

            show(p5: P5CanvasInstance) {
                // Line based drawing for trails

                let strokeColor;
                if (isDark) {
                    // Gold/Lavender in dark mode
                    strokeColor = p5.color(212, 175, 55, 100);
                    // Or maybe subtle blue: p5.color(100, 150, 255, 50);
                } else {
                    // Sage/Ink in light mode
                    // strokeColor = p5.color(44, 44, 44, 30); // Ink
                    strokeColor = p5.color(143, 166, 145, 100); // Sage
                }

                p5.stroke(strokeColor);
                p5.strokeWeight(1);
                p5.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);

                // p5.point(this.pos.x, this.pos.y);
                this.updatePrev();
            }

            updatePrev() {
                this.prevPos.x = this.pos.x;
                this.prevPos.y = this.pos.y;
            }

            edges(p5: P5CanvasInstance) {
                if (this.pos.x > p5.width) {
                    this.pos.x = 0;
                    this.updatePrev();
                }
                if (this.pos.x < 0) {
                    this.pos.x = p5.width;
                    this.updatePrev();
                }
                if (this.pos.y > p5.height) {
                    this.pos.y = 0;
                    this.updatePrev();
                }
                if (this.pos.y < 0) {
                    this.pos.y = p5.height;
                    this.updatePrev();
                }
            }
        }
    };

    return <P5Wrapper sketch={sketch} theme={theme} />;
};

export default BackgroundCanvas;
