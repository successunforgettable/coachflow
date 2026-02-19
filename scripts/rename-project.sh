#!/bin/bash

# CoachFlow Rebranding Script
# Usage: ./scripts/rename-project.sh "NewName" "newname"
# Example: ./scripts/rename-project.sh "MarketFlow" "marketflow"

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <NewName> <newname>"
    echo "Example: $0 'MarketFlow' 'marketflow'"
    exit 1
fi

NEW_NAME="$1"      # e.g., "MarketFlow"
NEW_NAME_LOWER="$2" # e.g., "marketflow"

echo "🚀 Starting rebrand from CoachFlow to $NEW_NAME..."
echo ""

# Backup confirmation
read -p "⚠️  This will modify files. Have you committed your changes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Aborted. Please commit your changes first."
    exit 1
fi

echo "📝 Replacing 'CoachFlow' with '$NEW_NAME'..."
find client/src server -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.html" \) \
    -exec sed -i "s/CoachFlow/$NEW_NAME/g" {} \;

echo "📝 Replacing 'coachflow' with '$NEW_NAME_LOWER'..."
find client/src server -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) \
    -exec sed -i "s/coachflow/$NEW_NAME_LOWER/g" {} \;

echo "📝 Updating package.json..."
sed -i "s/\"name\": \"coachflow\"/\"name\": \"$NEW_NAME_LOWER\"/" package.json

echo "📝 Updating README.md..."
sed -i "s/CoachFlow/$NEW_NAME/g" README.md
sed -i "s/coachflow/$NEW_NAME_LOWER/g" README.md

echo "📝 Updating documentation files..."
find . -maxdepth 1 -name "*.md" -type f \
    -exec sed -i "s/CoachFlow/$NEW_NAME/g; s/coachflow/$NEW_NAME_LOWER/g" {} \;

echo "📝 Updating todo.md..."
sed -i "s/CoachFlow/$NEW_NAME/g; s/coachflow/$NEW_NAME_LOWER/g" todo.md

echo ""
echo "✅ Rebrand complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update VITE_APP_TITLE in Manus Settings → Secrets"
echo "2. Update VITE_APP_LOGO if you have a new logo"
echo "3. Run 'pnpm test' to ensure nothing broke"
echo "4. Commit changes: git add . && git commit -m 'Rebrand to $NEW_NAME'"
echo "5. Create checkpoint in Manus"
echo ""
echo "🎉 Your platform is now $NEW_NAME!"
