# DDJ-ERGO Mixxx Mapping

A custom **Pioneer DDJ-ERGO mapping for Mixxx**, designed to provide a more structured, state-aware, and performance-oriented workflow than the stock layout.

The project focuses on a **clean and extensible mapping architecture**, with particular attention to pad modes, loop behavior, LED semantics, FX routing, browser integration, and controller-side state consistency.

---

## ✨ Main Features

- 🎛️ **4-deck aware architecture** - Consistent deck abstraction across all channels
- 🧠 **Stateful JavaScript logic** - Internal deck state for modes, loops, jumps, and LED behavior
- 🔁 **Advanced loop workflow** - Dedicated loop and looproll layers with explicit guard rails
- 💡 **Semantic LED feedback** - Distinct visual feedback for state, action, rejection, and mode changes
- 🎚️ **14-bit control support** - High-resolution handling for pitch, EQ, gains, and mixer controls
- 📚 **Context-aware browser control** - Integrated library navigation and preview behavior
- 🛠️ **Technical documentation included** - Reference paper for contributors and maintainers

---

## 🚀 Project Goal

This repository is meant to be more than a working mapping: it is intended as a **maintainable technical base** for ongoing development.

The goal is to let contributors extend the mapping without breaking controller consistency, LED semantics, or live-performance reliability.

---

## 📦 Repository Contents

- `DDJ_ERGO.js` — JavaScript logic for advanced controller behavior
- `DDJ_ERGO.midi.xml` — XML mapping and MIDI bindings
- `DDJ_ERGO_Mixxx_Mapping_Technical_Paper.pdf` — formatted technical documentation

---

## 🧩 Mapping Overview

The current mapping includes:

- **Hotcue, Loop, and Looproll pad modes**
- **Loop size management and beatjump logic**
- **FX routing and mix mode handling**
- **Context-aware browser and preview controls**
- **Custom LED feedback logic**
- **Operational constraints to prevent invalid live states**

---

## 🔜 Priority Roadmap

### **Next major milestone: Jog Wheel mapping**

The next essential step is full **Jog Wheel support**, which is currently the most important missing feature for making the mapping fully usable in real DJ performance.

#### **Vinyl mode**
- scratching on the top surface
- edge-based **pitch bending / nudging** for beat alignment
- forward / backward track movement
- correct interaction with playback and transport state

#### **Non-vinyl mode**
- forward / backward track movement
- **pitch bending / nudging** for beatmatching adjustments
- with **Shift** pressed: scrolling the track start position / moving more precisely within the track

Jog Wheel support is the **top priority for upcoming versions** of this mapping.

---

## 🛣️ Future Direction

After Jog Wheel support, the next intended extension is the use of the current **Reserved** pad mode for **stems control** in future Mixxx versions, particularly if the expected Mixxx 2.6 stems workflow exposes suitable ControlObjects for hardware mapping.

That mode is intended to become the controller-side entry point for:

- stems panel access
- source layer selection
- enable / suppress workflows for track components such as vocals, drums, bass, and harmonic content

---

## 📄 Documentation

The repository includes a technical paper covering:

- MIDI architecture
- XML / JavaScript responsibility split
- internal state model
- pad mode logic
- loop engine behavior
- LED semantics
- routing logic
- browser and preview workflows
- future Reserved mode direction

It is intended as a reference for both maintainers and contributors.

---

## 🤝 Contributing

Contributions, testing, and architectural suggestions are welcome.

If you plan to extend the mapping:

1. Review the technical paper first
2. Keep LED semantics consistent
3. Preserve controller-side state logic
4. Avoid ambiguous modal behavior
5. Treat Jog Wheel development as the current main target

---

## 👨‍💻 Developer

Developed by **0xV3r**

For questions, feedback or collaboration opportunities, feel free to reach out at: **dev.0xv3r@gmail.com**

---

## ☕ Donations

If you want to support the project, you can do so here:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/S6S41LYUI0)

---

## © Copyright and Licensing

Copyright (c) 2026 DDJ-ERGO Mixxx Mapping Contributors.

This documentation may be shared and adapted under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license, unless otherwise specified in this repository.

Pioneer DJ, DDJ-ERGO, and Mixxx remain the property or trademarks of their respective owners.

---

**Developed and maintained as a collaborative Mixxx mapping project**