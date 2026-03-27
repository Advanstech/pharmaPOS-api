#!/bin/bash
# Run database migrations after deployment

set -e

echo "Running database migrations..."

cd /var/app/current

# Run migrations using the direct connection URL
npm run migration:run

echo "Migrations completed successfully"
