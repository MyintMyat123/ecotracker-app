# EcoTracker

EcoTracker is a full-stack biodiversity monitoring web application for exploring endangered species, viewing global occurrence data, tracking species watchlists, and receiving conservation-related notifications.

The project uses a Laravel API backend and a React + TypeScript frontend. Species and occurrence data are powered by the GBIF API, with optional AI-generated ecological summaries using Google Gemini.

## Features

- Species search by common or scientific name
- Advanced filters by kingdom and IUCN conservation status
- Country-based endangered species explorer
- Species detail and tracker dashboards
- GBIF occurrence maps and monitoring metrics
- User authentication with Laravel Sanctum
- Personal species watchlist
- Watchlist monitoring for new sightings, range changes, status changes, and data-quality updates
- In-app notifications and optional email notifications
- Admin dashboard for users, statistics, and broadcasts
- AI ecological overview generation using Gemini

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Leaflet / React Leaflet
- React Simple Maps
- Axios

### Backend
- Laravel
- PHP 8.3+
- Laravel Sanctum
- MySQL
- Laravel Scheduler / Artisan commands
- GBIF API
- Google Gemini API

## Project Structure

```
ecotracker-app/
├── ecotracker-api/   # Laravel backend API
└── ecotracker-ui/    # React frontend
```

## Requirements

- PHP 8.3 or higher
- Composer
- Node.js and npm
- MySQL
- Gemini API key, optional for AI summaries

## Backend Setup

```
cd ecotracker-api
composer install
cp .env.example .env
php artisan key:generate
```

Update the database settings in `.env`:

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ecotracker_db
DB_USERNAME=your_mysql_username
DB_PASSWORD=your_mysql_password
```

Run migrations and seed the admin user:

```
php artisan migrate
php artisan db:seed
```

Start the backend server:

```
php artisan serve
```

The API will run at:

```
http://localhost:8000/api
```

## Frontend Setup

```
cd ecotracker-ui
npm install
cp .env.example .env
```

Make sure the frontend points to the Laravel API:

```
VITE_API_BASE_URL=http://localhost:8000/api
```

Start the frontend:

```
npm run dev
```

The frontend will usually run at:

```
http://localhost:5173
```

## Default Admin Account

After running the seeders, an admin user is created:

```
Email: admin@ecotracker.app
Password: Admin@123456
```

Change this password before deploying the project.

## Gemini AI Setup

AI ecological summaries require a Gemini API key.

Add this to `ecotracker-api/.env`:

```
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT=45
GEMINI_MAX_OUTPUT_TOKENS=1024
```

If no Gemini key is configured, the AI overview endpoint will return an unavailable response.

## Email Notifications

Email notifications use Laravel Mail.

For local testing, the default mail logger can be used:

```
MAIL_MAILER=log
EMAIL_NOTIFICATIONS_ENABLED=true
```

For SMTP, configure your mail provider:

```
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_FROM_ADDRESS=your_email@gmail.com
MAIL_FROM_NAME="EcoTracker"
EMAIL_NOTIFICATIONS_ENABLED=true
```

## Watchlist Monitoring

EcoTracker includes an Artisan command that checks watchlisted species against GBIF and creates notifications for meaningful updates.

Run manually:

```
php artisan watchlist:monitor
```

Limit the number of checked rows:

```
php artisan watchlist:monitor --limit=10
```

The scheduler is configured to run monitoring daily at 02:00.

For production, run Laravel's scheduler:

```
php artisan schedule:work
```

## Main API Endpoints

### Authentication

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Species

```
GET /api/species/search
GET /api/species/suggest
GET /api/species/country/{countryName}
GET /api/species/{usageKey}
GET /api/species/{usageKey}/occurrences
GET /api/species/{usageKey}/tracker
```

### Watchlist

```
GET    /api/watchlist
POST   /api/watchlist
DELETE /api/watchlist/{gbifSpeciesKey}
```

### Notifications

```
GET    /api/notifications
GET    /api/notifications/unread-count
GET    /api/notifications/{id}
PATCH  /api/notifications/{id}/read
POST   /api/notifications/mark-all-read
DELETE /api/notifications
DELETE /api/notifications/{id}
```

### AI

```
POST /api/ai/overview
```

### Admin

```
GET    /api/admin/stats
GET    /api/admin/users
GET    /api/admin/users/{id}
PATCH  /api/admin/users/{id}
DELETE /api/admin/users/{id}
POST   /api/admin/notifications/broadcast
```

## Build Commands

Frontend production build:

```
cd ecotracker-ui
npm run build
```

Frontend lint:

```
npm run lint
```

Backend tests:

```
cd ecotracker-api
php artisan test
```

## Data Source

EcoTracker uses the GBIF API for species, taxonomy, occurrence, image, conservation, and distribution-related data.

GBIF: https://www.gbif.org/

## License

This project is for academic and educational use.
```
