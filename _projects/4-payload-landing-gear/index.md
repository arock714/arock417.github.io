---
layout: post
title: Payload Landing Gear
description: Designed, developed, and tested custom landing gear to fit inside a 6" diameter nose cone and reliably deploy in under 30 seconds. Four 3D printed stainless steel bay covers retain the outer shape of the nose cone during ascent and serve as landing feet upon touch down. The deployment is actuated by a 1/4"-20 threaded lead screw and NEMA 17 stepper motor controlled by a flight computer on board the payload module.

skills: 
- Design for Manufacture
- SolidWorks
- Carbon Fiber Layup
- Rapid Prototyping
main-image: /payload-gear.JPEG
---

# Design Process
## Purpose
This set of landing gear was designed for NYU Rogue Aerospace's 2025 NASA University Student Launch Initiative (USLI) vehicle. The payload mission for competition was to collect and transmit a packet of data collected during flight to a NASA receiver. Placing the transmitting antenna above the ground by about 1.5' ensured proper transmission of the data packet even in the presence of ground foliage. With the landing gear extended and the transmitting antenna at the top of the payload, the antenna would be placed at around this height--giving the signal the clearance it needs to transmit without any problems.

## Design Goals
1. Deploy landing gear between 5 seconds after main parachute deployment and before touchdown--roughly 40 seconds.
2. Deploy reliably under the descent conditions.
3. Fit within the payload module while allowing space for the radio components and flight computer.

## Inspiration and Initial Design
During the initial design of the landing gear I took inspiration from camera tripod legs as they are designed to extend into a large and stable base while collapsing into a slim and portable shape. However, these systems rely on a person to manually push out the legs. The landing gear for the payload needs a system to push out the legs.

{% include image-gallery.html images="tripod.webp" height="400" %}
*Tripod inspiration example.*

This system for legs deployment took a few design iterations to get right. My first thought was to place a compression spring on the middle shaft of the landing gear which would push out the legs when current ran through a nichrome wire which held the legs during ascent. While this would push out the legs in a very short period of time, the possibility of the nichrome wire breaking or coming loose during ascent would be catastrophic to the aerodynamic stability of the rocket. So this design would fit design goal 1 pretty well but have the potential to fail design goal 2 catastrophically. Additionally, any compression spring long enough to apply a force when the legs were deployed would be applying a very high force when in its launch position.

{% include image-gallery.html images="initial design.png" height="400" %}
*Initial landing gear design using a compression spring.*

The lead screw method solves this reliability problem by only deploying when it's triggered by the flight computer. This means we have much more control over this premature deploying failure event. A stepper motor was chosen to spin the threaded rod. Early on, I failed to run a calculation on the torque of the stepper motor compared to the estimated torque required to deploy the gear. The result was a very underpowered stepper motor during initial prototyping. Thanks to the early prototyping, the stepper motor and power supply was upgraded before the final vehicle integration.

{% include image-gallery.html image1="prototype-irl.JPEG" image2="prototype-render.JPEG" height="400" %}
*Wooden prototype made for rapid prototyping (left) and render from SolidWorks assembly (right).*

