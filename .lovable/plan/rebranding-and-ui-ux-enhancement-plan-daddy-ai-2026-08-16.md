# Rebranding and UI/UX Enhancement Plan: Daddy AI

Enhance the project with a high-end UI/UX inspired by Usenodi and ElevenLabs, focusing on modern aesthetics, interactive elements, and a feature-rich landing page.

## User Review Required

> [!IMPORTANT]
> - The new design uses **oklch** colors for better depth and modern feel.
> - We are introducing a **Bento Grid** layout for features and a **Glassmorphism** effect for the navigation.

## Technical Details

### Design & Branding
- **Color Palette**: Deep teals, warm accents (oklch(0.44 0.083 172)), and soft neutrals.
- **Typography**: Hind Siliguri (Bangla) and Outfit (English) for a tech-forward look.
- **Animations**: Framer Motion-style entrance animations (fade-in, slide-up) and interactive hover states.

### Frontend Components
- **Navbar**: Glassmorphic floating navigation with blur effects.
- **Hero Section**: Dynamic mesh background, large typography, and primary CTA.
- **Interactive Bento Grid**: Highlighting "Voice-to-Training", "Auto-Sync", and "Multi-Platform Integration".
- **Product Preview**: A realistic chat simulation showing Daddy AI in action.
- **Stats Counter**: Animated numbers for user confidence (1.2L+ messages, etc.).

### Navigation & Routes
- `/`: Redesigned high-impact landing page.
- `/admin`: Enhanced dashboard with animated cards and sidebar updates.
- `/auth`: Branded, centered authentication interface.

## Implementation Steps

1. **Global Styles**: Update `src/styles.css` with new variables, animations, and utility classes (`glass`, `bento-item`).
2. **Assets**: Ensure Daddy AI logo is used consistently across all components.
3. **Landing Page**: Rewrite `src/routes/index.tsx` to include the hero, bento grid, and trust sections.
4. **Admin Console**: Update `src/routes/admin.tsx` and `src/routes/admin.index.tsx` for visual consistency.
5. **Interactive Elements**: Add visual feedback to the `VoiceRecorder` and sync process.
