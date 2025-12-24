#!/bin/bash

# Ensure script stops on first error
set -e

echo "🔮 Starting Divination App..."
echo "📦 Checking dependencies with uv..."

# Run the server using uv
# This handles virtualenv creation and package installation automatically
uv run server.py
