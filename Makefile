.PHONY: help up down build logs services restart clean ps api api-logs frontend frontend-logs postgres postgres-logs setup db-reset user test test-front test-back test-db test-coverage pwa-build

# Variables
COMPOSE := docker compose
ENV_FILE := .env
API_URL := http://localhost:3002
FRONTEND_URL := http://localhost:5174
DB_URL := localhost:5434

help:
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║                   🌑 ABYSS2 - Docker Commands                  ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Core Commands:"
	@echo "  make setup           - Create .env file (with generated secrets)"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make build           - Build all Docker images"
	@echo "  make restart         - Restart all services"
	@echo "  make clean           - Remove containers, volumes and networks"
	@echo ""
	@echo "Monitoring:"
	@echo "  make services        - List running services with URLs"
	@echo "  make ps              - Show container status"
	@echo "  make logs            - View all services logs"
	@echo ""
	@echo "Service-specific:"
	@echo "  make api             - Start only API"
	@echo "  make api-logs        - View API logs"
	@echo "  make frontend        - Start only Frontend"
	@echo "  make frontend-logs   - View Frontend logs"
	@echo "  make postgres        - Start only PostgreSQL"
	@echo "  make postgres-logs   - View PostgreSQL logs"
	@echo ""
	@echo "Data:"
	@echo "  make user            - Create a test account (test@abyss2.dev / password123)"
	@echo "  make db-reset        - Reset database (remove all data)"
	@echo ""
	@echo "Tests:"
	@echo "  make test            - Run every test suite (front + back + db)"
	@echo "  make test-front      - Vitest — components, stores, composables, pages"
	@echo "  make test-back       - Vitest — API routes and crypto (Prisma mocked)"
	@echo "  make test-db         - Vitest — real PostgreSQL schema and constraints"
	@echo "  make test-coverage   - Coverage report for front and back"
	@echo ""
	@echo "PWA:"
	@echo "  make pwa-build       - Production build + manifest/service worker check"
	@echo ""

# Main commands
up:
	@echo "🚀 Launching Abyss2 services..."
	@$(COMPOSE) -f docker-compose.yml --env-file $(ENV_FILE) up -d
	@echo "✓ Services started!"
	@sleep 3
	@make services

down:
	@echo "🛑 Stopping Abyss2 services..."
	@$(COMPOSE) -f docker-compose.yml down
	@echo "✓ Services stopped!"

build:
	@echo "🔨 Building Docker images..."
	@$(COMPOSE) -f docker-compose.yml --env-file $(ENV_FILE) build
	@echo "✓ Build completed!"

restart:
	@echo "🔄 Restarting services..."
	@make down
	@sleep 2
	@make up

logs:
	@$(COMPOSE) -f docker-compose.yml logs -f

ps:
	@echo "📊 Container Status:"
	@$(COMPOSE) -f docker-compose.yml ps

# Service-specific
api:
	@$(COMPOSE) -f docker-compose.yml --env-file $(ENV_FILE) up -d api

api-logs:
	@$(COMPOSE) -f docker-compose.yml logs -f api

frontend:
	@$(COMPOSE) -f docker-compose.yml --env-file $(ENV_FILE) up -d frontend

frontend-logs:
	@$(COMPOSE) -f docker-compose.yml logs -f frontend

postgres:
	@$(COMPOSE) -f docker-compose.yml --env-file $(ENV_FILE) up -d postgres

postgres-logs:
	@$(COMPOSE) -f docker-compose.yml logs -f postgres

# Service monitoring command
services:
	@echo ""
	@echo "╔════════════════════════════════════════════════════════════════╗"
	@echo "║                  🌐 Abyss2 Services Status                     ║"
	@echo "╚════════════════════════════════════════════════════════════════╝"
	@echo ""
	@if $(COMPOSE) -f docker-compose.yml ps api 2>/dev/null | grep -q "Up"; then \
		echo "✓ API             🔗 $(API_URL)"; \
		echo "  └─ Status: Running"; \
	else \
		echo "✗ API             🔗 $(API_URL)"; \
		echo "  └─ Status: Down"; \
	fi
	@echo ""
	@if $(COMPOSE) -f docker-compose.yml ps frontend 2>/dev/null | grep -q "Up"; then \
		echo "✓ Frontend        🔗 $(FRONTEND_URL)"; \
		echo "  └─ Status: Running"; \
	else \
		echo "✗ Frontend        🔗 $(FRONTEND_URL)"; \
		echo "  └─ Status: Down"; \
	fi
	@echo ""
	@if $(COMPOSE) -f docker-compose.yml ps postgres 2>/dev/null | grep -q "Up"; then \
		echo "✓ PostgreSQL      📍 $(DB_URL)"; \
		echo "  └─ Status: Running"; \
	else \
		echo "✗ PostgreSQL      📍 $(DB_URL)"; \
		echo "  └─ Status: Down"; \
	fi
	@echo ""

# Maintenance commands
clean:
	@echo "🗑️  Cleaning up Docker resources..."
	@$(COMPOSE) -f docker-compose.yml down -v
	@echo "✓ Cleanup completed!"

db-reset:
	@echo "⚠️  Resetting database..."
	@$(COMPOSE) -f docker-compose.yml down -v postgres
	@sleep 2
	@$(COMPOSE) -f docker-compose.yml --env-file $(ENV_FILE) up -d postgres
	@echo "✓ Database reset completed!"

user:
	@echo "👤 Création des comptes de test..."
	@curl -s -X POST $(API_URL)/api/auth/register \
		-H "Content-Type: application/json" \
		-d '{"email":"test@abyss2.dev","password":"password123"}' | head -c 200
	@echo ""
	@curl -s -X POST $(API_URL)/api/auth/register \
		-H "Content-Type: application/json" \
		-d '{"email":"demo@abyss2.dev","password":"demo1234"}' | head -c 200
	@echo ""
	@echo "  test@abyss2.dev / password123"
	@echo "  demo@abyss2.dev / demo1234"
	@echo "  → $(FRONTEND_URL)/login"

# Tests
test:
	@make test-back
	@make test-front
	@make test-db

test-back:
	@echo "🧪 Tests API (Prisma mocké)..."
	@$(COMPOSE) -f docker-compose.yml exec -T api npm test

test-front:
	@echo "🧪 Tests frontend (composants, stores, pages)..."
	@$(COMPOSE) -f docker-compose.yml exec -T frontend npm test

test-db:
	@echo "🧪 Tests base de données (PostgreSQL réel)..."
	@$(COMPOSE) -f docker-compose.yml exec -T api npm run test:db

test-coverage:
	@$(COMPOSE) -f docker-compose.yml exec -T api npm run test:coverage
	@$(COMPOSE) -f docker-compose.yml exec -T frontend npx vitest run --coverage

# PWA
pwa-build:
	@echo "📦 Build de production + vérification PWA..."
	@$(COMPOSE) -f docker-compose.yml exec -T frontend npm run build
	@echo ""
	@echo "── manifest.webmanifest ──"
	@$(COMPOSE) -f docker-compose.yml exec -T frontend cat dist/manifest.webmanifest
	@echo ""
	@echo "── service worker ──"
	@$(COMPOSE) -f docker-compose.yml exec -T frontend sh -c 'ls -la dist/sw.js dist/workbox-*.js'

setup:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "Creating .env file from .env.example..."; \
		cp .env.example $(ENV_FILE); \
		JWT=$$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"); \
		MASTER=$$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"); \
		sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$$JWT|" $(ENV_FILE); \
		sed -i "s|^MASTER_SECRET=.*|MASTER_SECRET=$$MASTER|" $(ENV_FILE); \
		echo "✓ .env file created with generated secrets! Update DB_PASSWORD before any real use."; \
	else \
		echo "✓ .env file already exists"; \
	fi
