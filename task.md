Technical Specification: Family Tree Web Application
1. Project Overview

A single-page web application designed to visualize a complex, multi-branch family tree. The app will render a node-based interactive graph from a static JSON dataset. The primary goal is to provide a clean, readable, and interactive experience that fits well on modern screens.
2. Tech Stack

    Framework: Next.js (App Router or Pages Router).

    Graph Visualization: React Flow (reactflow).

    Graph Layout Engine: Dagre (dagre) for automatic node positioning (to calculate X and Y coordinates dynamically without manual hardcoding).

    Styling: Tailwind CSS (for UI elements and custom node styling).

3. Data Structure

The application will consume a local JSON file (data/familyTree.json) containing:

    nodes: Array of objects with id, label (Name, in Russian), and optional info (Additional details like dates or locations).

    edges: Array of objects with source, target, and type.

        Types of edges: parent-child (vertical or hierarchical flow) and partner (horizontal or distinct visual connection).

4. UI/UX Requirements

    Language: The entire user interface and data content must be in Russian.

    Canvas: The graph should occupy 100vh and 100vw (full screen).

    Interactivity:

        Enable panning (drag to move around the canvas).

        Enable zooming (scroll/pinch to zoom in and out).

        Fit View: On initial load, the graph should automatically zoom and center to fit the entire tree within the viewport.

    Visual Style (Minimalist & Modern):

        Background: Soft, light background (e.g., #f9fafb or subtle dot pattern provided by React Flow).

        Custom Nodes: Nodes should look like neat cards.

            White background, subtle shadow, rounded corners (rounded-lg).

            Primary text (label): Bold, dark gray.

            Secondary text (info): Smaller, lighter gray, rendered below the name if the field exists.

        Edges:

            parent-child edges: Smooth step or bezier curves, solid line.

            partner edges: Distinct color or dashed line to differentiate marriages/partnerships from direct lineage.

5. Implementation Steps

    Initialize a Next.js project with Tailwind CSS.

    Install reactflow and dagre.

    Create the static JSON file with the provided graph data.

    Create a custom node component (CustomNode.jsx/tsx) to handle the display of label and info.

    Implement a layout utility function using dagre to process the JSON nodes and edges and assign x and y coordinates to each node before passing them to React Flow.

    Render the <ReactFlow /> component taking up the full page, applying the fitView prop.