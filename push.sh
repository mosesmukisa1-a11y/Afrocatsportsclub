#!/usr/bin/env bash
echo ""
echo "=== Push to GitHub ==="
echo "Paste your GitHub Personal Access Token below and press Return:"
echo ""
read TOKEN

if [ -z "$TOKEN" ]; then
  echo "No token entered. Exiting."
  exit 1
fi

git remote remove github 2>/dev/null
git remote add github "https://mosesmukisa1-a11y:${TOKEN}@github.com/mosesmukisa1-a11y/Afrocatsportsclub.git"

echo "Pushing to GitHub..."
git push github main

echo ""
echo "Done! Visit: https://github.com/mosesmukisa1-a11y/Afrocatsportsclub"
