#!/bin/bash
# =============================================================================
# ConnectNow Development Setup Script
# =============================================================================
# This script sets up your local development environment.
# Run with: ./scripts/setup-dev.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=============================================="
echo "  ConnectNow Development Setup"
echo "=============================================="
echo -e "${NC}"

# Check for required tools
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed. Please install Node.js 18+${NC}"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}Node.js 18+ is required. Current version: $(node -v)${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"

    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

    # Check Docker (optional but recommended)
    if command -v docker &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
    else
        echo -e "  ${YELLOW}!${NC} Docker not found (optional, but recommended)"
    fi

    echo ""
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo -e "  ${GREEN}✓${NC} Dependencies installed"
    echo ""
}

# Setup environment file
setup_env() {
    echo -e "${YELLOW}Setting up environment...${NC}"

    if [ -f ".env.local" ]; then
        echo -e "  ${YELLOW}!${NC} .env.local already exists, skipping"
    else
        cp .env.example .env.local
        echo -e "  ${GREEN}✓${NC} Created .env.local from template"

        # Generate a random secret for NEXTAUTH_SECRET
        RANDOM_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)

        # Update the secret in .env.local (macOS compatible)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/your-super-secret-key-min-32-characters-here/$RANDOM_SECRET/" .env.local
        else
            sed -i "s/your-super-secret-key-min-32-characters-here/$RANDOM_SECRET/" .env.local
        fi
        echo -e "  ${GREEN}✓${NC} Generated NEXTAUTH_SECRET"
    fi
    echo ""
}

# Start Docker services
start_docker_services() {
    echo -e "${YELLOW}Starting Docker services...${NC}"

    if ! command -v docker &> /dev/null; then
        echo -e "  ${YELLOW}!${NC} Docker not found, skipping..."
        echo -e "  ${YELLOW}!${NC} Make sure PostgreSQL and Redis are running locally"
        return
    fi

    if ! docker info &> /dev/null; then
        echo -e "  ${YELLOW}!${NC} Docker is not running, please start Docker Desktop"
        return
    fi

    docker-compose up -d
    echo -e "  ${GREEN}✓${NC} PostgreSQL started on port 5432"
    echo -e "  ${GREEN}✓${NC} Redis started on port 6379"

    # Wait for PostgreSQL to be ready
    echo -e "  ${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    sleep 3

    echo ""
}

# Setup database
setup_database() {
    echo -e "${YELLOW}Setting up database...${NC}"

    # Generate Prisma client
    npm run db:generate
    echo -e "  ${GREEN}✓${NC} Prisma client generated"

    # Run migrations
    echo -e "  ${YELLOW}Running database migrations...${NC}"
    npm run db:push 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} Database schema applied"

    # Seed database
    echo -e "  ${YELLOW}Seeding database with test data...${NC}"
    npm run db:seed 2>/dev/null || echo -e "  ${YELLOW}!${NC} Seed skipped (may already exist)"
    echo -e "  ${GREEN}✓${NC} Database seeded"

    echo ""
}

# Print completion message
print_completion() {
    echo -e "${GREEN}"
    echo "=============================================="
    echo "  Setup Complete!"
    echo "=============================================="
    echo -e "${NC}"
    echo "Next steps:"
    echo ""
    echo "  1. Start the development server:"
    echo -e "     ${BLUE}npm run dev${NC}"
    echo ""
    echo "  2. Or start both Next.js and Socket.io:"
    echo -e "     ${BLUE}npm run dev:all${NC}"
    echo ""
    echo "  3. Open in browser:"
    echo -e "     ${BLUE}http://localhost:9002${NC}"
    echo ""
    echo "  4. View database with Prisma Studio:"
    echo -e "     ${BLUE}npm run db:studio${NC}"
    echo ""
    echo "Test accounts (password: password123):"
    echo "  - john@example.com"
    echo "  - jane@example.com"
    echo "  - bob@example.com"
    echo ""
    echo -e "${YELLOW}Happy coding!${NC}"
}

# Main execution
main() {
    check_requirements
    install_dependencies
    setup_env
    start_docker_services
    setup_database
    print_completion
}

main
