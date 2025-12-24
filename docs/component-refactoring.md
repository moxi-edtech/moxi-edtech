# KLASSE UI Refactoring

A project is underway to refactor UI components to align with the **KLASSE Design System**, an enterprise-grade standard focused on consistency, reusability, and clarity.

## Recent Changes

### 1. `NoticePanel` Component (`/secretaria/dashboard`)

- The "Avisos Gerais" (General Notices) widget on the Secretaria dashboard has been refactored.
- The old, yellow-tinted card has been replaced by the new `NoticePanel`, `NoticeItem`, and `EmptyNotices` components.
- **Standard**: Uses a clean white surface (`bg-white`), with `klasse-gold` as a subtle accent for icons and borders, moving away from distracting background colors.

### 2. `DashboardHeader` Component

- A standardized internal page header, `DashboardHeader`, has been introduced.
- It provides a consistent structure for page titles, descriptions, breadcrumbs, and primary/secondary actions.
- **Implementation**: The Secretaria dashboard (`/secretaria`) is the first page to adopt this new header, creating a clear information hierarchy at the top of the main content area.
- **Rules**:
  - Primary actions use a solid `klasse-gold` background.
  - Secondary actions use a simple outline style.

This initiative aims to improve UX, establish a clear visual hierarchy, and make the application's UI more professional and scalable.
