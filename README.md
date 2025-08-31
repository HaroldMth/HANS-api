# HANS API Frontend

A complete, production-ready React frontend for the HANS API service with enterprise-level standards for code quality, accessibility, and user experience.

## Features

- 🔐 **Complete Authentication System** - JWT-based auth with protected routes
- 📊 **Interactive Dashboard** - API key management and usage analytics
- 🔌 **API Explorer** - Real-time endpoint testing with response handling
- 👑 **Admin Panel** - Comprehensive user and system management
- 📱 **Responsive Design** - Mobile-first approach with seamless UX
- ♿ **Accessibility** - WCAG AA compliant with keyboard navigation
- 🎨 **Modern UI** - Futuristic design with purple-pink-blue gradients

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables by creating a `.env` file:
   ```env
   VITE_API_BASE_URL=https://hans-api.my-domain.com
   VITE_ADMIN_EMAIL=admin@my-domain.com
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Build & Deployment

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deploy to Vercel

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_API_BASE_URL`
   - `VITE_ADMIN_EMAIL`
3. Deploy automatically on push to main branch

## File Structure

```
src/
├── pages/           # Main application pages
│   ├── Home.jsx     # Landing page with API preview
│   ├── Register.jsx # User registration
│   ├── Login.jsx    # User authentication
│   ├── Dashboard.jsx # Protected user dashboard
│   ├── Categories.jsx # API categories explorer
│   ├── AdminPanel.jsx # Admin-only management panel
│   └── NotFound.jsx # 404 error page
├── components/      # Reusable UI components
│   ├── Navbar.jsx   # Navigation with responsive mobile menu
│   ├── ProtectedRoute.jsx # Route protection wrapper
│   ├── EndpointExplorer.jsx # Interactive API endpoint testing
│   └── ApiResponse.jsx # API response display component
├── hooks/           # Custom React hooks
│   ├── useAuth.js   # Authentication state management
│   └── useApi.js    # API request handling
└── api.js          # Axios configuration and API functions
```

## Authentication Flow

1. **Registration**: Users create accounts via `/register`
2. **Login**: JWT tokens stored in localStorage
3. **Protected Routes**: Automatic redirection for unauthenticated users
4. **Admin Access**: Role-based access control for admin features
5. **Session Management**: Automatic logout on token expiration

## API Integration

The application integrates with the following HANS API endpoints:

### Public Endpoints
- `GET /api/categories` - Retrieve available API categories
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication

### Protected Endpoints (require authentication)
- `GET /api/info` - User information and API key
- `GET /api/*` - Various API endpoints for testing

### Admin Endpoints (admin-only)
- `GET /dashboard-control-9000` - Admin dashboard data
- `POST /admin/regenerate-key/:userId` - Regenerate user API keys
- `PUT /admin/update-limit/:userId` - Update user request limits
- `POST /admin/add-requests/:userId` - Add requests to user quota
- `GET /admin/logs` - Download system logs

## Development Guidelines

### Component Architecture
- Functional components with React hooks
- Custom hooks for state management and API calls
- Proper separation of concerns between components
- Reusable components for common UI patterns

### State Management
- Context API for global authentication state
- Local state for component-specific data
- Custom hooks for complex state logic

### Error Handling
- Comprehensive error boundaries
- User-friendly error messages
- Graceful degradation for failed requests
- Automatic retry mechanisms where appropriate

### Performance Optimization
- Lazy loading for route components
- Optimized bundle splitting
- Efficient re-rendering with proper dependency arrays
- Memory leak prevention with cleanup functions

## Accessibility Features

- WCAG AA color contrast compliance
- Keyboard navigation support
- Screen reader compatibility
- Proper ARIA labels and roles
- Focus management for modals and interactive elements

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Follow the established file structure
2. Maintain component modularity (keep files under 200 lines)
3. Add proper TypeScript types for new features
4. Include accessibility considerations in all UI changes
5. Test on multiple devices and screen sizes

## License

This project is proprietary and confidential.