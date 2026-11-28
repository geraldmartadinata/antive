# Think Twice design references

This folder keeps the original Think Twice design work alongside the Antive project.

- [`screens/`](screens/) contains the HTML mockup and screenshot for each proposed screen.
- [`design-system/DESIGN.md`](design-system/DESIGN.md) describes the colors, typography, spacing, and component styling.

These files are references, not the running React application. The HTML files are standalone mockups and are not wired together as a product. When implementation starts, create the React and Tailwind app in `antive/frontend/` and use these designs as references while rebuilding screens as React components.

Suggested frontend layout:

```text
antive/
  antive/                 # Python package: parsing and guidance
  design/think-twice/     # Original mockups and visual reference
  frontend/               # React + Tailwind app (to be created)
    src/
      components/         # Shared UI pieces
      pages/              # App screens/routes
```

Keep budget calculations and purchase affordability rules tied to the backend or shared deterministic logic. The frontend should present those results and collect corrections and decisions.
